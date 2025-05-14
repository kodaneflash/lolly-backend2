import { getVectorStore } from "./rag/store.js";

const main = async () => {
  console.log("🔍 Connecting to vector store...");
  const store = await getVectorStore();
  console.log("✅ Connected successfully!");
  
  const query = "Tell me about Lolly's personality";
  console.log(`🔍 Searching for: "${query}"`);
  
  const results = await store.similaritySearch(query, 3);
  console.log(`✅ Found ${results.length} results`);
  
  if (results.length === 0) {
    console.log("❌ No documents found. Check if documents were indexed properly.");
  } else {
    results.forEach((doc, index) => {
      console.log(`\n--- Result ${index + 1} ---`);
      console.log("Source:", doc.metadata.source);
      console.log("Content:", doc.pageContent.substring(0, 200) + "...");
    });
  }
};

console.log("🚀 Starting query test...");
main().catch(error => {
  console.error("❌ Error:", error);
});
