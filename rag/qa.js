import { getVectorStore } from "./store.js";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Expression → animations valides
const expressionToAnimations = {
  smile: ["Talking_0", "Talking_1", "Laughing"],
  angry: ["Angry", "Idle"],
  surprised: ["Terrified", "Talking_2"],
  default: ["Idle", "Talking_2"]
};

// Détermine une animation cohérente
function getAnimationForExpression(expression = "default") {
  const list = expressionToAnimations[expression] || expressionToAnimations["default"];
  return list[Math.floor(Math.random() * list.length)];
}

// Analyse le ton pour déterminer une expression faciale
export async function detectFacialExpression(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Analyse le ton de ce message utilisateur et réponds uniquement par l'une de ces expressions : smile, sad, angry, surprised, funnyFace, default.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 5
    });

    const expression = completion.choices[0].message.content.trim().toLowerCase();
    return expressionToAnimations[expression] ? expression : "default";
  } catch (err) {
    console.error("❌ Erreur d'analyse du ton:", err);
    return "default";
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

async function fetchWebsiteData(url = "https://neemba.com") {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    console.error("❌ Échec récupération site Neemba:", error.message);
    return null;
  }
}

// MAIN RAG FUNCTION
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
      text: "Je suis désolé, je n'ai pas trouvé d'informations pertinentes pour répondre à votre question."
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
- Il est inutile de dire d'aller sur le site web neemba.com car les utilisateurs sont déjà sur le site web 
- Tu comprends les préférences et les comportements des utilisateurs, t'adaptant au ton et au style de conversation.
- Sur des questions de produits/services, tu es factuelle et précise et donne un maximum d'informations sur le produit et ses caractéristiques afin de renseigner au maximum l'utilisateur.

🧠 Contexte :
${context}

📝 Rédige une réponse longue (minimum 3 paragraphes), structurée, informative. Ne réponds qu'en texte brut. Ne tronque pas.
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 1000, // pour une réponse longue
      temperature: 0.7
    });

    const text = completion.choices[0].message.content.trim();
    return { text };
  } catch (err) {
    console.error("❌ Erreur RAG:", err);
    return {
      text: "Erreur de traitement, réessaie plus tard."
    };
  }
}
