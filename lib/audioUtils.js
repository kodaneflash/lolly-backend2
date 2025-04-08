// lib/audioUtils.js
import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { promisify } from "util";

import { execFile } from "child_process";
const execFileAsync = promisify(execFile);


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audiosDir = path.resolve(__dirname, "../audios");
const voiceID = "EXAVITQu4vr4xnSDxMaL";
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;

export const ensureAudiosDirectory = async () => await fs.mkdir(audiosDir, { recursive: true });

export const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

export const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

export const generateSpeechWithStreaming = async (text, outputFilePath) => {
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
    throw new Error(`TTS failed: ${response.status} - ${error}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(outputFilePath, buffer);
};

export const lipSyncMessage = async (uniqueId) => {
  const mp3File = path.resolve(audiosDir, `message_${uniqueId}.mp3`);
  const wavFile = path.resolve(audiosDir, `message_${uniqueId}.wav`);
  const jsonFile = path.resolve(audiosDir, `message_${uniqueId}.json`);
  const resPath = path.resolve(__dirname, "../bin/res");
  const rhubarbPath = path.resolve(__dirname, "../bin/rhubarb.exe");

  await execFileAsync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", mp3File,
    "-ac", "1", "-ar", "16000", "-sample_fmt", "s16",
    wavFile
  ]);

  await new Promise((resolve, reject) => {
    const rhubarb = spawn(rhubarbPath, [
      "-f", "json", "-o", jsonFile, wavFile, "-r", "phonetic"
    ], {
      cwd: path.resolve(__dirname, "../bin"),
      shell: true,
      env: { ...process.env, POCKETSPHINX_PATH: resPath },
    });

    rhubarb.on("close", (code) => {
      code === 0 ? resolve() : reject(new Error(`Rhubarb exited with code ${code}`));
    });
  });
};
