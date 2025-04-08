// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import { answerWithRAG } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";
import {
  generateSpeechWithStreaming,
  lipSyncMessage,
  audioFileToBase64,
  readJsonTranscript,
} from "./lib/audioUtils.js";

// Définir __dirname en ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger .env
dotenv.config();

const app = express();
const port = process.env.PORT || 8080;

// 🔐 CORS
app.use(cors({
  origin: ["https://neemba-frontend.vercel.app", "http://localhost:3000"],
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

app.use(express.json());

// 🔊 Dossier audios
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });
app.use("/audios", express.static(audiosPath));

// ✅ Healthcheck
app.get("/", (_, res) => {
  res.send("✅ Neemba backend is running.");
});

// 🧠 Endpoint principal POST /chat
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) return res.status(400).json({ error: "Missing message." });

  try {
    const ragResponse = await answerWithRAG(userMessage);
    const messages = ragResponse.messages || [];

    const processedMessages = await Promise.all(
      messages.map(async (msg, i) => {
        const id = `${Date.now()}_${i}`;
        const mp3 = path.join(audiosPath, `message_${id}.mp3`);
        const json = path.join(audiosPath, `message_${id}.json`);

        try {
          await generateSpeechWithStreaming(msg.text, mp3);
          await lipSyncMessage(id);
          const audioBase64 = await audioFileToBase64(mp3);
          const lipsyncData = await readJsonTranscript(json);

          return { ...msg, audio: audioBase64, lipsync: lipsyncData };
        } catch (err) {
          console.error("❌ Audio processing failed:", err.message);
          return { ...msg, audio: null, lipsync: null, error: err.message };
        }
      })
    );

    res.json({ messages: processedMessages });
  } catch (err) {
    console.error("❌ Error in /chat:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// 🚀 Lancement + ingestion RAG
const startServer = async () => {
  try {
    console.log("⚙️ Ingesting documents...");
    await ingestDocuments();
    console.log("📚 Ingestion done.");

    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
};

startServer();
