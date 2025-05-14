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
// Start with the origin that must always be allowed for direct IP access/testing
let dynamicOrigins = ["http://3.226.248.42:3000"];

if (process.env.ALLOWED_ORIGINS) {
  // If ALLOWED_ORIGINS is set in the environment, add them
  dynamicOrigins = dynamicOrigins.concat(process.env.ALLOWED_ORIGINS.split(','));
} else {
  // If no environment variable, add default production origins
  dynamicOrigins = dynamicOrigins.concat(["https://lolly.gg", "https://www.lolly.gg"]);
}

// Use a Set to ensure all origins are unique and then convert back to an array
const allowedOrigins = [...new Set(dynamicOrigins)];
  
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

// Map Rhubarb lipsync shapes to the format expected by the frontend
function mapRhubarbToVisemes(mouthCues) {
  if (!mouthCues || !Array.isArray(mouthCues)) {
    console.warn("⚠️ Invalid mouthCues data provided to mapRhubarbToVisemes");
    return { mouthCues: [] };
  }

  // Direct mapping from Rhubarb mouth shapes to viseme codes
  // This matches the frontend's expectation in Avatar.jsx (corresponding object)
  const mappedMouthCues = mouthCues.map(cue => {
    // We keep the original Rhubarb values (A, B, C, D, E, F, G, H, X)
    // as they will be mapped to viseme_XX in the frontend
    return {
      value: cue.value,
      start: cue.start,
      end: cue.end
    };
  });

  console.log(`✅ Processed ${mouthCues.length} Rhubarb cues`);
  return { mouthCues: mappedMouthCues };
}

// Detect emotion/sentiment from text to select appropriate facial expression
function detectEmotion(text) {
  const text_lower = text.toLowerCase();
  
  // Simple keyword-based emotion detection
  if (/\b(ha(ha)+|lol|funny|hilarious|joke|laughing)\b/i.test(text_lower)) {
    return "funnyFace";
  } else if (/\b(happy|excited|great|fantastic|wonderful|amazing|joy|smile)\b/i.test(text_lower)) {
    return "smile";
  } else if (/\b(sad|sorry|unfortunate|regret|unhappy|depressed)\b/i.test(text_lower)) {
    return "sad";
  } else if (/\b(wow|whoa|oh my|surprised|shocking|unexpected|amazing)\b/i.test(text_lower)) {
    return "surprised";
  } else if (/\b(angry|mad|furious|upset|irritated|annoyed)\b/i.test(text_lower)) {
    return "angry";
  } else if (/\b(crazy|wild|insane|weird|strange)\b/i.test(text_lower)) {
    return "crazy";
  }
  
  return "default";
}

