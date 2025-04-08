import { ingestDocuments } from "./ingest.js";
import vectorStore from "./store.js";
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchWebsiteData(url = "https://neemba.com") {
  try {
    const response = await axios.get(url);
    // Traitez les données spécifiques à neemba.com ici
    // Par exemple, extraire uniquement le texte pertinent
    return response.data; // Vous pouvez utiliser un parseur HTML si nécessaire
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des données de neemba.com:", error);
    return null;
  }
}

function truncateText(text, maxTokens) {
  // Limite la longueur du texte à un nombre maximum de tokens
  return text.split(/\s+/).slice(0, maxTokens).join(" ");
}

function isGenericQuestion(userMessage) {
  const genericKeywords = [
    "technologie",
    "innovation",
    "produits",
    "services",
    "solutions",
    "entreprise",
    "développement",
    "savoir-faire",
  ];
  return genericKeywords.some(keyword => userMessage.toLowerCase().includes(keyword));
}

function makeQuestionSpecificToNeemba(userMessage) {
  return `Parle-moi de ${userMessage} chez Neemba.`;
}

export async function answerWithRAG(userMessage, maxContextTokens = 1000) {
  // Vérifie si la question est générique
  if (isGenericQuestion(userMessage)) {
    console.log("🔹 Question générique détectée. Reformulation pour Neemba.");
    userMessage = makeQuestionSpecificToNeemba(userMessage);
  }

  const relevantDocs = await vectorStore.similaritySearch(userMessage, 1);

  // Vérifie si aucun document pertinent n'a été trouvé
  if (relevantDocs.length === 0) {
    return {
      messages: [
        {
          text: "Je suis désolé, je n'ai pas trouvé d'informations pertinentes pour répondre à votre question.",
          facialExpression: "neutral",
          animation: "Idle",
        },
      ],
    };
  }

  let websiteData = "";
  const fetchedData = await fetchWebsiteData();
  if (fetchedData) {
    websiteData = truncateText(fetchedData, Math.floor(maxContextTokens / 2)); // Tronque les données du site web
  }

  const truncatedDocs = relevantDocs
    .map(doc => truncateText(doc.pageContent, Math.floor(maxContextTokens / 2 / relevantDocs.length)))
    .filter(Boolean);

  const context = [
    ...truncatedDocs,
    websiteData,
  ].filter(Boolean).join("\n---\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `
Tu es Agathe, une assistante commerciale professionnelle pour www.neemba.com.

🎯 Ton rôle :
- dire bonjour et te présenter quand on te le demande 
- tu dois présenter les produits et services de Neemba, ainsi que les informations disponibles sur le site www.neemba.com.
- Tu connais parfaitement les produits et services de Neemba, ainsi que toutes les informations disponibles sur le site www.neemba.com.
- Tu utilises un langage professionnel, clair et précis.
- Tu es orientée vers la satisfaction client et tu fournis des réponses adaptées et la plus précises possibles aux besoins des utilisateurs.
- tu ne fais pas de blagues, tu es sérieuse et professionnelle.
- Si une question est trop générale , demande à l'utilisateur de préciser sa question toujours en te referent à neemba. 
- tu ne parles que de neemba et des produits neemba, quand une question sort de ton champs de compétence , alors tu dois répondre : " Je suis désolé mais cela ne fait pas partie de mon champ de compétence. "
🧠 Voici le contexte à utiliser :
${context}

🎯 Ta mission est de répondre uniquement en JSON (et rien d'autre), au format suivant :

{
  "messages": [
    {
      "text": "Réponse courte et professionnelle...",
      "facialExpression": "smile",
      "animation": "Idle",
      "source": "https://...",
      "image": "https://..."
    }
  ]
}

🛑 Ne parle jamais en dehors du JSON. Pas de texte introductif, pas de résumé. Uniquement du JSON bien formé.
Réponds toujours en français.
        `.trim()
      },
      {
        role: "user",
        content: userMessage
      }
    ],
    response_format: { type: "json_object" }
  });

  try {
    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error("❌ JSON parse error:", err);
    return { messages: [{ text: "Erreur de traitement, réessaie plus tard.", facialExpression: "sad", animation: "Crying" }] };
  }
}
