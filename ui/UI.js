// ...existing code...

function renderMessage(message) {
  return (
    <div className="message">
      <p>{message.text}</p>
      {message.audio && (
        <audio controls>
          <source src={`data:audio/mpeg;base64,${message.audio}`} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
      )}
      {message.image && <img src={message.image} alt="Message illustration" />}
    </div>
  );
}

// Exemple d'utilisation
chatMessages.map((message, index) => (
  <div key={index}>
    {renderMessage(message)}
  </div>
));
