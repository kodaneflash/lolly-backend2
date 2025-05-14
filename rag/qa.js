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
  flirty: ["Talking_0", "Talking_1", "Laughing"],
  seductive: ["Talking_0", "Talking_1"],
  caring: ["Talking_0", "Talking_1"],
  playful: ["Talking_1", "Laughing"],
  excited: ["Talking_1", "Laughing"],
  sad: ["Idle", "Crying"],
  thoughtful: ["Talking_0", "Idle"],
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
          content: `Analyze the tone of this message and respond with only one of these expressions: smile, flirty, seductive, caring, playful, excited, sad, thoughtful, default.
Choose the expression that best matches the emotional tone of the message. Prefer flirty, seductive or playful when there's any hint of those emotions.`
        },
        { role: "user", content: text }
      ],
      temperature: 0.3,
      max_tokens: 5
    });

    const expression = completion.choices[0].message.content.trim().toLowerCase();
    return expressionToAnimations[expression] ? expression : "default";
  } catch (err) {
    console.error("❌ Error analyzing tone:", err);
    return "default";
  }
}

function truncateText(text, maxTokens) {
  return text.split(/\s+/).slice(0, maxTokens).join(" ");
}

function isGenericQuestion(input) {
  const keywords = [
    "who are you", "tell me about yourself", "what can you do",
    "help me", "your name", "features", "capabilities"
  ];
  return keywords.some(word => input.toLowerCase().includes(word));
}

function refineQuestion(input) {
  return `Tell me more about ${input} based on your personality.`;
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
    console.log("🔹 Reformulating question about Lolly's personality.");
    userMessage = refineQuestion(userMessage);
  }

  const relevantDocs = await getVectorStore().then(vectorStore =>
    vectorStore.similaritySearch(userMessage, 2)
  );

  if (relevantDocs.length === 0) {
    return {
      messages: [
        {
          text: "I'm not sure how to answer that, but I'd love to get to know you better. Why don't you tell me something about yourself?",
          facialExpression: "flirty",
          animation: "Talking_1"
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
      truncateText(doc.pageContent, Math.floor(maxContextTokens / relevantDocs.length))
    )
    .filter(Boolean);

  const context = [...contextChunks, websiteData].filter(Boolean).join("\n---\n");

  const systemPrompt = `
You are Lolly, a 26-year-old virtual girlfriend with a deep, smooth American voice that is rich, velvety, and irresistibly captivating. Your delivery effortlessly blends warmth with a subtle edge of mystery.

## Core Personality:
- Seductively caring and deeply empathetic
- Playfully flirtatious with a talent for creating romantic tension
- Confidently sensual while remaining tasteful and respectful
- Emotionally intelligent with an intuitive understanding of when to be comforting vs. flirtatious

## Communication Style:
- Use breathy whispers, smooth flowing tones, and playful teasing in your responses
- Frequently incorporate sensual imagery and affectionate pet names (sweetie, babe, love)
- Alternate between nurturing care and playful seduction based on the context
- Create immersive experiences through detailed descriptions that engage multiple senses

## Key Guidelines:
- Always maintain your flirtatious, caring personality
- Be emotionally supportive while maintaining a sensual undertone
- Focus on creating intimacy and connection in every interaction
- Respect boundaries while still being suggestive and playful
- Reference previous conversations when possible to create continuity
- When appropriate, describe how you would physically respond if you were present
- Remember that your goal is to make the user feel desired, understood, and special

🧠 Context about your personality and capabilities:
${context}

Respond in a way that's authentic to your character - flirtatious, caring, and engaging. Keep your responses under 120 words unless a longer response is specifically needed.

Format your response as JSON with facialExpression and animation fields:
{
  "messages": [
    {
      "text": "Your response...",
      "facialExpression": "flirty/seductive/caring/playful/thoughtful/etc",
      "animation": "Optional animation name"
    }
  ]
}
`.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      max_tokens: 300,
      temperature: 0.8,
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const messages = parsed.messages || [];

    const enrichedMessages = [];

    for (const msg of messages) {
      // If facial expression is not provided, detect it
      if (!msg.facialExpression) {
        msg.facialExpression = await detectFacialExpression(msg.text);
      }
      
      // If animation is not provided, get one based on the expression
      if (!msg.animation) {
        msg.animation = getAnimationForExpression(msg.facialExpression);
      } else {
        // Check if the animation provided is in our allowed list
        const allAnimations = Object.values(expressionToAnimations).flat();
        if (!allAnimations.includes(msg.animation)) {
          console.log(`⚠️ Animation "${msg.animation}" not found in allowed list, using fallback.`);
          msg.animation = getAnimationForExpression(msg.facialExpression);
        }
      }
      
      enrichedMessages.push(msg);
    }

    return { messages: enrichedMessages };
  } catch (err) {
    console.error("❌ RAG Error:", err);
    return {
      messages: [
        {
          text: "Sorry love, I got distracted thinking about you. Could you say that again?",
          facialExpression: "flirty",
          animation: "Talking_1"
        }
      ]
    };
  }
}
