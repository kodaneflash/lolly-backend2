import fs from "fs/promises";
import path from "path";
import { getVectorStore } from "./store.js";

let hasIndexed = false;

async function readTextFilesFromDir(dirPath: string) {
  const files = await fs.readdir(dirPath);
  const textFiles = files.filter(file => file.endsWith(".txt") || file.endsWith(".md"));

  return Promise.all(
    textFiles.map(async file => ({
      name: file,
      content: await fs.readFile(path.join(dirPath, file), "utf8"),
    }))
  );
}

function smartSplitIntoChunks(text: string, maxChunkSize = 500): string[] {
  const paragraphs = text.split(/\n\s*\n/); // split on empty lines
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((currentChunk + "\n\n" + trimmed).length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim());
      currentChunk = trimmed;
    } else {
      currentChunk += "\n\n" + trimmed;
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

export async function ingestDocuments(directory = "rag_project/docs") {
  if (hasIndexed) return;

  try {
    const documents = await readTextFilesFromDir(directory);
    const vectorStore = await getVectorStore();

    for (const { name, content } of documents) {
      const chunks = smartSplitIntoChunks(content);
      const docs = chunks.map(chunk => ({
        pageContent: chunk,
        metadata: { source: name },
      }));

      await vectorStore.addDocuments(docs);
      console.log(`✅ "${name}" indexé (${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`);
    }

    hasIndexed = true;
    console.log("📦 Tous les documents ont été indexés.");
  } catch (err: any) {
    console.error("❌ Erreur d'indexation des documents:", err.message);
    throw err;
  }
}
