import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import ChatMessage from './ChatMessage';
import { apiService } from '../services/apiService';
import './ChatInterface.css';

function ChatInterface({ modelInfo, onRefreshWorkspace }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputValue.trim() || isLoading) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    const assistantMessage = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      chunks: [],
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      await apiService.sendChatMessage(
        inputValue,
        conversationId,
        // onChunk
        (chunk) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
              if (chunk.kind === 'markdown') {
                lastMessage.content += chunk.value;
              } else if (chunk.kind === 'progress') {
                lastMessage.progress = chunk.message;
              } else if (chunk.kind === 'thinking') {
                lastMessage.thinking = {
                  title: chunk.title,
                  body: chunk.body,
                };
              } else if (chunk.kind === 'tool') {
                lastMessage.tools = lastMessage.tools || [];
                lastMessage.tools.push(chunk);
              }

              lastMessage.chunks = lastMessage.chunks || [];
              lastMessage.chunks.push(chunk);
            }

            return newMessages;
          });
        },
        // onComplete
        (data) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.isStreaming = false;
              lastMessage.metadata = data.metadata;
            }

            return newMessages;
          });

          if (data.conversationId) {
            setConversationId(data.conversationId);
          }

          setIsLoading(false);

          // Refresh workspace if there might be changes
          if (onRefreshWorkspace) {
            onRefreshWorkspace();
          }
        },
        // onError
        (error) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.isStreaming = false;
              lastMessage.error = error.message || 'An error occurred';
              lastMessage.content = `❌ Error: ${error.message || 'An error occurred'}`;
            }

            return newMessages;
          });

          setIsLoading(false);
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationId(null);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">💬</span>
          <h2>Copilot Chat</h2>
          {modelInfo && (
            <span className="model-badge">{modelInfo.modelName}</span>
          )}
        </div>
        <button
          className="clear-button"
          onClick={handleClearChat}
          disabled={messages.length === 0}
        >
          Clear Chat
        </button>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🤖</div>
            <h3>Start a conversation with Copilot</h3>
            <p className="text-secondary">
              Ask questions about your code, request explanations, or get help with programming tasks.
            </p>
            <div className="example-prompts">
              <button
                className="example-prompt"
                onClick={() => setInputValue('Explain how async/await works in JavaScript')}
              >
                Explain how async/await works
              </button>
              <button
                className="example-prompt"
                onClick={() => setInputValue('What files are currently open?')}
              >
                What files are currently open?
              </button>
              <button
                className="example-prompt"
                onClick={() => setInputValue('Help me refactor this code')}
              >
                Help me refactor this code
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Copilot..."
            className="chat-input"
            rows={1}
            disabled={isLoading}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!inputValue.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="icon spinning" size={18} />
            ) : (
              <Send className="icon" size={18} />
            )}
          </button>
        </form>
        <div className="input-hint">
          Press <kbd>Enter</kbd> to send, <kbd>Shift+Enter</kbd> for new line
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;
