// lib/azureTTS.js
import sdk from "microsoft-cognitiveservices-speech-sdk";
import fs from "fs";

// Génère audio + visemes depuis Azure TTS
export function synthesizeSpeechWithVisemes(text, outAudioPath) {
  return new Promise((resolve, reject) => {
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    speechConfig.speechSynthesisVoiceName = process.env.AZURE_SPEECH_VOICE;

    const audioConfig = sdk.AudioConfig.fromAudioFileOutput(outAudioPath);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, audioConfig);

    const visemeData = [];

    synthesizer.visemeReceived = (s, e) => {
      visemeData.push({
        time: e.audioOffset / 10000 / 1000, // convert to seconds
        visemeId: e.visemeId,
      });
    };

    synthesizer.speakTextAsync(
      text,
      (result) => {
        synthesizer.close();
        if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
          resolve(visemeData);
        } else {
          reject(result.errorDetails);
        }
      },
      (err) => {
        synthesizer.close();
        reject(err);
      }
    );
  });
}
