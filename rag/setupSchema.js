// rag/setupSchema.js
import weaviate from "weaviate-ts-client";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Support pour __dirname dans les modules ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger les variables d'environnement (.env)
dotenv.config({ path: path.join(__dirname, "../.env") });

const schemaName = "RAGDocument";

// Vérification que les variables sont bien chargées
if (!process.env.WEAVIATE_URL || !process.env.WEAVIATE_API_KEY) {
  console.error("❌ WEAVIATE_URL ou WEAVIATE_API_KEY manquant dans .env");
  process.exit(1);
}

const client = weaviate.client({
  scheme: "https",
  host: process.env.WEAVIATE_URL.replace(/^https?:\/\//, ""),
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
});

// Vérifie si la classe existe déjà, sinon la crée
client.schema
  .classGetter()
  .withClassName(schemaName)
  .do()
  .then(() => {
    console.log(`✅ Classe "${schemaName}" déjà existante dans Weaviate`);
  })
  .catch(() => {
    client.schema
      .classCreator()
      .withClass({
        class: schemaName,
        vectorizer: "none", // on utilise nos propres embeddings
        properties: [
          { name: "text", dataType: ["text"] },
          { name: "source", dataType: ["text"] },
        ],
      })
      .do()
      .then(() => {
        console.log(`✅ Classe "${schemaName}" créée avec succès`);
      })
      .catch(err => {
        console.error("❌ Erreur lors de la création de la classe:", err.message);
      });
  });
