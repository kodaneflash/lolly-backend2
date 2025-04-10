// rag/qa.js
import { getVectorStore } from "./store.js";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const expressionToAnimations = {
  smile: ["Talking_0", "Talking_1", "Laughing"],
  angry: ["Angry", "Idle"],
  surprised: ["Terrified", "Talking_2"],
  default: ["Idle", "Talking_2"]
};

function getAnimationForExpression(expression = "default") {
  const list = expressionToAnimations[expression] || expressionToAnimations.default;
  return list[Math.floor(Math.random() * list.length)];
}

async function detectFacialExpression(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Analyse le ton de ce texte et réponds uniquement par : smile, angry, surprised, default."
        },
        { role: "user", content: text }
      ],
      max_tokens: 5,
      temperature: 0.3
    });

    const expression = completion.choices[0].message.content.trim().toLowerCase();
    return expressionToAnimations[expression] ? expression : "default";
  } catch {
    return "default";
  }
}

function truncateText(text, maxTokens) {
  return text.split(/\s+/).slice(0, maxTokens).join(" ");
}

async function fetchWebsiteData(url = "https://neemba.com") {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch {
    return null;
  }
}

export async function answerWithRAG(userMessage, maxContextTokens = 1000) {
  const isGeneric = ["technologie", "innovation", "produits", "services", "solutions", "entreprise"].some(word =>
    userMessage.toLowerCase().includes(word)
  );
  if (isGeneric) {
    userMessage = `Parle-moi de ${userMessage} chez Neemba.`;
  }

  const relevantDocs = await getVectorStore().then(store =>
    store.similaritySearch(userMessage, 1)
  );

  if (!relevantDocs.length) {
    return {
      messages: [
        {
          text: "Je suis désolé, je n'ai pas trouvé d'informations pertinentes pour répondre à votre question.",
          facialExpression: "neutral",
          animation: "Idle"
        }
      ]
    };
  }

  const siteData = await fetchWebsiteData();
  const websiteChunk = siteData ? truncateText(siteData, Math.floor(maxContextTokens / 2)) : "";

  const contextChunks = relevantDocs
    .map(doc => truncateText(doc.pageContent, Math.floor(maxContextTokens / 2)))
    .filter(Boolean);

  const context = [...contextChunks, websiteChunk].join("\n---\n");

  const systemPrompt = `
Tu es Agathe, l’assistante commerciale de www.neemba.com.

🎯 Règles :
- Réponds uniquement à propos de Neemba
- Découpe ta réponse en 2 à 3 messages courts (1 à 2 phrases chacun)
- Ne dépasse pas 150 mots au total
- Formate tout en JSON (ne parle jamais en dehors du JSON)
- Structure JSON :

{
  "messages": [
    { "text": "Phrase 1.", "source": "", "image": "" },
    { "text": "Phrase 2.", "source": "", "image": "" }
  ]
}

🧠 Contexte :
${context}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 350,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const messages = parsed.messages || [];

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const facialExpression = await detectFacialExpression(msg.text);
        const animation = getAnimationForExpression(facialExpression);
        return { ...msg, facialExpression, animation };
      })
    );

    return { messages: enriched };
  } catch (err) {
    console.error("❌ RAG failure:", err);
    return {
      messages: [
        {
          text: "Erreur lors du traitement. Merci de réessayer.",
          facialExpression: "default",
          animation: "Idle"
        }
      ]
    };
  }
}
