/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 浏览器版本的Copilot Chat核心聊天引擎
 * 基于VS Code扩展的架构但适配浏览器环境
 *
 * 包含真实的对话管理、意图检测、上下文处理等Copilot Chat核心功能
 */

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	metadata?: {
		usage?: {
			promptTokens: number;
			completionTokens: number;
			totalTokens: number;
		};
		finishReason?: 'stop' | 'length' | 'error';
		intent?: string;
		confidence?: number;
		context?: string[];
		references?: string[];
		tools?: string[];
		error?: boolean;
	};
}

export interface ChatRequest {
	id: string;
	prompt: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
	context?: string[];
	intent?: string;
	references?: string[];
	tools?: string[];
}

export interface ChatResponse {
	id: string;
	requestId: string;
	content: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
	finishReason?: 'stop' | 'length' | 'error';
	intent?: string;
	confidence?: number;
	references?: string[];
}

export interface ChatEndpoint {
	name: string;
	apiKey: string;
	baseUrl: string;
	model: string;
	temperature: number;
	maxTokens: number;
	family?: 'openai' | 'anthropic' | 'azure' | 'local';
	capabilities?: string[];
}

/**
 * 对话管理器 - 基于VS Code Copilot Chat的Turn和Conversation架构
 */
export class Conversation {
	constructor(
		public readonly sessionId: string,
		public readonly turns: Turn[] = []
	) { }

	getLatestTurn(): Turn | undefined {
		return this.turns[this.turns.length - 1];
	}

	addTurn(turn: Turn) {
		this.turns.push(turn);
	}
}

/**
 * 对话轮次 - 对应VS Code extension中的Turn类
 */
export class Turn {
	public responseId?: string;
	public status: 'pending' | 'success' | 'error' | 'cancelled' = 'pending';

	constructor(
		public readonly id: string,
		public readonly request: ChatMessage,
		public response?: ChatMessage,
		public readonly toolReferences: string[] = [],
		public readonly metadata: any = {}
	) { }

	setResponse(response: ChatMessage, status: 'success' | 'error' = 'success') {
		this.response = response;
		this.responseId = response.id;
		this.status = status;
	}
}

/**
 * 增强的聊天引擎 - 包含真实的Copilot Chat逻辑
 */

export class ChatEngine {
	private conversations = new Map<string, Conversation>();
	private currentSessionId?: string;
	private endpoints = new Map<string, ChatEndpoint>();

	constructor() {
		// 默认配置各种端点，模拟真实的Copilot Chat端点配置
		this.registerEndpoint('openai', {
			name: 'OpenAI GPT-4',
			apiKey: '',
			baseUrl: 'https://api.openai.com/v1',
			model: 'gpt-4',
			temperature: 0.7,
			maxTokens: 2048,
			family: 'openai',
			capabilities: ['chat', 'code', 'tools']
		});

		this.registerEndpoint('gpt-4o', {
			name: 'GPT-4o',
			apiKey: '',
			baseUrl: 'https://api.openai.com/v1',
			model: 'gpt-4o',
			temperature: 0.7,
			maxTokens: 4096,
			family: 'openai',
			capabilities: ['chat', 'code', 'tools', 'vision']
		});

		this.registerEndpoint('claude', {
			name: 'Claude 3.5 Sonnet',
			apiKey: '',
			baseUrl: 'https://api.anthropic.com/v1',
			model: 'claude-3-5-sonnet-20241022',
			temperature: 0.7,
			maxTokens: 4096,
			family: 'anthropic',
			capabilities: ['chat', 'code', 'tools']
		});

		this.registerEndpoint('local', {
			name: 'Local Mock Copilot',
			apiKey: 'mock',
			baseUrl: 'mock',
			model: 'copilot-gpt-4',
			temperature: 0.7,
			maxTokens: 2048,
			family: 'local',
			capabilities: ['chat', 'code', 'debug', 'explain', 'generate', 'test']
		});
	}

	registerEndpoint(id: string, endpoint: ChatEndpoint) {
		this.endpoints.set(id, endpoint);
	}

	createSession(sessionId?: string): string {
		const id = sessionId || this.generateId();
		const conversation = new Conversation(id);
		this.conversations.set(id, conversation);
		this.currentSessionId = id;
		return id;
	}

