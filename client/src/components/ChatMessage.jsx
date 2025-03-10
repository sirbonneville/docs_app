import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import './ChatMessage.css';

function ChatMessage({ message, isUser, tokenUsage }) {
  const contentRef = useRef(null);

  useEffect(() => {
    // Ensure Prism highlights code blocks after the component renders or updates
    if (contentRef.current) {
      Prism.highlightAllUnder(contentRef.current);
    }
  }, [message]);

  // Define the markdown renderer component to avoid code duplication
  const MarkdownRenderer = ({ content, isUserContent }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      rehypePlugins={[rehypeRaw, rehypeSanitize]}
      components={{
        h1: ({node, ...props}) => <h1 className="markdown-h1" {...props} />,
        h2: ({node, ...props}) => <h2 className="markdown-h2" {...props} />,
        h3: ({node, ...props}) => <h3 className="markdown-h3" {...props} />,
        p: ({node, ...props}) => <p className="markdown-paragraph" {...props} />,
        ul: ({node, ...props}) => <ul className="markdown-list" {...props} />,
        li: ({node, ...props}) => <li className="markdown-list-item" {...props} />,
        code: ({node, inline, className, children, ...props}) => {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <pre className={`language-${match[1]}`}>
              <code className={className} {...props}>{children}</code>
            </pre>
          ) : (
            <code className="inline-code" {...props}>{children}</code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`} ref={contentRef}>
      {isUser ? (
        <div className="user-content">
          <MarkdownRenderer content={message} isUserContent={true} />
        </div>
      ) : (
        <div className="markdown-content">
          <MarkdownRenderer content={message} isUserContent={false} />
        </div>
      )}
    </div>
  );
}

export default ChatMessage;