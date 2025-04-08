import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { exec, spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import WebSocket from "ws";
import { createWriteStream } from "fs";
import fetch from "node-fetch"; // tout en haut du fichier si pas encore importé
import { execFile } from "child_process";
import { promisify } from "util";
import { answerWithRAG } from "./rag/qa.js";
import { ingestDocuments } from "./rag/ingest.js";

// App initialization
(async () => {
  await ingestDocuments(); // ✅ Index once when app starts
})();

const execFileAsync = promisify(execFile);

// Init
dotenv.config();
const app = express();
const port = 3000;
app.use(express.json());
app.use(cors());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "-" });
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "EXAVITQu4vr4xnSDxMaL";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audiosDir = path.resolve(__dirname, "audios");

// Utils
const ensureAudiosDirectory = async () => await fs.mkdir(audiosDir, { recursive: true });
const fileExists = async (filePath) => !!(await fs.stat(filePath).catch(() => false));

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

// Serve audio files
app.use("/audios", express.static(audiosDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp3")) res.setHeader("Content-Type", "audio/mpeg");
    if (filePath.endsWith(".wav")) res.setHeader("Content-Type", "audio/wav");
  }
}));

const generateSpeechWithStreaming = async (text, outputFilePath) => {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceID}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": elevenLabsApiKey,
      "Accept": "audio/mpeg",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("❌ ElevenLabs Error:", error);
    throw new Error(`TTS failed: ${response.status} - ${error}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputFilePath, buffer);
  console.log(`✅ Audio saved to ${outputFilePath}`);
};
// Generate lipsync JSON
const lipSyncMessage = async (uniqueId) => {
  const mp3File = path.resolve(audiosDir, `message_${uniqueId}.mp3`);
  const wavFile = path.resolve(audiosDir, `message_${uniqueId}.wav`);
  const jsonFile = path.resolve(audiosDir, `message_${uniqueId}.json`);
  const resPath = path.resolve(__dirname, "bin", "res");
  const rhubarbPath = path.resolve(__dirname, "bin", "rhubarb.exe");

  if (!(await fileExists(mp3File))) throw new Error(`MP3 not found: ${mp3File}`);

  try {
    console.log("🎙️ Launching FFMPEG...");
    const { stdout, stderr } = await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", mp3File,
      "-ac", "1",
      "-ar", "16000",
      "-sample_fmt", "s16",
      wavFile
    ]);
    console.log("FFMPEG STDOUT:", stdout);
    console.log("FFMPEG STDERR:", stderr);
  } catch (err) {
    console.error("❌ FFMPEG Error:", err.message);
    throw err;
  }

  if (!(await fileExists(wavFile))) {
    throw new Error(`WAV not created: ${wavFile}`);
  }

  // 🎯 Lance Rhubarb avec .wav
  await new Promise((resolve, reject) => {
    const rhubarb = spawn(rhubarbPath, [
      "-f", "json", "-o", jsonFile, wavFile, "-r", "phonetic"
    ], {
      cwd: path.resolve(__dirname, "bin"),
      shell: true,
      env: { ...process.env, POCKETSPHINX_PATH: resPath },
    });

    rhubarb.stdout.on("data", (d) => console.log("Rhubarb:", d.toString()));
    rhubarb.stderr.on("data", (d) => console.error("Rhubarb Error:", d.toString()));

    rhubarb.on("close", (code) => {
      code === 0
        ? resolve()
        : reject(new Error(`Rhubarb exited with code ${code}`));
    });
  });
};

// Chat endpoint
app.post("/chat", async (req, res) => {
  await ensureAudiosDirectory();
  const userMessage = req.body.message;

  if (!userMessage) return res.status(400).send({ error: "Missing message." });

  try {
    // 🔁 Nouvelle version avec RAG intégré
    const ragResponse = await answerWithRAG(userMessage);
    let messages = ragResponse.messages;

    // 🖨️ Log des messages générés par OpenAI
    console.log("🔹 OpenAI Response Messages:", JSON.stringify(messages, null, 2));

    // 🔊 Traitement audio et lipsync
    const processedMessages = await Promise.all(messages.map(async (message, i) => {
      const uniqueId = `${Date.now()}_${i}`;
      const mp3File = path.resolve(audiosDir, `message_${uniqueId}.mp3`);
      const jsonFile = path.resolve(audiosDir, `message_${uniqueId}.json`);

      try {
        // Tente de générer l'audio avec ElevenLabs
        await generateSpeechWithStreaming(message.text, mp3File);
        await lipSyncMessage(uniqueId);

        // Retourne le message avec audio et lipsync
        return {
          ...message,
          audio: await audioFileToBase64(mp3File),
          lipsync: await readJsonTranscript(jsonFile),
        };
      } catch (err) {
        // Gestion des erreurs ElevenLabs
        if (err.message.includes("quota_exceeded")) {
          console.error("❌ ElevenLabs quota exceeded. Returning text-only response.");
        } else {
          console.error("Error processing message:", err);
        }

        // Retourne uniquement le texte en cas d'erreur
        return {
          ...message,
          audio: null,
          lipsync: null,
        };
      }
    }));

    // Envoyer les messages traités
    res.send({ messages: processedMessages });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Server start
app.listen(port, () => {
  console.log(`🚀 Virtual Girlfriend API is running at http://localhost:${port}`);
});
