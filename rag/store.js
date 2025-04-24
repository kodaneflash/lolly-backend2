// rag/store.js pour le rag
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import weaviate from "weaviate-ts-client";
import { WeaviateStore } from "langchain/vectorstores/weaviate";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";

// Support __dirname en module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, "../.env") });

let vectorStore = null;

export const getVectorStore = async () => {
  const weaviateUrl = process.env.WEAVIATE_URL;
  const weaviateApiKey = process.env.WEAVIATE_API_KEY;
  const openAIApiKey = process.env.OPENAI_API_KEY;

  if (!weaviateUrl || !weaviateApiKey || !openAIApiKey) {
    throw new Error("❌ WEAVIATE_URL, WEAVIATE_API_KEY ou OPENAI_API_KEY manquant dans le fichier .env");
  }

  if (vectorStore) return vectorStore;

  const client = weaviate.client({
    scheme: "https",
    host: weaviateUrl.replace(/^https?:\/\//, ""),
    apiKey: new weaviate.ApiKey(weaviateApiKey),
  });

  const embeddings = new OpenAIEmbeddings({
    apiKey: openAIApiKey,
  });

  vectorStore = await WeaviateStore.fromExistingIndex(embeddings, {
    client,
    indexName: "RAGDocument",
    textKey: "text",
  });

  return vectorStore;
};