// Select animation based on message content
function selectAnimation(text) {
  const text_lower = text.toLowerCase();
  
  // Simple keyword-based animation selection
  if (/\b(hello|hi|hey|greetings|welcome)\b/i.test(text_lower)) {
    return "Standing Idle";
  } else if (/\b(ha(ha)+|lol|funny|joke|laughing)\b/i.test(text_lower)) {
    return "Laughing";
  } else if (/\b(thinking|consider|wonder|thought|hmm)\b/i.test(text_lower)) {
    return "Standing Idle";
  } else if (/\b(angry|mad|furious|upset|irritated|annoyed)\b/i.test(text_lower)) {
    return "Angry";
  } else if (/\b(sad|crying|tears|upset|unhappy)\b/i.test(text_lower)) {
    return "Crying";
  } else if (/\b(scared|afraid|terrified|frightened)\b/i.test(text_lower)) {
    return "Terrified";
  } else if (/\b(dance|dancing|party|celebrate)\b/i.test(text_lower)) {
    return "Rumba Dancing";
  } else if (text.length > 20) {
    // Randomly select one of the talking animations
    const talkingOptions = ["Talking_0", "Talking_1", "Talking_2"];
    return talkingOptions[Math.floor(Math.random() * talkingOptions.length)];
  }
  
  return "Standing Idle";
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;
    const engine = req.body.engine || "elevenlabs"; // "azure" or "elevenlabs"
    const requestedAnimation = req.body.animation; // Animation override from request
    
    if (!userMessage) return res.status(400).json({ error: "Missing message." });

    console.log(`🎙️ Using TTS engine: ${engine}`);
    
    // Updated animation list to match Avatar_lolly.jsx expectations
    const allowedAnimations = ["Angry", "Crying", "Laughing", "Rumba Dancing", "Standing Idle", "Talking_0", "Talking_1", "Talking_2", "Terrified"];
    
    const { messages } = await answerWithRAG(userMessage);

    // Process only the first message (Avatar_lolly.jsx expects a single message)
    if (messages.length === 0) {
      return res.status(500).json({ error: "No response generated" });
    }
    
    const msg = messages[0];
    const id = `${Date.now()}_0`;
    const audioPath = path.join(audiosPath, `message_${id}.wav`);
    const mp3Path = path.join(audiosPath, `message_${id}.mp3`);
    const jsonPath = path.join(audiosPath, `message_${id}.json`);
    let audio, cues;

    // Select animation based on message content or use requested animation
    const selectedAnimation = requestedAnimation && allowedAnimations.includes(requestedAnimation)
      ? requestedAnimation
      : selectAnimation(msg.text);
    
    // Detect emotion for facial expression
    const facialExpression = detectEmotion(msg.text);

    try {
      if (engine === "azure") {
        const visemes = await synthesizeSpeechWithVisemes(msg.text, audioPath);
        audio = await audioFileToBase64(audioPath);
        cues = visemes.map((v, idx, arr) => {
          const start = v.time;
          const nextStart = arr[idx + 1]?.time;
          const end = nextStart ? (start + nextStart) / 2 : start + 0.15;
          return {
            value: mapAzureVisemeIdToRhubarb(v.visemeId),
            start,
            end,
          };
        });
        
        // Convert to frontend format
        const mappedLipsyncData = mapRhubarbToVisemes(cues);
        cues = mappedLipsyncData.mouthCues;
      } else if (engine === "elevenlabs") {
        // Generate audio with ElevenLabs
        await generateElevenLabsAudio(msg.text, mp3Path);
        
        // Run Rhubarb to generate lip sync data
        await lipSyncMessage(id);
        
        // Read the generated files
        audio = await audioFileToBase64(mp3Path);
        const lipsyncData = await readJsonTranscript(jsonPath);

        // Map to frontend format 
        const mappedLipsyncData = mapRhubarbToVisemes(lipsyncData.mouthCues);
        cues = mappedLipsyncData.mouthCues;
      }

      // Return a single message object directly instead of an array
      res.status(200).json({
        ...msg,
        audio,
        lipsync: { mouthCues: cues },
        animation: selectedAnimation,
        facialExpression: facialExpression
      });

    } catch (err) {
      console.error(`❌ TTS error (${engine}):`, err.message);
      res.status(500).json({ 
        ...msg, 
        audio: null, 
        lipsync: null, 
        error: err.message, 
        animation: "Standing Idle", 
        facialExpression: "default" 
      });
    }
  } catch (err) {
    console.error("❌ Internal error:", err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
});

// Map Azure viseme ID to Rhubarb viseme format
function mapAzureVisemeIdToRhubarb(id) {
  const map = {
    0: "X",      // silence
    1: "A",      // ae
    2: "B",      // ah
    3: "C",      // aw
    4: "D",      // ay
    5: "E",      // b
    6: "F",      // ch
    7: "G",      // d
    8: "H",      // eh
    9: "X",      // ey
    10: "F",     // f
    11: "G",     // g
    12: "H",     // h
    13: "E",     // ih
    14: "D",     // iy
    15: "G",     // j
    16: "G",     // k
    17: "G",     // l
    18: "B",     // m
    19: "B",     // n
    20: "B",     // ng
    21: "C",     // ow
    22: "C",     // oy
    23: "B",     // p
    24: "H",     // r
    25: "H",     // s
    26: "H",     // sh
    27: "H",     // t
    28: "H",     // th
    29: "E",     // uh
    30: "D",     // uw
    31: "F",     // v
    32: "F",     // w
    33: "F",     // y
    34: "H",     // z
    35: "H",     // zh
  };
  return map[id] || "X";
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