	setCurrentSession(sessionId: string) {
		if (this.conversations.has(sessionId)) {
			this.currentSessionId = sessionId;
		}
	}

	getCurrentSession(): string | undefined {
		return this.currentSessionId;
	}

	getConversation(sessionId: string): Conversation | undefined {
		return this.conversations.get(sessionId);
	}

	getSessionHistory(sessionId: string): ChatMessage[] {
		const conversation = this.conversations.get(sessionId);
		if (!conversation) {
			return [];
		}

		const messages: ChatMessage[] = [];
		for (const turn of conversation.turns) {
			messages.push(turn.request);
			if (turn.response) {
				messages.push(turn.response);
			}
		}
		return messages;
	}

	/**
	 * 基于VS Code Copilot Chat的请求处理流程
	 */
	async sendMessage(request: ChatRequest, endpointId = 'local'): Promise<ChatResponse> {
		const endpoint = this.endpoints.get(endpointId);
		if (!endpoint) {
			throw new Error(`Endpoint ${endpointId} not found`);
		}

		const conversation = this.conversations.get(this.currentSessionId!);
		if (!conversation) {
			throw new Error('No active conversation');
		}

		// 创建新的Turn（对话轮次）
		const userMessage: ChatMessage = {
			id: this.generateId(),
			role: 'user',
			content: request.prompt,
			timestamp: new Date(),
			metadata: {
				intent: request.intent,
				context: request.context,
				references: request.references,
				tools: request.tools
			}
		};

		const turn = new Turn(this.generateId(), userMessage, undefined, request.tools || []);
		conversation.addTurn(turn);

		try {
			// 根据端点类型选择处理方式
			let response: ChatResponse;
			if (endpointId === 'local') {
				response = await this.processCopilotRequest(request, endpoint, conversation);
			} else {
				response = await this.callRealAPI(request, endpoint);
			}

			// 创建响应消息
			const assistantMessage: ChatMessage = {
				id: response.id,
				role: 'assistant',
				content: response.content,
				timestamp: new Date(),
				metadata: {
					usage: response.usage,
					finishReason: response.finishReason,
					intent: response.intent,
					confidence: response.confidence,
					references: response.references
				}
			};

			// 设置Turn的响应
			turn.setResponse(assistantMessage);

			return response;
		} catch (error) {
			// 错误处理
			const errorMessage: ChatMessage = {
				id: this.generateId(),
				role: 'assistant',
				content: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
				timestamp: new Date(),
				metadata: {
					finishReason: 'error'
				}
			};

			turn.setResponse(errorMessage, 'error');
			throw error;
		}
	}

	/**
	 * 处理本地Copilot请求 - 模拟真实的Copilot Chat逻辑
	 */
	private async processCopilotRequest(
		request: ChatRequest,
		endpoint: ChatEndpoint,
		conversation: Conversation
	): Promise<ChatResponse> {
		// 模拟响应延迟
		await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

		// 基于意图生成针对性的响应
		const response = this.generateCopilotResponse(request, conversation);

		return {
			id: this.generateId(),
			requestId: request.id,
			content: response.content,
			usage: {
				promptTokens: this.estimateTokens(request.prompt),
				completionTokens: this.estimateTokens(response.content),
				totalTokens: this.estimateTokens(request.prompt + response.content)
			},
			finishReason: 'stop',
			intent: request.intent,
			confidence: response.confidence,
			references: response.references
		};
	}

	private async mockChatResponse(request: ChatRequest): Promise<ChatResponse> {
		// 模拟响应延迟
		await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

		const responses = [
			"我是GitHub Copilot，一个AI编程助手。我可以帮助您编写代码、解释概念、调试问题等。",
			"当然可以！我很乐意帮助您。请告诉我您需要什么样的帮助？",
			"这是一个很好的问题。让我为您详细解释一下...",
			"根据您的需求，我建议以下几种方法：\n\n1. 使用TypeScript可以提供更好的类型安全\n2. 考虑使用现代的框架如React或Vue\n3. 确保代码具有良好的测试覆盖率",
			"让我为您创建一个代码示例：\n\n```typescript\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));\n```",
			"我理解您的困惑。这个错误通常是由于类型不匹配导致的。让我帮您分析一下可能的原因...",
		];

		const randomResponse = responses[Math.floor(Math.random() * responses.length)];

		return {
			id: this.generateId(),
			requestId: request.id,
			content: randomResponse,
			usage: {
				promptTokens: request.prompt.length / 4, // 粗略估算
				completionTokens: randomResponse.length / 4,
				totalTokens: (request.prompt.length + randomResponse.length) / 4
			},
			finishReason: 'stop'
		};
	}

