// rag/ingest.js
import fs from "fs";
import path from "path";
import vectorStore from "./store.js";

let hasIndexed = false;

export async function ingestDocuments(directory = "rag_project/docs") {
  if (hasIndexed) return; // ✅ skip si déjà fait

  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.resolve(directory, file);
    const content = fs.readFileSync(fullPath, "utf8");
    const chunks = content.match(/(.|\s){200,500}/g); // split par taille
    await vectorStore.addDocuments(
      chunks.map(chunk => ({
        pageContent: chunk,
        metadata: { source: file },
      }))
    );
    console.log(`✅ Document "${file}" indexé (${chunks.length} chunks)`);
  }

  hasIndexed = true;
}
