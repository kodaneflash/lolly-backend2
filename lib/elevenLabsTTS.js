// lib/elevenLabsTTS.js
import fs from "fs";
import https from "https";
import path from "path";

export async function generateElevenLabsAudio(text, outPath) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  const voiceId = process.env.ELEVEN_LABS_VOICE_ID;

  const requestData = JSON.stringify({
    text,
    voice_settings: {
      stability: 0.7,
      similarity_boost: 0.8,
    }
  });

  const options = {
    hostname: "api.elevenlabs.io",
    port: 443,
    path: `/v1/text-to-speech/${voiceId}`,
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
      "Content-Length": requestData.length,
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed with status code: ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(outPath);
      res.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close();
        resolve();
      });
    });

    req.on("error", (error) => reject(error));
    req.write(requestData);
    req.end();
  });
}
