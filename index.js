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
        const mp3Path = `./audios/message_${id}.mp3`;
        const jsonPath = `./audios/message_${id}.json`;
    
        try {
          console.log(`🎤 Generating speech for message ${i}...`);
          await generateSpeechWithStreaming(msg.text, mp3Path);
    
          console.log(`👄 Starting lipsync for message ${i}...`);
          await lipSyncMessage(id);
    
          console.log(`📤 Converting audio to base64...`);
          const audioBase64 = await audioFileToBase64(mp3Path);
    
          console.log(`📖 Reading lipsync JSON...`);
          const lipsyncData = await readJsonTranscript(jsonPath);
    
          return {
            ...msg,
            audio: audioBase64,
            lipsync: lipsyncData,
          };
        } catch (err) {
          console.error(`❌ Audio/lipsync processing failed for message ${i}:`, err.message);
          return {
            ...msg,
            audio: null,
            lipsync: null,
            error: err.message || "Unknown error"
          };
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
