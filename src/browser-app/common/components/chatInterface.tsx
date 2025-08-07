/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { chatEngine, ChatMessage } from '../core/chatEngine';
import { CodeContext, contextProcessor, WorkspaceContext } from '../core/contextProcessor';

export interface ChatInterfaceProps {
	selectedFile?: string | null;
	codeContext?: CodeContext;
	workspaceContext?: WorkspaceContext;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ selectedFile, codeContext, workspaceContext }) => {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [inputValue, setInputValue] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [currentSessionId, setCurrentSessionId] = useState<string>();
	const [selectedEndpoint, setSelectedEndpoint] = useState('local');
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 初始化会话
	useEffect(() => {
		const sessionId = chatEngine.createSession();
		setCurrentSessionId(sessionId);

		// 添加欢迎消息
		const welcomeMessage = chatEngine.addMessage(sessionId, {
			role: 'assistant',
			content: `👋 Hello! I'm **GitHub Copilot**, your AI programming assistant.

I can help you with:
- **Writing code** in any programming language
- **Debugging** and fixing errors
- **Explaining** complex code concepts
- **Refactoring** and optimizing code
- **Creating tests** and documentation
- **Architecture** and design decisions

What would you like to work on today?`
		});

		setMessages([welcomeMessage]);
	}, []);

	// 设置上下文
	useEffect(() => {
		if (codeContext) {
			contextProcessor.setCodeContext(codeContext);
		}
	}, [codeContext]);

	useEffect(() => {
		if (workspaceContext) {
			contextProcessor.setWorkspaceContext(workspaceContext);
		}
	}, [workspaceContext]);

	// 自动滚动到底部
	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, scrollToBottom]);

	const sendMessage = useCallback(async () => {
		if (!inputValue.trim() || !currentSessionId || isLoading) {
			return;
		}

		const userInput = inputValue.trim();
		setInputValue('');
		setIsLoading(true);

		try {
			// 添加用户消息
			const userMessage = chatEngine.addMessage(currentSessionId, {
				role: 'user',
				content: userInput
			});

			setMessages(prev => [...prev, userMessage]);

			// 处理请求并获取上下文
			const request = contextProcessor.processRequest(userInput, messages);

			// 发送到AI
			const response = await chatEngine.sendMessage(request, selectedEndpoint);

			// 添加AI响应
			const assistantMessage = chatEngine.addMessage(currentSessionId, {
				role: 'assistant',
				content: response.content,
				metadata: {
					usage: response.usage,
					finishReason: response.finishReason
				}
			});

			setMessages(prev => [...prev, assistantMessage]);

		} catch (error) {
			console.error('Chat error:', error);
			const errorMessage = chatEngine.addMessage(currentSessionId!, {
				role: 'assistant',
				content: '❌ Sorry, I encountered an error while processing your request. Please try again.',
				metadata: { error: true }
			});
			setMessages(prev => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	}, [inputValue, isLoading, currentSessionId, selectedEndpoint, messages]);

	const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}, [sendMessage]);

	const clearChat = useCallback(() => {
		if (currentSessionId) {
			chatEngine.clearSession(currentSessionId);
			setMessages([]);

			// 重新添加欢迎消息
			const welcomeMessage = chatEngine.addMessage(currentSessionId, {
				role: 'assistant',
				content: 'Chat cleared! How can I help you today?'
			});
			setMessages([welcomeMessage]);
		}
	}, [currentSessionId]);

	const newChat = useCallback(() => {
		const sessionId = chatEngine.createSession();
		setCurrentSessionId(sessionId);
		setMessages([]);

		const welcomeMessage = chatEngine.addMessage(sessionId, {
			role: 'assistant',
			content: 'New chat started! What would you like to work on?'
		});
		setMessages([welcomeMessage]);
	}, []);

	const formatMessageContent = useCallback((content: string) => {
		// 简单的markdown渲染
		const parts = content.split(/(```[\s\S]*?```)/);

		return parts.map((part, index) => {
			if (part.startsWith('```') && part.endsWith('```')) {
				const code = part.slice(3, -3);
				const lines = code.split('\n');
				const language = lines[0].trim();
				const codeContent = lines.slice(1).join('\n');

				return (
					<pre key={index} className="code-block">
						{language && <div className="code-language">{language}</div>}
						<code>{codeContent}</code>
					</pre>
				);
			}

			// 处理其他markdown如粗体、链接等
			return (
				<div key={index} dangerouslySetInnerHTML={{
					__html: part
						.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
						.replace(/\*(.*?)\*/g, '<em>$1</em>')
						.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>')
						.replace(/\n/g, '<br>')
				}} />
			);
		});
	}, []);

	const getIntentIndicator = useCallback(() => {
		if (!inputValue.trim()) {
			return null;
		}

		const { intent, confidence } = contextProcessor.getIntentConfidence(inputValue, codeContext);

		if (confidence > 0.3) {
			const intentEmojis: Record<string, string> = {
				fix: '🔧',
				explain: '💡',
				refactor: '♻️',
				generate: '✨',
				enhance: '➕',
				test: '🧪',
				document: '📝',
				general: '💬'
			};

			return (
				<div className="intent-indicator">
					<span className="intent-icon">{intentEmojis[intent] || '🎯'}</span>
					<span className="intent-text">
						Intent: <strong>{intent}</strong>
						<small>({Math.round(confidence * 100)}%)</small>
					</span>
				</div>
			);
		}

		return null;
	}, [inputValue, codeContext]);

	return (
		<div className="chat-interface">
			<div className="chat-header">
				<h3>💬 GitHub Copilot Chat</h3>
				<div className="chat-controls">
					<select
						value={selectedEndpoint}
						onChange={(e) => setSelectedEndpoint((e.target as any).value)}
						className="endpoint-selector"
						title="Select AI Model"
					>
						<option value="local">🔧 Mock Local</option>
						<option value="openai">🌐 OpenAI</option>
					</select>
					<button onClick={newChat} className="control-button" title="New Chat">
						📝
					</button>
					<button onClick={clearChat} className="control-button" title="Clear Chat">
						🗑️
					</button>
				</div>
			</div>

			<div className="chat-messages">
				{messages.map(message => {
					const isUser = message.role === 'user';
					const isError = message.metadata?.error;

					return (
						<div key={message.id} className={`message ${message.role} ${isError ? 'error' : ''}`}>
							<div className="message-header">
								<span className="role">
									{isUser ? '👤 You' : '🤖 GitHub Copilot'}
								</span>
								<span className="timestamp">
									{message.timestamp.toLocaleTimeString()}
								</span>
							</div>
							<div className="message-content">
								{formatMessageContent(message.content)}
							</div>
							{message.metadata?.usage && (
								<div className="message-metadata">
									<small>
										Tokens: {message.metadata.usage.totalTokens}
										({message.metadata.usage.promptTokens}p + {message.metadata.usage.completionTokens}c)
									</small>
								</div>
							)}
						</div>
					);
				})}

				{isLoading && (
					<div className="message assistant loading">
						<div className="message-header">
							<span className="role">🤖 GitHub Copilot</span>
						</div>
						<div className="message-content">
							<div className="typing-indicator">
								<span></span>
								<span></span>
								<span></span>
							</div>
							Thinking...
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			<div className="chat-input">
				{getIntentIndicator()}
				<div className="input-container">
					<textarea
						value={inputValue}
						onChange={(e) => setInputValue((e.target as any).value)}
						onKeyDown={handleKeyPress}
						placeholder="Ask Copilot anything about your code..."
						rows={1}
						disabled={isLoading}
						style={{
							resize: 'vertical',
							minHeight: '40px',
							maxHeight: '120px'
						}}
					/>
					<button
						onClick={sendMessage}
						disabled={!inputValue.trim() || isLoading}
						className="send-button"
						title="Send message (Enter)"
					>
						{isLoading ? '⏳' : '📤'}
					</button>
				</div>
				<div className="input-hint">
					💡 <strong>Tips:</strong> Be specific about what you need help with.
					Include error messages, describe your goal, or ask about specific code concepts.
					{selectedFile && <span> • Current context: <strong>{selectedFile}</strong></span>}
				</div>
			</div>
		</div>
	);
};
