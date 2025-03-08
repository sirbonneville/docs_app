import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import './ChatMessage.css';

function ChatMessage({ message, isUser, tokenUsage }) {
  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
      {isUser ? (
        <p>{message}</p>
      ) : (
        <div className="markdown-content">
          <ReactMarkdown rehypePlugins={[rehypeRaw]}>{message}</ReactMarkdown>
          {tokenUsage && (
            <div className="token-usage">
              <small>
                Tokens: {tokenUsage.input_tokens} in / {tokenUsage.output_tokens} out / {tokenUsage.total_tokens} total
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChatMessage;