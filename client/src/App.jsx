import { useState } from 'react';
import './App.css';
import ChatMessage from './components/ChatMessage';

function App() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversationId, setConversationId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: query };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    
    // Clear input and show loading state
    setQuery('');
    setLoading(true);
    setError(null);

    try {
      // Updated to use the correct endpoint
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 4000,
          messages: [
            {
              role: "user",
              content: userMessage.content
            }
          ]
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      
      // Updated to match the Anthropic API response structure and include token usage
      const assistantMessage = { 
        role: 'assistant', 
        content: data.content[0].text,
        token_usage: data.token_usage || {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: 0
        }
      };
      
      setMessages((prevMessages) => [
        ...prevMessages,
        assistantMessage
      ]);
    } catch (err) {
      console.error('Error querying API:', err);
      setError('Failed to get a response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>Documentation Assistant</h1>
        <p>Ask questions about the documentation</p>
      </header>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to the Documentation Assistant!</h2>
            <p>Ask any question about the documentation to get started.</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message.content}
              isUser={message.role === 'user'}
              tokenUsage={message.token_usage}
            />
          ))
        )}
        {loading && (
          <div className="message assistant-message">
            <div className="message-content loading">Thinking...</div>
          </div>
        )}
        {error && <div className="error-message">{error}</div>}
      </div>

      <form className="query-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about the documentation..."
          disabled={loading}
          className="query-input"
        />
        <button type="submit" disabled={loading || !query.trim()} className="submit-button">
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  )
}

export default App
