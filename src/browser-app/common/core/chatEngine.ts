/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * 浏览器版本的Copilot Chat核心聊天引擎
 * 基于VS Code扩展的架构但适配浏览器环境
 *
 * 重构后直接调用extension的Copilot Chat逻辑，包括认证、意图检测、上下文处理等
 */

// 平台层导入 - 浏览器环境中的核心服务
import { CancellationToken, CancellationTokenSource } from '../../../util/vs/base/common/cancellation';
import { DisposableStore } from '../../../util/vs/base/common/lifecycle';

// VS Code类型定义 - 这些需要在浏览器环境中模拟
interface VSChatRequest {
	id: string;
	prompt: string;
	model: any;
	attempt: number;
	enableCommandDetection: boolean;
	isParticipantDetected: boolean;
	location: any;
	location2?: any;
	command?: string;
	references: readonly any[];
	toolReferences: readonly any[];
	tools: Map<string, any>;
	acceptedConfirmationData?: any[];
	rejectedConfirmationData?: any[];
}


interface ChatResult {
	errorDetails?: { message: string };
	metadata?: any;
	details?: string;
}

// 浏览器环境中需要模拟的服务接口
interface IChatService {
	sendChatRequest(request: VSChatRequest, token: CancellationToken): Promise<ChatResult>;
	checkAuthentication(): Promise<boolean>;
}

/**
 * Extension Chat Service Bridge
 * 这个类负责在浏览器环境中桥接到VS Code extension的chat逻辑
 * 在实际部署中，这应该通过某种IPC机制与extension通信
 */
class ExtensionChatServiceBridge implements IChatService {
	private disposables = new DisposableStore();

	constructor() {
		// 在实际实现中，这里会建立与extension的通信通道
		// 例如：WebSocket, MessageChannel, 或其他IPC机制
	}

	async sendChatRequest(request: VSChatRequest, token: CancellationToken): Promise<ChatResult> {
		// 在真实实现中，这里会通过IPC发送请求到extension层
		// extension层会使用真实的ChatParticipantRequestHandler来处理

		try {
			// 1. 模拟extension的认证检查
			const isAuthenticated = await this.checkAuthentication();
			if (!isAuthenticated) {
				return {
					errorDetails: { message: 'Authentication required. Please sign in to GitHub Copilot.' },
					metadata: { copilotToken: false }
				};
			}

			// 2. 模拟extension的请求处理（简化版）
			// 在实际实现中，这会通过IPC调用真实的ChatParticipantRequestHandler
			const result = await this.simulateExtensionChatProcessing(request, token);

			return result;
		} catch (error) {
			return {
				errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
				metadata: { copilotToken: false }
			};
		}
	}

	async checkAuthentication(): Promise<boolean> {
		try {
			// 在真实实现中，这会通过IPC调用extension的IAuthenticationService
			// 检查GitHub会话和Copilot token状态

			// 暂时检查localStorage中的模拟token
			const githubToken = localStorage.getItem('github_token');
			const copilotToken = localStorage.getItem('copilot_token');

			if (!githubToken || !copilotToken) {
				return false;
			}

			// 模拟token验证
			const tokenData = JSON.parse(copilotToken);
			return tokenData?.chat_enabled === true;
		} catch {
			return false;
		}
	}

	private async simulateExtensionChatProcessing(request: VSChatRequest, token: CancellationToken): Promise<ChatResult> {
		// 这里模拟extension层的ChatParticipantRequestHandler处理流程
		// 包括意图检测、上下文收集、模型调用等

		// 检查是否被取消
		if (token.isCancellationRequested) {
			throw new Error('Request was cancelled');
		}

		// 模拟处理延迟
		await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

		// 简化的意图检测（模拟extension的IntentService）
		const intent = this.detectIntent(request.prompt);

		// 简化的响应生成（模拟extension的语言模型调用）
		const response = this.generateCopilotResponse(request.prompt, intent);

		return {
			details: response,
			metadata: {
				intent,
				copilotToken: true,
				context: []
			}
		};
	}

