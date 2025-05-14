// lib/audioUtils.js
import { promises as fs } from "fs";
import path from "path";
import { execFile, spawn } from "child_process";
import { fileURLToPath } from "url";
import { promisify } from "util";
import fetch from "node-fetch";

// Use path.join to create cross-platform paths relative to the app root
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const audiosDir = path.resolve(appRoot, "audios");

// Update paths to use the correct Rhubarb binary location
const ffmpegPath = "ffmpeg"; // Use the default path for ffmpeg
const rhubarbPath = path.join(appRoot, "bin", "Rhubarb-Lip-Sync-1.14.0-Linux", "rhubarb"); // Correct path to rhubarb
const resPath = path.join(appRoot, "bin", "res"); // Updated resources path

const execFileAsync = promisify(execFile);

const voiceID = process.env.ELEVEN_LABS_VOICE_ID || "4tRn1lSkEn13EVTuqb0g";
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

export const ensureAudiosDirectory = async () =>
  await fs.mkdir(audiosDir, { recursive: true });

const fileExists = async (filePath) =>
  !!(await fs.stat(filePath).catch(() => false));

export const audioFileToBase64 = async (filePath) => {
  try {
    const data = await fs.readFile(filePath);
    return data.toString("base64");
  } catch (error) {
    console.error("❌ Error converting audio to base64:", error);
    return null;
  }
};

export const readJsonTranscript = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("❌ Error reading JSON transcript:", error);
    return null;
  }
};

export const generateSpeechWithStreaming = async (text, outputFilePath) => {
  console.log("📞 Calling ElevenLabs TTS...");
  try {
    // Debug log to verify API key is available
    console.log(`🔑 API Key available: ${elevenLabsApiKey ? "Yes" : "No"}`);
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceID}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          Accept: "audio/mpeg",
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
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ ElevenLabs Error:", error);
      throw new Error(`TTS failed: ${response.status} - ${error}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputFilePath, buffer);
    console.log(`✅ Audio saved to ${outputFilePath}`);
  } catch (error) {
    console.error("❌ ElevenLabs TTS error:", error);
    throw error;
  }
};

export const lipSyncMessage = async (uniqueId) => {
  console.log("👄 Starting lip sync process...");
  const mp3File = path.resolve(audiosDir, `message_${uniqueId}.mp3`);
  const wavFile = path.resolve(audiosDir, `message_${uniqueId}.wav`);
  const jsonFile = path.resolve(audiosDir, `message_${uniqueId}.json`);

  if (!(await fileExists(mp3File))) throw new Error(`MP3 not found: ${mp3File}`);

  try {
    console.log("🎙️ Launching FFMPEG...");
    const { stdout, stderr } = await execFileAsync(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-i", mp3File,
      "-ac", "1",
      "-ar", "16000",
      "-sample_fmt", "s16",
      wavFile,
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

  // Log the path to verify
  console.log(`Using Rhubarb at path: ${rhubarbPath}`);
  console.log(`Using resources at: ${resPath}`);
  
  // Make the binary executable
  try {
    await fs.chmod(rhubarbPath, 0o755);
    console.log("✅ Made Rhubarb executable");
  } catch (error) {
    console.error("❌ Failed to make Rhubarb executable:", error);
  }

  await new Promise((resolve, reject) => {
    const rhubarb = spawn(
      rhubarbPath,
      ["-f", "json", "-o", jsonFile, wavFile, "-r", "phonetic"],
      {
        env: {
          ...process.env,
          POCKETSPHINX_PATH: resPath,
        },
      }
    );

    rhubarb.stdout.on("data", (d) => console.log("Rhubarb:", d.toString()));
    rhubarb.stderr.on("data", (d) =>
      console.error("Rhubarb Error:", d.toString())
    );

    rhubarb.on("close", (code) => {
      code === 0
        ? resolve()
        : reject(new Error(`Rhubarb exited with code ${code}`));
    });
  });

  console.log("✅ Lip sync process completed.");
};
