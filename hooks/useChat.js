// ...existing code...

function processMessages(messages) {
  return messages.map(message => {
    return {
      text: message.text,
      facialExpression: message.facialExpression || "neutral",
      animation: message.animation || "Idle",
      audio: message.audio || null,
      lipsync: message.lipsync || null,
      source: message.source || "",
      image: message.image || "",
    };
  });
}

// Exemple d'utilisation
const handleChatResponse = (response) => {
  const processedMessages = processMessages(response.messages);
  setChatMessages([...chatMessages, ...processedMessages]);
};