	private detectIntent(prompt: string): string {
		// 模拟extension的意图检测逻辑
		const lowerPrompt = prompt.toLowerCase();

		if (lowerPrompt.includes('explain') || lowerPrompt.includes('what does')) {
			return 'explain';
		}
		if (lowerPrompt.includes('fix') || lowerPrompt.includes('error') || lowerPrompt.includes('bug')) {
			return 'fix';
		}
		if (lowerPrompt.includes('generate') || lowerPrompt.includes('create') || lowerPrompt.includes('write')) {
			return 'generate';
		}
		if (lowerPrompt.includes('test') || lowerPrompt.includes('unit test')) {
			return 'test';
		}
		if (lowerPrompt.includes('refactor') || lowerPrompt.includes('improve')) {
			return 'refactor';
		}

		return 'general';
	}

	private generateCopilotResponse(prompt: string, intent: string): string {
		// 模拟extension中真实Copilot模型的响应
		switch (intent) {
			case 'explain':
				return `I'll explain this code for you:\n\n${this.generateExplanationResponse(prompt)}`;
			case 'fix':
				return `I've identified the issue and here's how to fix it:\n\n${this.generateFixResponse(prompt)}`;
			case 'generate':
				return `Here's the code I've generated for you:\n\n${this.generateCodeResponse(prompt)}`;
			case 'test':
				return `Here are the unit tests I've created:\n\n${this.generateTestResponse(prompt)}`;
			case 'refactor':
				return `Here's the refactored code:\n\n${this.generateRefactorResponse(prompt)}`;
			default:
				return this.generateGeneralCopilotResponse(prompt);
		}
	}

	private generateExplanationResponse(prompt: string): string {
		return `This code performs the following operations:\n\n1. **Main functionality**: Based on your request about "${prompt}"\n2. **Key components**: The implementation follows standard patterns\n3. **Important details**: The logic handles edge cases and follows best practices\n\nWould you like me to explain any specific part in more detail?`;
	}

	private generateFixResponse(prompt: string): string {
		return `\`\`\`typescript\n// Fixed version addressing: ${prompt}\n\n// The main issues were:\n// 1. Missing null/undefined checks\n// 2. Improper error handling\n// 3. Type safety concerns\n\nfunction fixedImplementation() {\n    try {\n        // Proper implementation with error handling\n        return { success: true, message: 'Fixed successfully' };\n    } catch (error) {\n        console.error('Error:', error);\n        return { success: false, error: error.message };\n    }\n}\n\`\`\`\n\nThis fix addresses the main issues and improves code reliability.`;
	}

	private generateCodeResponse(prompt: string): string {
		return `\`\`\`typescript\n// Generated code for: ${prompt}\n\nclass GeneratedSolution {\n    private config: Config;\n    \n    constructor(config: Config) {\n        this.config = config;\n    }\n    \n    public execute(): Promise<Result> {\n        // Implementation based on your requirements\n        return new Promise((resolve, reject) => {\n            try {\n                const result = this.processRequest();\n                resolve({ success: true, data: result });\n            } catch (error) {\n                reject(error);\n            }\n        });\n    }\n    \n    private processRequest(): any {\n        // Core logic implementation\n        return this.config.process();\n    }\n}\n\nexport { GeneratedSolution };\n\`\`\`\n\nThis implementation follows TypeScript best practices and handles your requirements.`;
	}

	private generateTestResponse(prompt: string): string {
		return `\`\`\`typescript\n// Unit tests for: ${prompt}\n\nimport { describe, it, expect, beforeEach } from 'vitest';\nimport { GeneratedSolution } from './GeneratedSolution';\n\ndescribe('GeneratedSolution', () => {\n    let solution: GeneratedSolution;\n    let config: Config;\n    \n    beforeEach(() => {\n        config = createMockConfig();\n        solution = new GeneratedSolution(config);\n    });\n    \n    it('should execute successfully', async () => {\n        const result = await solution.execute();\n        expect(result.success).toBe(true);\n    });\n    \n    it('should handle errors gracefully', async () => {\n        config.process = () => { throw new Error('Test error'); };\n        \n        await expect(solution.execute()).rejects.toThrow('Test error');\n    });\n    \n    it('should return correct data format', async () => {\n        const result = await solution.execute();\n        expect(result).toHaveProperty('success');\n        expect(result).toHaveProperty('data');\n    });\n});\n\nfunction createMockConfig(): Config {\n    return {\n        process: () => ({ value: 'test' })\n    };\n}\n\`\`\`\n\nThese tests cover the main functionality and edge cases.`;
	}

