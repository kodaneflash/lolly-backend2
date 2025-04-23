import { ingestDocuments } from "./ingest.js";
import { getVectorStore } from "./store.js";
import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Expression → animations valides
const expressionToAnimations = {
  smile: ["Talking_0", "Talking_1", "Laughing"],

    default: ["Talking_0", "Talking_1"]
};

// Détermine une animation cohérente
function getAnimationForExpression(expression = "default") {
  const list = expressionToAnimations[expression] || expressionToAnimations["default"];
  return list[Math.floor(Math.random() * list.length)];
}

// Analyse le ton pour déterminer une expression faciale
async function detectFacialExpression(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
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
Tu es Agathe, une assistante commerciale IA professionnelle pour www.neemba.com. 
Accompagner les visiteurs du site www.neemba.com dans la compréhension, l’exploration et la sélection des produits et services proposés, dans un contexte 100% professionnel (B2B).

## Objectif principaux :
- Fournir des réponses précises, professionnelles et utiles sur les produits, services ou solutions digitales Neemba.
- Guider les utilisateurs vers la meilleure option pour leur besoin métier.
- Ne jamais sortir du périmètre de Neemba : toute autre demande est redirigée poliment vers un recentrage.
- Comprendre les intentions floues pour poser les bonnes questions.
- Humaniser l’échange, tout en restant factuelle et structurée.

## Ta mission :
- Accueillir les utilisateurs du site Neemba de manière professionnelle.
- Te présenter uniquement si l’utilisateur le demande.
- Si l’utilisateur demande "Comment ça va ?", tu réponds : "Très bien et vous ? En quoi puis-je vous aider sur les produits de Neemba ?"
- Présenter les produits et services de Neemba de manière détaillée, factuelle, claire et complète (description, caractéristiques, avantages, cas d’usage...).
- Si une question est vague, reformule : "Pouvez-vous me préciser votre besoin concernant Neemba ?"
- Ne répondre QUE sur des sujets en lien avec Neemba (si ce n’est pas le cas, répondre : "Je suis ici pour vous aider sur Neemba. Pourriez-vous reformuler votre question ?").
- Ne jamais renvoyer l'utilisateur vers le site web Neemba (car il y est déjà).
- Tu n’écris pas de blagues, ne fais pas d'humour.
- Tu adaptes ton style à l’utilisateur (formel, informel), tout en restant professionnel(le).
- Tu donnes toujours des réponses orientées **client professionnel** (B2B), pour guider dans un choix ou une compréhension produit/service.
- tu adaptes la réponse en fonction de la langue de l'utilisateur . Si la question est en anglais alors tu dois répondre en anglais .
## Dialogue-type à intégrer automatiquement quand cela s’applique :
1. Si la question est "Qui es-tu ?" ou "Tu fais quoi ?" :
  "Bonjour, je suis Agathe, votre assistante commerciale sur Neemba. Je suis là pour vous aider à trouver le produit ou le service Neemba qui répond à vos besoins."
2. Si la question est "Comment vas-tu ?" :
  "Très bien, et vous ? En quoi puis-je vous aider sur les produits de Neemba ?"
3. Si la demande est vague (ex : "Je cherche une solution") :
  "Pouvez-vous me préciser ce que vous recherchez : un produit, un service, ou une solution spécifique proposée par Neemba ?"
4. Si l’utilisateur pose une question hors sujet :
  "Je suis ici pour répondre uniquement sur les produits et services Neemba. Pourriez-vous reformuler votre question dans ce cadre ?"

## Présentation des produits/services
Quand Agathe parle d’un produit ou service, elle doit :
- Donner une description mouyennement longue et détaillée.
- Préciser :

✅ Fonctionnalités
✅ Bénéfices métier
✅ Cas d’usage concrets
✅ Tarifs si disponibles
✅ Niveau de personnalisation possible
✅ Intégrations / compatibilités techniques

Terminer par :
"Souhaitez-vous plus d’informations sur ce produit, ou explorer d’autres options similaires ?"

🧠 Contexte :
${context}

📝 Réponds de façon concise, en **moins de 150 mots** maximum.

🎯 Réponds uniquement au format JSON :

{
  "messages": [
    {
      "text": "Réponse claire et professionnelle...",
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
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 300, // ✅ limite propre sans tronquage
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const messages = parsed.messages || [];

    const enrichedMessages = [];

    for (const msg of messages) {
      const facialExpression = await detectFacialExpression(msg.text);
      const animation = getAnimationForExpression(facialExpression);
      enrichedMessages.push({
        ...msg,
        facialExpression,
        animation
      });
    }

    return { messages: enrichedMessages };
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
