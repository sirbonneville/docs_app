import { useState } from 'react';
import ChatMessage from './ChatMessage';

// Add this CSS to your App.css or create it if it doesn't exist
// Then import it at the top of App.jsx
import './App.css';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);  // Add this state for message history
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Debug log before any state updates
    console.log('Form submitted with:', inputValue);
    
    const userMessage = { role: 'user', content: inputValue };
    console.log('User message created:', userMessage);
    
    // Immediately log messages state before update
    console.log('Current messages:', messages);
    
    setMessages(prev => {
      console.log('Updating messages with:', userMessage);
      return [...prev, userMessage];
    });
    
    try {
      console.log('Sending request with input:', inputValue);
      
      const response = await fetch('http://localhost:3001/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",
          max_tokens: 8000,
          messages: [
            {
              role: "user",
              content: inputValue
            }
          ]
        }),
      });
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
      console.log('Successfully parsed response:', data);
      
      // Extract content based on the current Anthropic API format
      let assistantContent = '';
      
      // Handle the new format (content array with type/text objects)
      if (data.content && Array.isArray(data.content)) {
        assistantContent = data.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n');
      } 
      // Handle legacy format with completion field
      else if (data.completion) {
        assistantContent = data.completion;
      }
      // Last resort - stringify the whole response
      else {
        console.warn('Unexpected response format:', data);
        assistantContent = JSON.stringify(data);
      }
      
      console.log('Extracted assistant content:', assistantContent);
      
      const assistantMessage = {
        role: 'assistant',
        content: assistantContent
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (err) {
      // More detailed error logging
      console.error('Detailed error info:', {
        error: err,
        message: err.message,
        stack: err.stack
      });
      setError(`Failed to get results: ${err.message}`);
    }
  };

  // Add an effect to monitor messages state
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  return (
    <div className="app-container">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <ChatMessage
            key={index}
            message={msg.content}
            isUser={msg.role === 'user'}
          />
        ))}
        {isLoading && <div className="loading">Loading...</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !inputValue.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default App;