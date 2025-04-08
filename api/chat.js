// api/chat.js
import { answerWithRAG } from "../rag/qa.js";
import {
  generateSpeechWithStreaming,
  lipSyncMessage,
  audioFileToBase64,
  readJsonTranscript,
  ensureAudiosDirectory,
} from "../lib/audioUtils.js";

export default async function handler(req, res) {
  // ✅ CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://neemba-frontend.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Preflight response
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = await getBody(req);
    const userMessage = body.message;

    if (!userMessage) {
      return res.status(400).json({ error: "Missing message." });
    }

    await ensureAudiosDirectory();
    const ragResponse = await answerWithRAG(userMessage);
    const messages = ragResponse.messages;

    const processed = await Promise.all(
      messages.map(async (msg, i) => {
        const id = `${Date.now()}_${i}`;
        const mp3 = `./audios/message_${id}.mp3`;
        const json = `./audios/message_${id}.json`;

        try {
          await generateSpeechWithStreaming(msg.text, mp3);
          await lipSyncMessage(id);

          return {
            ...msg,
            audio: await audioFileToBase64(mp3),
            lipsync: await readJsonTranscript(json),
          };
        } catch (err) {
          console.error("Audio processing failed:", err);
          return { ...msg, audio: null, lipsync: null };
        }
      })
    );

    return res.status(200).json({ messages: processed });
  } catch (err) {
    console.error("Handler Error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}

// Helper: Lire le corps d'une requête POST en serverless
async function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
  });
}
