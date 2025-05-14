// rag/ingest.js
import fs from "fs";
import path from "path";
import { getVectorStore } from "./store.js";

let hasIndexed = false;

function readTextFilesFromDir(dirPath) {
  console.log(`📂 Reading files from ${dirPath}...`);
  const files = fs.readdirSync(dirPath);
  const textFiles = files.filter(file => file.endsWith(".txt") || file.endsWith(".md"));
  console.log(`📄 Found ${textFiles.length} text files: ${textFiles.join(", ")}`);
  
  return textFiles.map(file => ({
    name: file,
    content: fs.readFileSync(path.join(dirPath, file), "utf8"),
  }));
}

function splitIntoChunks(text, min = 200, max = 500) {
  const pattern = new RegExp(`(.|\\s){${min},${max}}`, "g");
  return text.match(pattern) || [];
}

export async function ingestDocuments(directory = "rag_project/docs") {
  if (hasIndexed) {
    console.log("🔄 Documents already indexed, skipping...");
    return;
  }

  try {
    console.log(`🚀 Starting ingestion process from ${directory}...`);
    const documents = readTextFilesFromDir(directory);

    for (const { name, content } of documents) {
      console.log(`⏳ Processing ${name}...`);
      const chunks = splitIntoChunks(content);
      const docs = chunks.map(chunk => ({
        pageContent: chunk,
        metadata: { source: name },
      }));

      console.log(`  → Uploading ${chunks.length} chunks to Weaviate...`);
      await getVectorStore().then(vectorStore => vectorStore.addDocuments(docs));
      console.log(`✅ "${name}" indexed (${chunks.length} chunk${chunks.length > 1 ? "s" : ""})`);
    }

    hasIndexed = true;
    console.log("🎉 All documents successfully indexed!");
  } catch (err) {
    console.error("❌ Erreur d'indexation des documents:", err.message);
    throw err;
  }
}
