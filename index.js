// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

import { answerWithRAG, detectFacialExpression } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";
import {
  generateSpeechWithStreaming,
  lipSyncMessage,
  audioFileToBase64,
  readJsonTranscript,
} from "./lib/audioUtils.js";
import { splitTextIntoChunks } from "./lib/textUtils.js";

// Setup __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: ["http://localhost:3000", "https://neemba-frontend.vercel.app"]
}));
app.use(express.json());
app.use("/audios", express.static(audiosPath));

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Santé
app.get("/", (_, res) => res.send("✅ Neemba backend is running."));

// SSE streaming endpoint
app.get("/chat-stream", async (req, res) => {
  const userMessage = req.query.message;
  if (!userMessage) return res.status(400).send("Missing message");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    console.log("🧠 Génération via RAG...");
    const { text } = await answerWithRAG(userMessage);
    const chunks = splitTextIntoChunks(text, 350);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const id = `${Date.now()}_${i}`;
      const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
      const jsonPath = path.join(audiosPath, `message_${id}.json`);

      try {
        await generateSpeechWithStreaming(chunk, mp3Path);
        await lipSyncMessage(id);
        const audio = await audioFileToBase64(mp3Path);
        const lipsync = await readJsonTranscript(jsonPath);

        const facialExpression = await detectFacialExpression(chunk);
        const animation = getAnimationForExpression(facialExpression);

        const payload = {
          index: i,
          text: chunk,
          facialExpression,
          animation,
          audio,
          lipsync
        };

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        console.error(`❌ Chunk ${i} failed:`, err.message);
        res.write(`data: ${JSON.stringify({ index: i, error: err.message })}\n\n`);
      }
    }

    res.write("event: end\ndata: done\n\n");
    res.end();
  } catch (err) {
    console.error("❌ Fatal stream error:", err.message);
    res.write(`event: error\ndata: ${err.message}\n\n`);
    res.end();
  }
});

// Utilitaires animations
const expressionToAnimations = {
  smile: ["Talking_0", "Talking_1", "Laughing"],
  angry: ["Angry", "Idle"],
  surprised: ["Terrified", "Talking_2"],
  default: ["Idle", "Talking_2"]
};

function getAnimationForExpression(expression = "default") {
  const list = expressionToAnimations[expression] || expressionToAnimations.default;
  return list[Math.floor(Math.random() * list.length)];
}

// Démarrage
const startServer = async () => {
  try {
    console.log("📚 Ingesting documents...");
    await ingestDocuments();
    console.log("✅ Documents ready.");
    app.listen(port, () => console.log(`🚀 API on http://localhost:${port}`));
  } catch (err) {
    console.error("❌ Startup error:", err);
    process.exit(1);
  }
};

startServer();
