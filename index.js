// index.js

import { execSync } from "child_process";
console.log("📍 Rhubarb binary check:", execSync("which rhubarb").toString());


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

// Charger les variables d’environnement
dotenv.config();

// Créer le dossier audios
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });
console.log("📂 'audios/' directory is ready");

// Initialisation Express
const app = express();
const port = process.env.PORT || 8080;

// ✅ CORS : accepte appels de Vercel + localhost
app.use(cors({
  origin: [
    "https://neemba-frontend.vercel.app",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// Middleware JSON
app.use(express.json());

// ✅ Sert les fichiers audio statiquement
app.use("/audios", express.static(audiosPath));

// ➤ Health check
app.get("/", (req, res) => {
  res.send("✅ Neemba backend is running.");
});

// ➤ Test GET /chat (debug)
app.get("/chat", (req, res) => {
  res.send("🟢 POST /chat endpoint is ready.");
});

// ➤ POST /chat — endpoint principal
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: "Missing message." });
    }

    console.log("🧠 Calling RAG...");
    const ragResponse = await answerWithRAG(userMessage);
    const messages = ragResponse.messages || [];

    const processedMessages = await Promise.all(
      messages.map(async (msg, i) => {
        const id = `${Date.now()}_${i}`;
        const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
        const jsonPath = path.join(audiosPath, `message_${id}.json`);

        try {
          await generateSpeechWithStreaming(msg.text, mp3Path);
          await lipSyncMessage(id);

          const audioBase64 = await audioFileToBase64(mp3Path);
          const lipsyncData = await readJsonTranscript(jsonPath);

          return {
            ...msg,
            audio: audioBase64,
            lipsync: lipsyncData,
          };
        } catch (err) {
          console.error(`❌ Audio processing failed (msg ${i}):`, err.message);
          return { ...msg, audio: null, lipsync: null, error: err.message };
        }
      })
    );

    res.status(200).json({ messages: processedMessages });
  } catch (err) {
    console.error("❌ Server-level error in /chat:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// ➤ Démarrage serveur après ingestion
const startServer = async () => {
  try {
    console.log("⚙️ Ingesting documents...");
    await ingestDocuments();
    console.log("📚 Documents ingested successfully.");

    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 Neemba API listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Fatal error on startup:", err);
    process.exit(1);
  }
};

startServer();
