// rag/ingest.js
import fs from "fs";
import path from "path";
import { getVectorStore } from "./store.js";

let hasIndexed = false;

function readTextFilesFromDir(dirPath) {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => file.endsWith(".txt") || file.endsWith(".md"))
    .map(file => ({
      name: file,
      content: fs.readFileSync(path.join(dirPath, file), "utf8"),
    }));
}

function splitIntoChunks(text, min = 200, max = 500) {
  const pattern = new RegExp(`(.|\\s){${min},${max}}`, "g");
  return text.match(pattern) || [];
}

export async function ingestDocuments(directory = "rag_project/docs") {
  if (hasIndexed) return;

  try {
    const documents = readTextFilesFromDir(directory);

    for (const { name, content } of documents) {
      const chunks = splitIntoChunks(content);
      const docs = chunks.map(chunk => ({
        pageContent: chunk,
        metadata: { source: name },
      }));

      await getVectorStore().then(vectorStore => vectorStore.addDocuments(docs));
      console.log(`✅ "${name}" indexé (${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`);
    }

    hasIndexed = true;
  } catch (err) {
    console.error("❌ Erreur d'indexation des documents:", err.message);
    throw err;
  }
}
