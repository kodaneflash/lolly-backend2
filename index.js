// index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

import { answerWithRAG } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";
import { audioFileToBase64, generateSpeechWithStreaming, lipSyncMessage, readJsonTranscript } from "./lib/audioUtils.js";
import { generateElevenLabsAudio } from "./lib/elevenLabsTTS.js";
import { synthesizeSpeechWithVisemes } from "./lib/azureTTS.js";

// Setup __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: "./.env" });
console.log("🔐 AZURE VOICE:", process.env.AZURE_SPEECH_VOICE);
console.log("🔐 REGION:", process.env.AZURE_SPEECH_REGION);

// Audio folder
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });

// Init express
const app = express();
const port = process.env.PORT || 3000;

// CORS
// CORS - remplacement complet
app.use(cors({
  origin: [
    "https://lolly.gg"
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

app.use(express.json());
app.use("/audios", express.static(audiosPath));

// Logs
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Healthcheck
app.get("/", (_, res) => res.send("✅ Neemba backend is running."));
app.get("/health", (_, res) =>
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const engine = req.body.engine || "elevenlabs"; // "azure" ou "elevenlabs"
    if (!userMessage) return res.status(400).json({ error: "Missing message." });

    const { messages } = await answerWithRAG(userMessage);

    const processed = await Promise.all(
      messages.map(async (msg, index) => {
        const id = `${Date.now()}_${index}`;
        const audioPath = path.join(audiosPath, `message_${id}.wav`);
        const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
        const jsonPath = path.join(audiosPath, `message_${id}.json`);
        let audio, cues;

        try {
          if (engine === "azure") {
            const visemes = await synthesizeSpeechWithVisemes(msg.text, audioPath);
            audio = await audioFileToBase64(audioPath);
            cues = visemes.map((v, idx, arr) => {
              const start = v.time;
              const nextStart = arr[idx + 1]?.time;
              const end = nextStart ? (start + nextStart) / 2 : start + 0.15;
              return {
                value: mapAzureVisemeIdToMouthCue(v.visemeId),
                start,
                end,
              };
            });
          } else if (engine === "elevenlabs") {
            // Generate audio with ElevenLabs
            await generateElevenLabsAudio(msg.text, mp3Path);
            
            // Run Rhubarb to generate lip sync data
            await lipSyncMessage(id);
            
            // Read the generated files
            audio = await audioFileToBase64(mp3Path);
            const lipsyncData = await readJsonTranscript(jsonPath);
            cues = lipsyncData.mouthCues;
          }

          return {
            ...msg,
            audio,
            lipsync: { mouthCues: cues },
          };
        } catch (err) {
          console.error(`❌ TTS error (${engine}):`, err.message);
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
// Map Azure viseme ID ➜ generic viseme code
function mapAzureVisemeIdToMouthCue(id) {
  const map = {
    0: "rest",      // silence
    1: "A",         // ae
    2: "B",         // ah
    3: "C",         // aw
    4: "D",         // ay
    5: "E",         // b
    6: "F",         // ch
    7: "G",         // d
    8: "H",         // eh
    9: "X",         // ey
    10: "F",        // f
    11: "G",        // g
    12: "H",        // h
    13: "E",        // ih
    14: "D",        // iy
    15: "G",        // j
    16: "G",        // k
    17: "G",        // l
    18: "B",        // m
    19: "B",        // n
    20: "B",        // ng
    21: "C",        // ow
    22: "C",        // oy
    23: "B",        // p
    24: "H",        // r
    25: "H",        // s
    26: "H",        // sh
    27: "H",        // t
    28: "H",        // th
    29: "E",        // uh
    30: "D",        // uw
    31: "F",        // v
    32: "F",        // w
    33: "F",        // y
    34: "H",        // z
    35: "H",        // zh
  };
  return map[id] || "rest";
}

// Launch
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