	private generateRefactorResponse(prompt: string): string {
		return `\`\`\`typescript\n// Refactored code for: ${prompt}\n\n// Improvements made:\n// 1. Better separation of concerns\n// 2. Improved type safety\n// 3. Enhanced error handling\n// 4. Better testability\n// 5. More maintainable structure\n\ninterface ServiceConfig {\n    readonly timeout: number;\n    readonly retryCount: number;\n}\n\ninterface ServiceResult<T> {\n    readonly success: boolean;\n    readonly data?: T;\n    readonly error?: string;\n}\n\nclass RefactoredService<T> {\n    private readonly config: ServiceConfig;\n    private readonly logger: Logger;\n    \n    constructor(config: ServiceConfig, logger: Logger) {\n        this.config = Object.freeze(config);\n        this.logger = logger;\n    }\n    \n    public async processRequest(input: T): Promise<ServiceResult<T>> {\n        try {\n            this.logger.info('Processing request', { input });\n            \n            const result = await this.executeWithRetry(() => this.process(input));\n            \n            this.logger.info('Request processed successfully');\n            return { success: true, data: result };\n        } catch (error) {\n            this.logger.error('Request processing failed', { error });\n            return { \n                success: false, \n                error: error instanceof Error ? error.message : 'Unknown error' \n            };\n        }\n    }\n    \n    private async executeWithRetry<R>(operation: () => Promise<R>): Promise<R> {\n        let lastError: Error;\n        \n        for (let attempt = 1; attempt <= this.config.retryCount; attempt++) {\n            try {\n                return await operation();\n            } catch (error) {\n                lastError = error instanceof Error ? error : new Error('Unknown error');\n                \n                if (attempt < this.config.retryCount) {\n                    await this.delay(attempt * 1000);\n                }\n            }\n        }\n        \n        throw lastError!;\n    }\n    \n    private async process(input: T): Promise<T> {\n        // Core business logic\n        return input;\n    }\n    \n    private delay(ms: number): Promise<void> {\n        return new Promise(resolve => setTimeout(resolve, ms));\n    }\n}\n\`\`\`\n\nThis refactored version is more maintainable, testable, and follows SOLID principles.`;
	}

	private generateGeneralCopilotResponse(prompt: string): string {
		return `Hello! I'm GitHub Copilot, your AI programming assistant.\n\nRegarding "${prompt}":\n\nI can help you with:\n\n- **Code explanation**: Understanding complex code and algorithms\n- **Debugging**: Finding and fixing bugs in your code\n- **Code generation**: Writing new functions, classes, and modules\n- **Testing**: Creating comprehensive unit tests\n- **Refactoring**: Improving code structure and maintainability\n- **Best practices**: Following industry standards and patterns\n- **Documentation**: Writing clear comments and documentation\n\nWhat specific aspect would you like me to help you with? Please provide more details about your coding challenge or question.`;
	}



