// lib/textUtils.js
export function splitTextIntoChunks(text, maxLength = 350) {
    const sentences = text.split(/(?<=[.?!])\s+/);
    const chunks = [];
    let current = "";
  
    for (const sentence of sentences) {
      if ((current + sentence).length <= maxLength) {
        current += sentence + " ";
      } else {
        if (current) chunks.push(current.trim());
        current = sentence + " ";
      }
    }
  
    if (current) chunks.push(current.trim());
    return chunks;
  }
  