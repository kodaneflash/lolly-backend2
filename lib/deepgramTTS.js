// lib/deepgramTTS.js
import fs from "fs";
import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

export async function analyzeVisemesWithDeepgram(audioPath) {
  const buffer = fs.readFileSync(audioPath);

  const { result } = await deepgram.listen.prerecorded.transcribeFile(
    buffer,
    {
      model: "nova",
      language: "fr",
      features: ["mouth"],
      smart_format: false,
      punctuate: false,
    }
  );

  const mouthShapes = result.results.channels[0].alternatives[0].mouth_shapes || [];

  const mouthCues = mouthShapes.map((shape) => ({
    start: shape.start,
    end: shape.end,
    value: mapDeepgramMouthToCue(shape.shape),
  }));

  return mouthCues;
}

function mapDeepgramMouthToCue(shape) {
  const map = {
    A: "A",
    B: "B",
    C: "C",
    D: "D",
    E: "E",
    F: "F",
    G: "G",
    H: "H",
    X: "X",
  };
  return map[shape] || "rest";
}