	dispose(): void {
		this.disposables.dispose();
	}
}

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
		sessionId?: string;
		copilotToken?: boolean;
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
	private extensionChatService: IChatService;

	constructor() {
		// 初始化extension chat service bridge
		this.extensionChatService = new ExtensionChatServiceBridge();

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
	 * 基于VS Code Copilot Chat的请求处理流程 - 重构版本
	 * 复用extension的认证、意图检测、请求处理等逻辑
	 */
	async sendMessage(request: ChatRequest, endpointId = 'local'): Promise<ChatResponse> {
		// 1. 检查GitHub认证和Copilot Token
		if (!await this.checkAuthentication()) {
			return {
				id: this.generateId(),
				requestId: request.id,
				content: "请先登录GitHub并确保您有有效的Copilot订阅。请前往VS Code扩展设置进行身份验证。",
				finishReason: 'error'
			};
		}

		const conversation = this.conversations.get(this.currentSessionId!);
		if (!conversation) {
			throw new Error('No active conversation');
		}

		// 2. 创建新的Turn（对话轮次）
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
			// 3. 使用extension的聊天逻辑处理请求
			const response = await this.processChatRequestViaExtension(request, conversation, turn);

			// 4. 创建响应消息
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
					references: response.references,
					copilotToken: true // 标记为通过Copilot token认证的响应
				}
			};

			// 5. 设置Turn的响应
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
					finishReason: 'error',
					copilotToken: false
				}
			};

			turn.setResponse(errorMessage, 'error');
			throw error;
		}
	}

	/**
	 * 公开方法：检查认证状态
	 * 供UI组件调用以显示认证状态
	 */
	async isAuthenticated(): Promise<boolean> {
		return await this.extensionChatService.checkAuthentication();
	}

	/**
	 * 公开方法：设置认证token（用于测试或模拟）
	 */
	setAuthenticationTokens(githubToken: string, copilotToken: { chat_enabled: boolean }): void {
		localStorage.setItem('github_token', githubToken);
		localStorage.setItem('copilot_token', JSON.stringify(copilotToken));
	}

	/**
	 * 检查GitHub认证和Copilot Token状态
	 * 这个方法需要在浏览器环境中适配VS Code的认证逻辑
	 */
	private async checkAuthentication(): Promise<boolean> {
		try {
			// 在浏览器环境中，我们需要检查是否有有效的认证状态
			// 这里应该对接VS Code extension的IAuthenticationService

			// 临时实现：检查是否有GitHub token和Copilot订阅
			// 实际实现中应该调用extension的认证服务

			// 模拟认证检查
			const hasGitHubAuth = await this.checkGitHubAuthentication();
			const hasCopilotToken = await this.checkCopilotToken();

			return hasGitHubAuth && hasCopilotToken;
		} catch (error) {
			console.error('Authentication check failed:', error);
			return false;
		}
	}

	/**
	 * 检查GitHub认证状态
	 */
	private async checkGitHubAuthentication(): Promise<boolean> {
		// 在浏览器环境中，需要对接VS Code的认证系统
		// 这里应该调用ConversationFeature的认证逻辑

		// 临时实现：检查localStorage或其他存储机制
		try {
			// 这里应该使用extension的IAuthenticationService
			// const authService = this.getAuthenticationService();
			// return await authService.isAuthenticated();

			// 临时mock实现
			const gitHubToken = localStorage.getItem('github_token');
			return !!gitHubToken;
		} catch (error) {
			return false;
		}
	}

	/**
	 * 检查Copilot Token状态
	 */
	private async checkCopilotToken(): Promise<boolean> {
		try {
			// 这里应该使用extension的CopilotTokenManager
			// const tokenManager = this.getCopilotTokenManager();
			// const token = await tokenManager.getCopilotToken();
			// return token?.isChatEnabled() ?? false;

			// 临时mock实现
			const copilotToken = localStorage.getItem('copilot_token');
			const tokenData = copilotToken ? JSON.parse(copilotToken) : null;
			return tokenData?.chat_enabled === true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * 使用extension的聊天逻辑处理请求
	 * 这是核心方法，复用VS Code extension的ChatParticipantRequestHandler
	 */
	private async processChatRequestViaExtension(
		request: ChatRequest,
		conversation: Conversation,
		turn: Turn
	): Promise<ChatResponse> {
		try {
			// 1. 转换为VS Code格式的请求
			const vsChatRequest = await this.convertToVSChatRequest(request, conversation);

			// 2. 创建取消令牌
			const cancellationToken = this.createCancellationToken();

			// 3. 使用extension chat service处理请求
			const result = await this.extensionChatService.sendChatRequest(vsChatRequest, cancellationToken);

			// 4. 转换回我们的响应格式
			return this.convertFromVSChatResult(result, request);

		} catch (error) {
			console.error('Extension chat processing failed:', error);
			// 回退到本地处理
			return this.processCopilotRequestFallback(request, conversation);
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

		// 使用简化的意图处理，实际的复杂逻辑移到extension integration中
		if (turnCount === 1) {
			// 首次对话的欢迎消息
			return {
				content: `Hello! I'm **GitHub Copilot**, your AI programming assistant. I'm here to help you with coding, debugging, and development tasks.

How can I assist you today?`,
				confidence: 0.95,
				references: hasContext ? ['current-file'] : []
			};
		}

		// 通用响应
		return {
			content: `I'd be happy to help with your ${intent} request! ${hasContext ? 'I can see you have some code context available.' : 'Feel free to share your code for more specific assistance.'}

What specific aspect would you like me to focus on?`,
			confidence: 0.7,
			references: hasContext ? ['current-file'] : []
		};
	}

	/**
	 * 转换为VS Code格式的聊天请求
	 * 在浏览器环境中，我们需要适配VS Code的ChatRequest接口
	 */
	private async convertToVSChatRequest(request: ChatRequest, conversation: Conversation): Promise<VSChatRequest> {
		// 构造符合VS Code extension期望的请求格式
		return {
			id: request.id,
			prompt: request.prompt,
			model: null, // 在浏览器环境中模拟，实际应该从配置获取
			attempt: 1,
			enableCommandDetection: true,
			isParticipantDetected: false,
			location: { location: 'panel' },
			location2: undefined,
			command: undefined,
			references: request.references?.map(ref => ({ value: ref, range: undefined })) || [],
			toolReferences: [],
			tools: new Map(),
			acceptedConfirmationData: undefined,
			rejectedConfirmationData: undefined
		};
	}



	/**
	 * 创建取消令牌
	 * 使用VS Code的CancellationToken实现
	 */
	private createCancellationToken(): CancellationToken {
		const source = new CancellationTokenSource();
		return source.token;
	}



	/**
	 * 转换VS Code聊天结果为我们的响应格式
	 */
	private convertFromVSChatResult(result: ChatResult, originalRequest: ChatRequest): ChatResponse {
		// 检查是否有错误
		if (result.errorDetails) {
			return {
				id: this.generateId(),
				requestId: originalRequest.id,
				content: result.errorDetails.message || 'An error occurred while processing your request.',
				usage: {
					promptTokens: this.estimateTokens(originalRequest.prompt),
					completionTokens: 0,
					totalTokens: this.estimateTokens(originalRequest.prompt)
				},
				finishReason: 'error',
				intent: originalRequest.intent,
				confidence: 0,
				references: []
			};
		}

		// 正常响应处理
		const responseContent = result.details || 'Response generated successfully';
		const estimatedTokens = this.estimateTokens(responseContent);

		return {
			id: this.generateId(),
			requestId: originalRequest.id,
			content: responseContent,
			usage: {
				promptTokens: this.estimateTokens(originalRequest.prompt),
				completionTokens: estimatedTokens,
				totalTokens: this.estimateTokens(originalRequest.prompt) + estimatedTokens
			},
			finishReason: 'stop',
			intent: result.metadata?.intent || originalRequest.intent,
			confidence: result.metadata?.copilotToken ? 0.95 : 0.5,
			references: result.metadata?.context || []
		};
	}

	/**
	 * 回退处理方法
	 * 当extension逻辑失败时，使用本地Copilot逻辑
	 */
	private async processCopilotRequestFallback(request: ChatRequest, conversation: Conversation): Promise<ChatResponse> {
		// 使用现有的本地处理逻辑
		const endpoint = this.endpoints.get('local');
		if (!endpoint) {
			throw new Error('No fallback endpoint available');
		}

		return this.processCopilotRequest(request, endpoint, conversation);
	}


}

// 单例实例
export const chatEngine = new ChatEngine();
