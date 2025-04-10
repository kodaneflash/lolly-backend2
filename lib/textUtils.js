// lib/textUtils.js
export function splitTextIntoChunks(text, maxLength = 400) {
    const sentences = text.split(/(?<=[.!?])\s+/);
    const chunks = [];
    let currentChunk = "";
  
    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += " " + sentence;
      }
    }
  
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  
    return chunks;
  }
  