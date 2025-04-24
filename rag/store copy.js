// rag/store.js
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

let vectorStore = null;

export const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error("❌ Missing OPENAI_API_KEY in environment variable");
  }
  console.log("🔍 Clef brute :", JSON.stringify(openAIApiKey));
  console.log("🔍 Code ASCII :", [...openAIApiKey].map(c => c.charCodeAt(0)));

  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log("🔑 Using OPENAI_API_KEY:", openAIApiKey);

  vectorStore = await MemoryVectorStore.fromTexts([], [], embeddings);
  return vectorStore;
};
