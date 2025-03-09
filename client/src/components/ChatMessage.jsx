import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import './ChatMessage.css';

function ChatMessage({ message, isUser, tokenUsage }) {
  // Function to properly escape any problematic characters in markdown
  const sanitizeMarkdown = (text) => {
    if (!text) return '';
    // Replace any problematic characters or sequences that might cause rendering issues
    return text
      .replace(/\\([^\\])/g, '\\\\$1') // Escape backslashes that aren't already escaped
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .replace(/\#{1,6}\s/g, match => match); // Preserve heading markers
  };

  // Function to enhance source links in the markdown
  const enhanceSourceLinks = (text) => {
    if (!text) return '';
    
    // Check if the text contains a Sources Used section
    const sourcesSection = text.match(/## Sources Used[\s\S]*$/i);
    
    if (!sourcesSection) return text;
    
    // Return the original text with enhanced source links
    return text;
  };

  return (
    <div className={`message ${isUser ? 'user-message' : 'assistant-message'}`}>
      {isUser ? (
        <p>{message}</p>
      ) : (
        <div className="markdown-content">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkBreaks]}
            rehypePlugins={[rehypeRaw, rehypeSanitize]}
            components={{
              // Custom rendering for specific markdown elements if needed
              h1: ({node, ...props}) => <h1 className="md-heading" {...props} />,
              h2: ({node, ...props}) => <h2 className="md-heading" {...props} />,
              h3: ({node, ...props}) => <h3 className="md-heading" {...props} />,
              pre: ({node, ...props}) => <pre className="md-pre" {...props} />,
              code: ({node, inline, ...props}) => 
                inline ? <code className="md-inline-code" {...props} /> : <code className="md-block-code" {...props} />,
              a: ({node, href, children, ...props}) => {
                // Enhance links in the Sources Used section
                return <a href={href} className="source-link" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
              },
              ul: ({node, ...props}) => {
                // Check if this is inside the Sources Used section
                const isSourcesList = props.node?.position?.start?.line && 
                  message.substring(0, props.node.position.start.offset).includes('## Sources Used');
                return <ul className={isSourcesList ? "sources-list" : ""} {...props} />;
              }
            }}
          >
            {sanitizeMarkdown(enhanceSourceLinks(message))}
          </ReactMarkdown>
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