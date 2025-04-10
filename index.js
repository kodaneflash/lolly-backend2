// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

import { answerWithRAG } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";
import {
  generateSpeechWithStreaming,
  lipSyncMessage,
  audioFileToBase64,
  readJsonTranscript,
} from "./lib/audioUtils.js";

// Setup __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config();

// Ensure binaries are available
try {
  const rhubarbPath = execSync("which rhubarb").toString().trim();
  console.log("✅ Rhubarb is at:", rhubarbPath);
} catch (err) {
  console.warn("⚠️ Rhubarb not found.");
}

try {
  const ffmpegPath = execSync("which ffmpeg").toString().trim();
  console.log("✅ FFmpeg is at:", ffmpegPath);
} catch (err) {
  console.warn("⚠️ FFmpeg not found.");
}

// Audio dir
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });

// Express setup
const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: ["http://localhost:3000", "https://neemba-frontend.vercel.app"],
}));
app.use(express.json());
app.use("/audios", express.static(audiosPath));

// Logs
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Health
app.get("/", (_, res) => res.send("✅ Neemba backend is running."));
app.get("/health", (_, res) =>
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

// Main POST /chat endpoint
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: "Missing message." });
    }

    console.log("🧠 Génération via RAG...");
    const { messages } = await answerWithRAG(userMessage);

    const processed = await Promise.all(
      messages.map(async (msg, index) => {
        const id = `${Date.now()}_${index}`;
        const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
        const jsonPath = path.join(audiosPath, `message_${id}.json`);

        try {
          await generateSpeechWithStreaming(msg.text, mp3Path);
          await lipSyncMessage(id);
          const audio = await audioFileToBase64(mp3Path);
          const lipsync = await readJsonTranscript(jsonPath);

          return { ...msg, audio, lipsync };
        } catch (err) {
          console.error(`❌ Processing failed for msg ${id}:`, err.message);
          return { ...msg, audio: null, lipsync: null, error: err.message };
        }
      })
    );

    res.status(200).json({ messages: processed });
  } catch (err) {
    console.error("❌ Internal error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// Start server after ingestion
const startServer = async () => {
  try {
    console.log("📚 Ingesting documents...");
    await ingestDocuments();
    console.log("✅ Documents ready.");

    app.listen(port, () => {
      console.log(`🚀 Neemba API listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
};

startServer();
