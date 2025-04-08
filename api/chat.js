// api/chat.js
import app from "../index.js";

export default async function handler(req, res) {
  // ✅ CORS headers manuels requis par Vercel
  res.setHeader("Access-Control-Allow-Origin", "https://neemba-frontend.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ Répondre aux prérequis CORS (OPTIONS)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ✅ Transférer à Express
  app(req, res);
}
