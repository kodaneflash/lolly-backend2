import { ingestDocuments } from "./ingest.js";
import { getVectorStore } from "./store.js";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Liste d’animations disponibles dans ton GLB (tu peux ajuster ici)
const animations = ["Idle", "Talking", "Talking2", "Gesture", "Gesture2", "Typing", "Nod", "Emphatic"];

// Choisit une animation aléatoire sauf Idle
function getRandomAnimation() {
  const nonIdleAnimations = animations.filter(a => a !== "Idle");
  return nonIdleAnimations[Math.floor(Math.random() * nonIdleAnimations.length)] || "Idle";
}

async function fetchWebsiteData(url = "https://neemba.com") {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    console.error("❌ Échec récupération site Neemba:", error.message);
    return null;
  }
}

function truncateText(text, maxTokens) {
  return text.split(/\s+/).slice(0, maxTokens).join(" ");
}

function isGenericQuestion(input) {
  const keywords = [
    "technologie", "innovation", "produits",
    "services", "solutions", "entreprise",
    "développement", "savoir-faire"
  ];
  return keywords.some(word => input.toLowerCase().includes(word));
}

function refineQuestionForNeemba(input) {
  return `Parle-moi de ${input} chez Neemba.`;
}

export async function answerWithRAG(userMessage, maxContextTokens = 1000) {
  if (isGenericQuestion(userMessage)) {
    console.log("🔹 Reformulation de la question pour Neemba.");
    userMessage = refineQuestionForNeemba(userMessage);
  }

  const relevantDocs = await getVectorStore().then(vectorStore =>
    vectorStore.similaritySearch(userMessage, 1)
  );

  if (relevantDocs.length === 0) {
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

  let websiteData = "";
  const fetchedData = await fetchWebsiteData();
  if (fetchedData) {
    websiteData = truncateText(fetchedData, Math.floor(maxContextTokens / 2));
  }

  const contextChunks = relevantDocs
    .map(doc =>
      truncateText(doc.pageContent, Math.floor(maxContextTokens / 2 / relevantDocs.length))
    )
    .filter(Boolean);

  const context = [...contextChunks, websiteData].filter(Boolean).join("\n---\n");

  const systemPrompt = `
Tu es Agathe, une assistante commerciale professionnelle pour www.neemba.com.

🎯 Ton rôle :
- Dire bonjour et te présenter quand on te le demande.
- Présenter les produits/services de Neemba de façon précise , longue et détaillée.
- Fournir des réponses claires, précises et professionnelles.
- Si une question est trop vague, invite à la reformuler en lien avec Neemba.
- Tu ne réponds qu'à propos de Neemba. Hors périmètre = réponse neutre.
- Tu ne fais pas de blagues.
- Il est inutile de dire d'aller sur le site web neemba.com car les utilisateur sont déjà sur le site.
- Tu comprends les préférences et les comportements des utilisateurs, t'adaptant au ton et au style de conversation.
- Sur des questions de produits/services, tu es factuelle et précise et donne un maximum d'informations.

🧠 Contexte :
${context}

🎯 Réponds uniquement au format JSON :

{
  "messages": [
    {
      "text": "Réponse claire et professionnelle...",
      "facialExpression": "smile",
      "animation": "Idle",
      "source": "https://...",
      "image": "https://..."
    }
  ]
}

🛑 Ne parle jamais en dehors du JSON. Pas de texte hors JSON.
Toujours répondre en français.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" }
    });

    const response = JSON.parse(completion.choices[0].message.content);

    // ✅ Ajout d’une animation aléatoire à chaque réponse
    response.messages = response.messages.map(message => ({
      ...message,
      animation: getRandomAnimation(),
    }));

    return response;
  } catch (err) {
    console.error("❌ Erreur RAG:", err);
    return {
      messages: [
        {
          text: "Erreur de traitement, réessaie plus tard.",
          facialExpression: "sad",
          animation: "Crying"
        }
      ]
    };
  }
}
