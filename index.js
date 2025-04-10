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

// Load env variables
dotenv.config();

// Validate Rhubarb + FFmpeg presence
try {
  const rhubarbPath = execSync("which rhubarb").toString().trim();
  console.log("✅ Rhubarb is at:", rhubarbPath);
  const rhubarbVersion = execSync("rhubarb --version").toString().trim();
  console.log("✅ Rhubarb version:", rhubarbVersion);
} catch (err) {
  console.warn("⚠️ Rhubarb not found. Lip sync might fail.");
}

try {
  const ffmpegPath = execSync("which ffmpeg").toString().trim();
  console.log("✅ FFmpeg is at:", ffmpegPath);
} catch (err) {
  console.warn("⚠️ FFmpeg not found. Audio conversion might fail.");
}

// Prepare audio directory
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });
console.log("📂 'audios/' directory is ready");

// Init express
const app = express();
const port = process.env.PORT || 8080;

// CORS for Vercel + local dev
app.use(cors({
  origin: [
    "https://neemba-frontend.vercel.app",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

// JSON parsing
app.use(express.json());

// Logger middleware (debug)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Serve audio statically
app.use("/audios", express.static(audiosPath));

// Health check
app.get("/", (req, res) => {
  res.send("✅ Neemba backend is running.");
});

// Optional test GET /chat
app.get("/chat", (req, res) => {
  res.send("🟢 POST /chat endpoint is ready.");
});

// Main chat endpoint
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

// Launch server after ingestion
const startServer = async () => {
  try {
    console.log("⚙️ Ingesting documents...");
    await ingestDocuments();
    console.log("📚 Documents ingested successfully.");

    app.listen(8080, "0.0.0.0", () => {
      console.log(`🚀 Neemba API listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Fatal error on startup:", err);
    process.exit(1);
  }
};

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "✅ Neemba backend is healthy.",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

startServer();
