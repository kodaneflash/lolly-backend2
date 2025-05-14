// lib/elevenLabsTTS.js
import fs from "fs";
import https from "https";
import path from "path";

export async function generateElevenLabsAudio(text, outPath) {
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  const voiceId = process.env.ELEVEN_LABS_VOICE_ID || "4tRn1lSkEn13EVTuqb0g";

  // Debug logging for API keys
  console.log(`🔑 ElevenLabs API Key status: ${apiKey ? "Available" : "MISSING"}`);
  console.log(`🎤 ElevenLabs Voice ID: ${voiceId}`);

  if (!apiKey) {
    console.error("❌ Error: ELEVEN_LABS_API_KEY environment variable is not set");
    throw new Error("ElevenLabs API key is not configured");
  }

  console.log(`🔊 Generating audio with voice ID: ${voiceId}`);

  // More aggressive text sanitization to prevent JSON syntax errors
  // 1. Remove non-printable/control characters
  // 2. Safely handle all quotes and special characters
  let sanitizedText = "";
  try {
    // Handle null or undefined text
    if (!text) {
      text = "Hello there";
      console.warn("⚠️ Empty text provided to TTS, using fallback text");
    }
    
    // Remove problematic characters and normalize
    sanitizedText = text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
      .normalize('NFC'); // Normalize Unicode characters
    
    console.log(`📝 Original text length: ${text.length}, Sanitized length: ${sanitizedText.length}`);
    
    // If sanitizing removed too much, use a fallback
    if (sanitizedText.length < text.length * 0.5 && text.length > 10) {
      console.warn("⚠️ Sanitizing removed too much content, using simple alphanumeric filter");
      sanitizedText = text.replace(/[^\w\s.,?!'"()]/g, "");
    }
  } catch (error) {
    console.error("❌ Error sanitizing text:", error);
    sanitizedText = "I'm having trouble with that text. Can you try something else?";
  }
  
  try {
    const requestData = JSON.stringify({
      text: sanitizedText,
      model_id: "eleven_multilingual_v2",
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
        "Content-Length": Buffer.byteLength(requestData),
      },
    };

    console.log(`🌐 Sending request to ElevenLabs API: ${options.hostname}${options.path}`);

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          let errorData = '';
          res.on('data', (chunk) => {
            errorData += chunk;
          });
          
          res.on('end', () => {
            console.error(`❌ ElevenLabs API Error: Status ${res.statusCode}`);
            console.error(`Response: ${errorData}`);
            console.error(`Request payload: ${requestData.substring(0, 500)}${requestData.length > 500 ? '...' : ''}`);
            reject(new Error(`Failed with status code: ${res.statusCode} - ${errorData}`));
          });
          return;
        }

        const fileStream = fs.createWriteStream(outPath);
        res.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          console.log(`✅ Audio file created at ${outPath}`);
          resolve();
        });
      });

      req.on("error", (error) => {
        console.error("❌ Network error when calling ElevenLabs:", error);
        reject(error);
      });
      
      req.write(requestData);
      req.end();
    });
  } catch (error) {
    console.error("❌ Error preparing ElevenLabs request:", error);
    throw error;
  }
}
