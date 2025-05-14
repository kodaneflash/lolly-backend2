// delete-all.mjs
import weaviate from "weaviate-ts-client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Support for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

const schemaName = "RAGDocument";

const client = weaviate.client({
  scheme: "https",
  host: process.env.WEAVIATE_URL.replace(/^https?:\/\//, ""),
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

// Delete and recreate the schema
async function resetSchema() {
  try {
    // First check if the class exists
    const doesClassExist = await client.schema
      .classGetter()
      .withClassName(schemaName)
      .do()
      .then(() => true)
      .catch(() => false);
    
    // Delete the class if it exists
    if (doesClassExist) {
      console.log(`Deleting existing "${schemaName}" class...`);
      await client.schema
        .classDeleter()
        .withClassName(schemaName)
        .do();
      console.log(`✅ Class "${schemaName}" deleted`);
    }
    
    // Recreate the class
    console.log(`Creating new "${schemaName}" class...`);
    await client.schema
      .classCreator()
      .withClass({
        class: schemaName,
        vectorizer: "none", // we use our own embeddings
        properties: [
          { name: "text", dataType: ["text"] },
          { name: "source", dataType: ["text"] },
        ],
      })
      .do();
    
    console.log(`✅ Class "${schemaName}" recreated successfully`);
  } catch (error) {
    console.error("❌ Error while resetting schema:", error.message);
  }
}

resetSchema(); 