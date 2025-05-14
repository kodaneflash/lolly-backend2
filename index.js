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
// Log environment variables - Both Azure and ElevenLabs
console.log("🔐 AZURE VOICE:", process.env.AZURE_SPEECH_VOICE);
console.log("🔐 AZURE REGION:", process.env.AZURE_SPEECH_REGION);
console.log("🔐 ELEVENLABS API KEY:", process.env.ELEVEN_LABS_API_KEY ? "✅ Set" : "❌ Missing");
console.log("🔐 ELEVENLABS VOICE ID:", process.env.ELEVEN_LABS_VOICE_ID || "Using default");

// Audio folder
const audiosPath = path.resolve(__dirname, "audios");
await fs.mkdir(audiosPath, { recursive: true });

// Init express
const app = express();
const port = process.env.PORT || 3000;

// Get allowed origins from environment variables or use default
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ["https://lolly.gg", "https://www.lolly.gg"];
  
console.log("🔒 CORS allowed origins:", allowedOrigins);

// CORS configuration
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use("/audios", express.static(audiosPath));

// Logs
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.url}`);
  next();
});

// Healthcheck
app.get("/", (_, res) => res.send("✅ Lolly AI backend is running."));
app.get("/health", (_, res) =>
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

// Map Rhubarb lipsync shapes to Ready Player Me ARKit blend shapes
function mapRhubarbToARKit(mouthCues) {
  if (!mouthCues || !Array.isArray(mouthCues)) {
    console.warn("⚠️ Invalid mouthCues data provided to mapRhubarbToARKit");
    return { mouthCues: [] };
  }

  // Mapping from Rhubarb mouth shapes to ARKit blend shapes
  // Reference: https://docs.readyplayer.me/ready-player-me/api-reference/avatars/morph-targets/apple-arkit
  const rhubarbToARKit = {
    'X': { // Closed mouth (neutral)
      mouthOpen: 0.0,
      mouthClose: 1.0,
      jawOpen: 0.0,
    },
    'A': { // Closed mouth
      mouthOpen: 0.0,
      mouthClose: 1.0,
      jawOpen: 0.0,
    },
    'B': { // Slightly open mouth with teeth closed
      jawOpen: 0.2,
      mouthOpen: 0.25,
      mouthClose: 0.5,
    },
    'C': { // Open mouth for "eh" sounds
      jawOpen: 0.4,
      mouthOpen: 0.5,
      mouthClose: 0.0,
    },
    'D': { // Wide open mouth
      jawOpen: 0.8,
      mouthOpen: 0.8,
      mouthClose: 0.0,
    },
    'E': { // Slightly rounded mouth
      jawOpen: 0.3,
      mouthOpen: 0.4,
      mouthPucker: 0.5,
    },
    'F': { // Puckered lips
      mouthPucker: 1.0,
      mouthOpen: 0.2,
    },
    'G': { // Upper teeth touching lower lip
      mouthOpen: 0.3,
      jawOpen: 0.2,
      mouthLowerDownLeft: 0.5,
      mouthLowerDownRight: 0.5,
    },
    'H': { // L sound, tongue up
      mouthOpen: 0.4,
      jawOpen: 0.3,
      tongueOut: 0.3,
    }
  };

  // Go through each mouth cue and convert it to ARKit blend shapes
  const enhancedMouthCues = mouthCues.map(cue => {
    const blendShapes = rhubarbToARKit[cue.value] || rhubarbToARKit['X'];
    return {
      ...cue,
      blendShapes  // Add ARKit blend shape values
    };
  });

  console.log(`✅ Mapped ${mouthCues.length} Rhubarb cues to ARKit blend shapes`);
  return { mouthCues: enhancedMouthCues };
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const engine = req.body.engine || "elevenlabs"; // "azure" ou "elevenlabs"
    if (!userMessage) return res.status(400).json({ error: "Missing message." });

    console.log(`🎙️ Using TTS engine: ${engine}`);
    
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

            // Map Rhubarb mouth shapes to ARKit blend shapes 
            const enhancedLipsyncData = mapRhubarbToARKit(lipsyncData.mouthCues);
            cues = enhancedLipsyncData.mouthCues;
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
      console.log(`🚀 Lolly AI backend listening on port ${port}`);
    });
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
};

startServer();
