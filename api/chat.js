// api/chat.js
import { answerWithRAG } from "../rag/qa.js";
import { generateSpeechWithStreaming, lipSyncMessage, audioFileToBase64, readJsonTranscript, ensureAudiosDirectory } from "../lib/audioUtils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  await ensureAudiosDirectory();
  const userMessage = req.body.message;

  if (!userMessage) return res.status(400).send({ error: "Missing message." });

  try {
    const ragResponse = await answerWithRAG(userMessage);
    let messages = ragResponse.messages;

    const processedMessages = await Promise.all(messages.map(async (message, i) => {
      const uniqueId = `${Date.now()}_${i}`;
      const mp3File = `./audios/message_${uniqueId}.mp3`;
      const jsonFile = `./audios/message_${uniqueId}.json`;

      try {
        await generateSpeechWithStreaming(message.text, mp3File);
        await lipSyncMessage(uniqueId);

        return {
          ...message,
          audio: await audioFileToBase64(mp3File),
          lipsync: await readJsonTranscript(jsonFile),
        };
      } catch (err) {
        console.error("Error processing message:", err);
        return {
          ...message,
          audio: null,
          lipsync: null,
        };
      }
    }));

    res.status(200).json({ messages: processedMessages });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
