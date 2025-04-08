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
// Ajoute ça immédiatement après app = express();
app.use(cors({
  origin: "https://neemba-frontend.vercel.app",
  methods: ["GET", "POST"],
  credentials: true
}));

const port = process.env.PORT || 3000;



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
        const mp3 = `./audios/message_${id}.mp3`;
        const json = `./audios/message_${id}.json`;

        try {
          await generateSpeechWithStreaming(msg.text, mp3);
          await lipSyncMessage(id);

          const audioBase64 = await audioFileToBase64(mp3);
          const lipsyncData = await readJsonTranscript(json);

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
