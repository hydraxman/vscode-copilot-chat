import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Bot, Loader2 } from 'lucide-react';
import './ChatMessage.css';

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`chat-message ${message.role}`}>
      <div className="message-avatar">
        {isUser ? (
          <User size={20} />
        ) : (
          <Bot size={20} />
        )}
      </div>

      <div className="message-content">
        <div className="message-header">
          <span className="message-role">
            {isUser ? 'You' : 'Copilot'}
          </span>
          <span className="message-time">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>

        {/* Progress indicator */}
        {message.progress && message.isStreaming && (
          <div className="message-progress">
            <Loader2 className="spinner" size={14} />
            <span>{message.progress}</span>
          </div>
        )}

        {/* Thinking section */}
        {message.thinking && (
          <div className="message-thinking">
            <div className="thinking-header">
              💭 {message.thinking.title || 'Thinking...'}
            </div>
            {message.thinking.body && (
              <div className="thinking-body">{message.thinking.body}</div>
            )}
          </div>
        )}

        {/* Tool invocations */}
        {message.tools && message.tools.length > 0 && (
          <div className="message-tools">
            {message.tools.map((tool, idx) => (
              <div key={idx} className="tool-item">
                🔧 {tool.name} - {tool.status}
              </div>
            ))}
          </div>
        )}

        {/* Main content */}
        <div className="message-body">
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <>
              {message.content ? (
                <ReactMarkdown
                  className="markdown-content"
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline ? (
                        <div className="code-block">
                          {match && (
                            <div className="code-language">{match[1]}</div>
                          )}
                          <pre>
                            <code className={className} {...props}>
                              {children}
                            </code>
                          </pre>
                        </div>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : message.isStreaming ? (
                <div className="message-loading">
                  <Loader2 className="spinner" size={16} />
                  <span>Copilot is thinking...</span>
                </div>
              ) : null}
            </>
          )}
        </div>

        {/* Error display */}
        {message.error && (
          <div className="message-error">
            ⚠️ {message.error}
          </div>
        )}

        {/* Streaming indicator */}
        {message.isStreaming && !message.error && (
          <div className="streaming-indicator">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;
