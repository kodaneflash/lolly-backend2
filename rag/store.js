// rag/store.js
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

let vectorStore = null;

export const getVectorStore = async () => {
  if (vectorStore) return vectorStore;

  const openAIApiKey = process.env.OPENAI_API_KEY;
  if (!openAIApiKey) {
    throw new Error("❌ Missing OPENAI_API_KEY in environment variables");
  }

  const embeddings = new OpenAIEmbeddings({ openAIApiKey });

  vectorStore = await MemoryVectorStore.fromTexts([], [], embeddings);
  return vectorStore;
};
