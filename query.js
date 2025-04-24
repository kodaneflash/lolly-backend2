import { getVectorStore } from "./rag/store.js";

const main = async () => {
  const store = await getVectorStore();
  const results = await store.similaritySearch("Qu'est ce que neemba' ?", 3);
  
  results.forEach((doc, index) => {
    console.log(`\n--- Résultat ${index + 1} ---`);
    console.log("Source:", doc.metadata.source);
    console.log("Contenu:", doc.pageContent);
  });
};

main();
