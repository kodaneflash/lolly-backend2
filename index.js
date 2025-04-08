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


dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware CORS autorisant toutes les origines (pour EB et tests)
// Middleware CORS autorisant toutes les origines (à sécuriser ensuite)
app.use(cors({
  origin: ["https://neemba-frontend.vercel.app"],
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(express.json());

// Serve les fichiers audio statiquement
app.use("/audios", express.static("audios"));

// Endpoint de test pour Elastic Beanstalk
app.get("/", (req, res) => {
  res.send("✅ Neemba backend is running.");
});

// Endpoint principal
app.post("/chat", async (req, res) => {
  try {
    await ensureAudiosDirectory();

    const userMessage = req.body.message;
    if (!userMessage) {
      return res.status(400).json({ error: "Missing message." });
    }

    const ragResponse = await answerWithRAG(userMessage);
    const messages = ragResponse.messages;

    const processedMessages = await Promise.all(
      messages.map(async (msg, i) => {
        const id = `${Date.now()}_${i}`;
        const mp3 = `./audios/message_${id}.mp3`;
        const json = `./audios/message_${id}.json`;

        try {
          await generateSpeechWithStreaming(msg.text, mp3);
          await lipSyncMessage(id);

          const audioBase64 = await audioFileToBase64(mp3); // Read the audio file as base64
          const lipsyncData = await readJsonTranscript(json);

          return {
            ...msg,
            audio: audioBase64,
            lipsync: lipsyncData,
          };
        } catch (err) {
          console.error("❌ Audio processing failed:", err); // Improved error logging
          return { ...msg, audio: null, lipsync: null };
        }
      })
    );

    res.status(200).json({ messages: processedMessages });
  } catch (error) {
    console.error("❌ Chat endpoint error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Démarrage de l'API avec ingestion de documents
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