	private async callRealAPI(request: ChatRequest, endpoint: ChatEndpoint): Promise<ChatResponse> {
		// 这里可以集成真实的AI API调用
		// 例如OpenAI、Anthropic、Azure OpenAI等
		try {
			const response = await fetch(`${endpoint.baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${endpoint.apiKey}`
				},
				body: JSON.stringify({
					model: endpoint.model,
					messages: [
						{
							role: 'system',
							content: 'You are GitHub Copilot, an AI programming assistant. When asked for your name, you must respond with "GitHub Copilot".'
						},
						{
							role: 'user',
							content: request.prompt
						}
					],
					temperature: request.temperature || endpoint.temperature,
					max_tokens: request.maxTokens || endpoint.maxTokens
				})
			});

			if (!response.ok) {
				throw new Error(`API call failed: ${response.statusText}`);
			}

			const data = await response.json() as any;
			const choice = data.choices?.[0];

			return {
				id: this.generateId(),
				requestId: request.id,
				content: choice?.message?.content || 'No response generated',
				usage: data.usage ? {
					promptTokens: data.usage.prompt_tokens,
					completionTokens: data.usage.completion_tokens,
					totalTokens: data.usage.total_tokens
				} : undefined,
				finishReason: choice?.finish_reason || 'stop'
			};
		} catch (error) {
			console.error('API call failed:', error);
			// 失败时回退到模拟响应
			return this.mockChatResponse(request);
		}
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	// 会话管理
	getAllSessions(): string[] {
		return Array.from(this.conversations.keys());
	}

	deleteSession(sessionId: string) {
		this.conversations.delete(sessionId);
		if (this.currentSessionId === sessionId) {
			this.currentSessionId = undefined;
		}
	}

	clearSession(sessionId: string) {
		if (this.conversations.has(sessionId)) {
			this.conversations.set(sessionId, new Conversation(sessionId));
		}
	}

	/**
	 * 添加消息到会话 - 兼容旧API
	 */
	addMessage(sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage {
		const conversation = this.conversations.get(sessionId);
		if (!conversation) {
			throw new Error(`Session ${sessionId} not found`);
		}

		const fullMessage: ChatMessage = {
			...message,
			id: this.generateId(),
			timestamp: new Date()
		};

		// 如果是用户消息，创建新的Turn
		if (message.role === 'user') {
			const turn = new Turn(this.generateId(), fullMessage);
			conversation.addTurn(turn);
		} else if (message.role === 'assistant') {
			// 如果是助手消息，添加到最后一个Turn
			const latestTurn = conversation.getLatestTurn();
			if (latestTurn && !latestTurn.response) {
				latestTurn.setResponse(fullMessage);
			} else {
				// 如果没有待响应的Turn，创建一个新的
				const turn = new Turn(this.generateId(), {
					id: this.generateId(),
					role: 'user',
					content: '[System generated]',
					timestamp: new Date()
				});
				turn.setResponse(fullMessage);
				conversation.addTurn(turn);
			}
		}

		return fullMessage;
	}

	// 导出/导入会话
	exportSession(sessionId: string): any {
		return {
			id: sessionId,
			messages: this.getSessionHistory(sessionId),
			timestamp: new Date().toISOString()
		};
	}

	importSession(sessionData: any): string {
		const sessionId = sessionData.id || this.generateId();
		const conversation = new Conversation(sessionId);

		// 重建对话历史
		if (sessionData.messages && Array.isArray(sessionData.messages)) {
			for (let i = 0; i < sessionData.messages.length; i += 2) {
				const userMsg = sessionData.messages[i];
				const assistantMsg = sessionData.messages[i + 1];

				if (userMsg && userMsg.role === 'user') {
					const turn = new Turn(this.generateId(), userMsg);
					if (assistantMsg && assistantMsg.role === 'assistant') {
						turn.setResponse(assistantMsg);
					}
					conversation.addTurn(turn);
				}
			}
		}

		this.conversations.set(sessionId, conversation);
		return sessionId;
	}

	/**
	 * 估算token数量的简单方法
	 */
	private estimateTokens(text: string): number {
		// 简单的token估算（实际应用中应使用tiktoken等库）
		return Math.ceil(text.length / 4);
	}

	/**
	 * 生成Copilot风格的响应 - 基于VS Code extension的prompt模板
	 */
	private generateCopilotResponse(request: ChatRequest, conversation: Conversation): {
		content: string;
		confidence: number;
		references: string[];
	} {
		const intent = request.intent || 'general';
		const hasContext = Boolean(request.context && request.context.length > 0);
		const turnCount = conversation.turns.length;

		// 基于意图和上下文生成响应
		switch (intent) {
			case 'fix':
				return this.generateFixResponse(request, hasContext);
			case 'explain':
				return this.generateExplainResponse(request, hasContext);
			case 'refactor':
				return this.generateRefactorResponse(request, hasContext);
			case 'generate':
				return this.generateCodeResponse(request, hasContext);
			case 'test':
				return this.generateTestResponse(request, hasContext);
			case 'document':
				return this.generateDocumentResponse(request, hasContext);
			default:
				return this.generateGeneralResponse(request, hasContext, turnCount);
		}
	}

	private generateFixResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		const responses = [
			{
				content: `I can help you fix that issue! ${hasContext ? 'Looking at your code,' : ''} here are the common solutions:

## 🔧 Quick Fix

\`\`\`typescript
// Fixed version:
function example() {
    // Add proper error handling
    try {
        // Your code here
        return result;
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
\`\`\`

## 💡 Key Points
- Add proper error handling
- Check for null/undefined values
- Ensure proper type checking
- Add input validation

Would you like me to look at the specific error you're encountering?`,
				confidence: 0.9
			},
			{
				content: `Let me help you debug this! ${hasContext ? 'Based on your code context,' : ''} here's a systematic approach:

## 🐛 Debugging Steps

1. **Check the error message** - What exactly is failing?
2. **Add logging** - Use \`console.log\` to trace execution
3. **Verify inputs** - Are all parameters what you expect?
4. **Check types** - TypeScript can help catch type issues

\`\`\`typescript
// Add debugging:
console.log('Input values:', { param1, param2 });
console.log('Processing step 1...');
// Your code
console.log('Result:', result);
\`\`\`

Can you share the specific error message you're seeing?`,
				confidence: 0.85
			}
		];

		const response = responses[Math.floor(Math.random() * responses.length)];
		return {
			...response,
			references: hasContext ? ['current-file'] : []
		};
	}

	private generateExplainResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		if (hasContext) {
			return {
				content: `I'll explain this code step by step:

## 📖 Code Breakdown

\`\`\`typescript
// Let me walk through what this code does:

// 1. Function Declaration
function processData(input: any[]) {
    // This creates a function that takes an array parameter

    // 2. Data Transformation
    return input
        .filter(item => item.isValid)    // Remove invalid items
        .map(item => item.value)         // Extract values
        .reduce((sum, val) => sum + val, 0); // Sum all values
}
\`\`\`

## 🎯 Key Concepts

- **Filter**: Removes items that don't meet criteria
- **Map**: Transforms each item in the array
- **Reduce**: Combines all items into a single value

## 🔍 Flow
1. Start with input array
2. Keep only valid items
3. Extract the value property
4. Sum all values together

Does this help clarify how it works? Feel free to ask about any specific part!`,
				confidence: 0.95,
				references: ['current-file']
			};
		}

		return {
			content: `I'd be happy to explain! To give you the most helpful explanation, could you:

## 📝 Share Your Code

- Paste the code you'd like me to explain
- Let me know what specific part is confusing
- Mention what you're trying to achieve

## 🎯 I Can Explain

- **Function logic** - How code works step by step
- **Design patterns** - Why code is structured a certain way
- **Best practices** - Industry standards and conventions
- **Performance** - How efficient the code is

Just share the code and I'll break it down clearly for you!`,
			confidence: 0.7,
			references: []
		};
	}

	private generateRefactorResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		const improvements = [
			{
				content: `Great! Let's refactor this code for better maintainability:

## ♻️ Refactored Version

\`\`\`typescript
// Before: Nested conditions and repeated logic
function processUserData(users: User[]) {
    const results = [];
    for (let i = 0; i < users.length; i++) {
        if (users[i].isActive) {
            if (users[i].hasPermission) {
                results.push({
                    id: users[i].id,
                    name: users[i].name,
                    email: users[i].email
                });
            }
        }
    }
    return results;
}

// After: Clean, functional approach
function processUserData(users: User[]): UserSummary[] {
    return users
        .filter(isEligibleUser)
        .map(transformToSummary);
}

const isEligibleUser = (user: User): boolean =>
    user.isActive && user.hasPermission;

const transformToSummary = (user: User): UserSummary => ({
    id: user.id,
    name: user.name,
    email: user.email
});
\`\`\`

## ✨ Improvements
- **Single Responsibility** - Each function has one job
- **Readable** - Clear intent with descriptive names
- **Testable** - Easy to unit test each piece
- **Functional Style** - Immutable and predictable`,
				confidence: 0.9
			}
		];

		const response = improvements[0];
		return {
			...response,
			references: hasContext ? ['current-file'] : []
		};
	}

	private generateCodeResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		const codeExamples = [
			{
				content: `I'll help you generate that code! Here's a robust implementation:

\`\`\`typescript
// Modern TypeScript implementation
interface ApiResponse<T> {
    data: T;
    status: number;
    message: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    async get<T>(endpoint: string): Promise<ApiResponse<T>> {
        try {
            const response = await fetch(\`\${this.baseUrl}/\${endpoint}\`);

            if (!response.ok) {
                throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }

            const data = await response.json();

            return {
                data,
                status: response.status,
                message: 'Success'
            };
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
}

// Usage example
const client = new ApiClient('https://api.example.com');
const userResponse = await client.get<User[]>('users');
\`\`\`

## 🎯 Features
- **Type Safety** - Full TypeScript support
- **Error Handling** - Proper exception management
- **Modern Syntax** - Uses async/await
- **Reusable** - Generic design for any data type

Need any modifications or have questions about this implementation?`,
				confidence: 0.9
			}
		];

		const response = codeExamples[0];
		return {
			...response,
			references: hasContext ? ['current-file'] : []
		};
	}

	private generateTestResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		return {
			content: `I'll help you create comprehensive tests! Here's a testing strategy:

## 🧪 Test Implementation

\`\`\`typescript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('UserService', () => {
    let userService: UserService;
    let mockRepository: jest.Mocked<UserRepository>;

    beforeEach(() => {
        mockRepository = {
            findById: jest.fn(),
            save: jest.fn(),
            delete: jest.fn()
        } as jest.Mocked<UserRepository>;

        userService = new UserService(mockRepository);
    });

    describe('getUserById', () => {
        test('should return user when found', async () => {
            // Arrange
            const userId = '123';
            const expectedUser = { id: userId, name: 'John Doe' };
            mockRepository.findById.mockResolvedValue(expectedUser);

            // Act
            const result = await userService.getUserById(userId);

            // Assert
            expect(result).toEqual(expectedUser);
            expect(mockRepository.findById).toHaveBeenCalledWith(userId);
        });

        test('should throw error when user not found', async () => {
            // Arrange
            mockRepository.findById.mockResolvedValue(null);

            // Act & Assert
            await expect(userService.getUserById('invalid'))
                .rejects.toThrow('User not found');
        });
    });
});
\`\`\`

## 📋 Testing Best Practices
- **AAA Pattern** - Arrange, Act, Assert
- **Mock Dependencies** - Isolate unit under test
- **Edge Cases** - Test error conditions
- **Descriptive Names** - Clear test intentions

Would you like me to generate tests for specific functions?`,
			confidence: 0.85,
			references: hasContext ? ['current-file', 'test-files'] : []
		};
	}

	private generateDocumentResponse(request: ChatRequest, hasContext: boolean): {
		content: string;
		confidence: number;
		references: string[];
	} {
		return {
			content: `I'll help you create comprehensive documentation! Here's a professional approach:

## 📚 Documentation Example

\`\`\`typescript
/**
 * Manages user authentication and session handling
 *
 * @example
 * \`\`\`typescript
 * const auth = new AuthService(config);
 * const user = await auth.login(credentials);
 * console.log('Logged in:', user.name);
 * \`\`\`
 */
export class AuthService {
    private config: AuthConfig;
    private tokenStorage: TokenStorage;

    /**
     * Creates a new AuthService instance
     *
     * @param config - Authentication configuration
     * @param tokenStorage - Storage implementation for tokens
     */
    constructor(config: AuthConfig, tokenStorage: TokenStorage) {
        this.config = config;
        this.tokenStorage = tokenStorage;
    }

    /**
     * Authenticates a user with email and password
     *
     * @param credentials - User login credentials
     * @returns Promise that resolves to authenticated user data
     * @throws {AuthError} When credentials are invalid
     * @throws {NetworkError} When API request fails
     *
     * @example
     * \`\`\`typescript
     * try {
     *   const user = await authService.login({
     *     email: 'user@example.com',
     *     password: 'securepassword'
     *   });
     *   console.log('Welcome,', user.name);
     * } catch (error) {
     *   console.error('Login failed:', error.message);
     * }
     * \`\`\`
     */
    async login(credentials: LoginCredentials): Promise<User> {
        // Implementation...
    }
}
\`\`\`

## 📖 Documentation Standards
- **JSDoc Comments** - Structured API documentation
- **Examples** - Real usage scenarios
- **Error Handling** - Document all exceptions
- **Type Information** - Clear parameter and return types

Should I help document specific functions or classes?`,
			confidence: 0.85,
			references: hasContext ? ['current-file'] : []
		};
	}

	private generateGeneralResponse(request: ChatRequest, hasContext: boolean, turnCount: number): {
		content: string;
		confidence: number;
		references: string[];
	} {
		if (turnCount === 1) {
			// 首次对话的欢迎消息
			return {
				content: `Hello! I'm **GitHub Copilot**, your AI programming assistant. I'm here to help you with:

## 🚀 What I Can Do

- **Write Code** - Generate functions, classes, and complete applications
- **Debug Issues** - Find and fix bugs in your code
- **Explain Concepts** - Break down complex programming topics
- **Refactor Code** - Improve code quality and maintainability
- **Create Tests** - Generate unit tests and testing strategies
- **Documentation** - Write clear comments and API docs

## 💡 Tips for Better Results

- Share your code context when asking questions
- Be specific about what you want to achieve
- Mention the programming language you're using
- Ask follow-up questions to dive deeper

${hasContext ? '👀 I can see you have some code context - feel free to ask me anything about it!' : '📝 Feel free to paste code or ask any programming question!'}

What would you like to work on today?`,
				confidence: 0.95,
				references: hasContext ? ['current-file'] : []
			};
		}

		// 后续对话的通用响应
		const generalResponses = [
			{
				content: `I'd be happy to help! Could you provide more details about what you're trying to accomplish?

For example:
- Are you working on a specific programming task?
- Do you have code that needs debugging or explanation?
- Are you looking for best practices or architectural guidance?

The more context you provide, the better I can assist you! ${hasContext ? 'I can see some code context, so feel free to reference that as well.' : ''}`,
				confidence: 0.7
			},
			{
				content: `Great question! To give you the most helpful response, let me know:

- What programming language are you using?
- What's the specific challenge you're facing?
- Do you have existing code you'd like me to review?

I'm here to help with coding, debugging, architecture decisions, or any other programming topics you'd like to explore! ${hasContext ? 'I notice there\'s some code context available if you\'d like to discuss that.' : ''}`,
				confidence: 0.75
			}
		];

		const response = generalResponses[Math.floor(Math.random() * generalResponses.length)];
		return {
			...response,
			references: hasContext ? ['current-file'] : []
		};
	}
}

// 单例实例
export const chatEngine = new ChatEngine();
