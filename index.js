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
import { splitTextIntoChunks } from "./lib/textUtils.js";

// Setup __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({ origin: ["http://localhost:3000", "https://neemba-frontend.vercel.app"] }));
app.use(express.json());
app.use("/audios", express.static(audiosPath));

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

app.get("/", (_, res) => res.send("✅ Neemba backend is running."));

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    if (!userMessage) return res.status(400).json({ error: "Missing message." });

    console.log("🧠 Génération via RAG...");
    const { text } = await answerWithRAG(userMessage);

    const chunks = splitTextIntoChunks(text, 400);

    const processed = await Promise.all(
      chunks.map(async (chunk, index) => {
        const id = `${Date.now()}_${index}`;
        const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
        const jsonPath = path.join(audiosPath, `message_${id}.json`);

        try {
          await generateSpeechWithStreaming(chunk, mp3Path);
          await lipSyncMessage(id);
          const audio = await audioFileToBase64(mp3Path);
          const lipsync = await readJsonTranscript(jsonPath);

          const facialExpression = getRandomExpression();
          const animation = getAnimationForExpression(facialExpression);

          return {
            text: chunk,
            facialExpression,
            animation,
            audio,
            lipsync
          };
        } catch (err) {
          console.error(`❌ Processing failed for message_${id}:`, err.message);
          return { text: chunk, audio: null, lipsync: null, error: err.message };
        }
      })
    );

    res.status(200).json({ messages: processed });
  } catch (err) {
    console.error("❌ Internal error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

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

function getRandomExpression() {
  const expressions = Object.keys(expressionToAnimations);
  return expressions[Math.floor(Math.random() * expressions.length)];
}

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
