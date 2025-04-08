// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { answerWithRAG } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";
import {
  generateSpeechWithStreaming,
  lipSyncMessage,
  audioFileToBase64,
  readJsonTranscript,
  ensureAudiosDirectory,
} from "./lib/audioUtils.js";

// Init
dotenv.config();
await ingestDocuments();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static audio files
app.use("/audios", express.static("audios"));

// Chat route
app.post("/chat", async (req, res) => {
  await ensureAudiosDirectory();
  const userMessage = req.body.message;

  if (!userMessage) return res.status(400).json({ error: "Missing message." });

  try {
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

    res.json({ messages: processed });
  } catch (error) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Start local server only when not on Vercel
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 API running locally at http://localhost:${port}`);
  });
}

export default app;
