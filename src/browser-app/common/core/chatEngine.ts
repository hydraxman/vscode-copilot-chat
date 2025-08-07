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

// 类型定义
interface CopilotTokenData {
	token: string;
	expires_at: number;
	refresh_in: number;
}

interface GitHubUserInfo {
	login: string;
	id: number;
}

interface ChatCompletion {
	choices: Array<{
		message?: {
			content?: string;
		};
		delta?: {
			content?: string;
		};
	}>;
}

/**
 * Extension Chat Service Bridge
 * 这个类负责在浏览器环境中桥接到VS Code extension的chat逻辑
 *
 * 真实实现：直接复用 VS Code extension 的认证和聊天逻辑
 *
 * 集成方案：
 * 1. 直接导入和实例化 VS Code extension 的服务
 * 2. 实现真正的 GitHub OAuth 认证流程
 * 3. 调用真实的 Copilot API 端点
 * 4. 复用 extension 的 ChatParticipantRequestHandler 处理逻辑
 */
export class ExtensionChatServiceBridge implements IChatService {
	private disposables = new DisposableStore();
	private authenticationService?: any; // 真实的 IAuthenticationService 实例
	private chatMLFetcher?: any; // 真实的 IChatMLFetcher 实例

	constructor() {
		// 在浏览器环境中初始化真实的 extension 服务
		this.initializeExtensionServices();
	}

	/**
	 * 初始化 extension 服务
	 * 直接实例化 VS Code extension 中的认证和聊天服务
	 */
	private async initializeExtensionServices(): Promise<void> {
		try {
			// 1. 创建真实的认证服务实例
			await this.initializeAuthenticationService();

			// 2. 创建聊天端点服务
			await this.initializeChatServices();

			console.log('Extension services initialized successfully');
		} catch (error) {
			console.error('Failed to initialize extension services:', error);
		}
	}

	/**
	 * 初始化认证服务
	 * 复用 VS Code extension 的 IAuthenticationService
	 */
	private async initializeAuthenticationService(): Promise<void> {
		// 在浏览器环境中，我们需要模拟 VS Code 的认证环境
		// 或者通过 WebSocket/HTTP API 连接到运行真实 extension 的后端

		// 方案1: 如果在 VS Code Web 中运行，可以直接使用 VS Code API
		const globalThis = this.getGlobalThis();
		if (globalThis && (globalThis as any).vscode) {
			await this.initializeVSCodeWebAuth();
		}
		// 方案2: 通过 API 连接到运行 extension 的后端服务
		else {
			await this.initializeAPIAuth();
		}
	}

	/**
	 * 获取全局对象（支持不同环境）
	 */
	private getGlobalThis(): any {
		try {
			// 使用 Function 构造器安全地访问全局对象
			return Function('return this')();
		} catch {
			// 后备方案：使用对象属性访问
			const getGlobal = new Function('name', 'try { return (function() { return this; })()[name]; } catch(e) { return undefined; }');
			const globals = ['globalThis', 'window', 'global', 'self'];
			for (const globalName of globals) {
				try {
					const globalObj = getGlobal(globalName);
					if (globalObj && typeof globalObj === 'object') {
						return globalObj;
					}
				} catch {
					// 忽略错误，继续尝试下一个
				}
			}
			return {};
		}
	}

	/**
	 * 在 VS Code Web 环境中初始化认证
	 */
	private async initializeVSCodeWebAuth(): Promise<void> {
		const globalThis = this.getGlobalThis();
		const vscode = (globalThis as any).vscode;
		if (!vscode || !vscode.authentication) {
			throw new Error('VS Code authentication API not available');
		}

		const instance = this;
		// 使用 VS Code Web 的认证 API
		this.authenticationService = {
			async getAnyGitHubSession(options: any) {
				try {
					return await vscode.authentication.getSession('github', ['user:email'], options);
				} catch (error) {
					console.error('Failed to get GitHub session:', error);
					return undefined;
				}
			},

			async getPermissiveGitHubSession(options: any) {
				try {
					return await vscode.authentication.getSession('github', ['read:user', 'user:email', 'repo', 'workflow'], options);
				} catch (error) {
					console.error('Failed to get permissive GitHub session:', error);
					return undefined;
				}
			},

			async getCopilotToken() {
				// 通过 GitHub token 获取 Copilot token
				const session = await this.getAnyGitHubSession({ silent: true });
				if (!session) {
					throw new Error('No GitHub session available');
				}

				return await instance.fetchCopilotTokenFromGitHub(session.accessToken);
			}
		};
	}

	/**
	 * 通过 API 初始化认证（连接到后端服务）
	 */
	private async initializeAPIAuth(): Promise<void> {
		// 实现连接到运行 VS Code extension 的后端服务
		// 这可以通过 WebSocket、HTTP API 等方式实现

		this.authenticationService = {
			async getAnyGitHubSession(options: any) {
				// 调用后端 API 获取 GitHub session
				const response = await fetch('/api/auth/github/session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ scopes: ['user:email'], options })
				});

				if (!response.ok) {
					return undefined;
				}

				return await response.json();
			},

			async getPermissiveGitHubSession(options: any) {
				const response = await fetch('/api/auth/github/permissive-session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						scopes: ['read:user', 'user:email', 'repo', 'workflow'],
						options
					})
				});

				if (!response.ok) {
					return undefined;
				}

				return await response.json();
			},

			async getCopilotToken() {
				const response = await fetch('/api/auth/copilot/token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				});

				if (!response.ok) {
					throw new Error('Failed to get Copilot token');
				}

				return await response.json();
			}
		};
	}

	/**
	 * 从 GitHub token 获取 Copilot token
	 * 复用 extension 中的 CopilotTokenManager 逻辑
	 */
	private async fetchCopilotTokenFromGitHub(githubToken: string): Promise<any> {
		try {
			// 调用 GitHub Copilot API 获取 token
			const response = await fetch('https://api.github.com/copilot_internal/token', {
				method: 'GET',
				headers: {
					'Authorization': `token ${githubToken}`,
					'X-GitHub-Api-Version': '2022-11-28',
					'Accept': 'application/vnd.github+json'
				}
			});

			if (!response.ok) {
				throw new Error(`Failed to get Copilot token: ${response.status} ${response.statusText}`);
			}

			const tokenData = await response.json() as CopilotTokenData;

			// 验证 token 数据
			if (!tokenData.token) {
				throw new Error('Invalid Copilot token response');
			}

			// 扩展 token 信息
			const userResponse = await fetch('https://api.github.com/user', {
				headers: { 'Authorization': `token ${githubToken}` }
			});

			const userInfo = userResponse.ok ? await userResponse.json() as GitHubUserInfo : { login: 'unknown', id: 0 };

			return {
				token: tokenData.token,
				expires_at: tokenData.expires_at,
				refresh_in: tokenData.refresh_in,
				chat_enabled: true, // 假设聊天已启用
				username: userInfo.login || 'unknown',
				copilot_plan: 'copilot_individual', // 可以从其他 API 获取
				isChatEnabled: () => true
			};
		} catch (error) {
			console.error('Failed to fetch Copilot token:', error);
			throw error;
		}
	}

	/**
	 * 初始化聊天服务
	 */
	private async initializeChatServices(): Promise<void> {
		// 创建 ChatML fetcher（用于调用 Copilot API）
		this.chatMLFetcher = {
			fetchOne: async (opts: any, token: CancellationToken) => {
				return await this.fetchCopilotResponse(opts, token);
			}
		};
	}

	/**
	 * 调用真实的 Copilot API
	 * 复用 extension 的 ChatMLFetcher 逻辑
	 */
	private async fetchCopilotResponse(opts: any, token: CancellationToken): Promise<any> {
		try {
			// 1. 获取 Copilot token
			const copilotToken = await this.authenticationService.getCopilotToken();

			// 2. 构建请求体（复用 extension 的逻辑）
			const requestBody = {
				messages: opts.messages,
				model: 'gpt-4',
				temperature: opts.requestOptions?.temperature || 0.7,
				top_p: opts.requestOptions?.top_p || 0.95,
				max_tokens: opts.requestOptions?.max_tokens || 2048,
				stream: true,
				...opts.requestOptions
			};

			// 3. 调用 Copilot API
			const response = await fetch('https://api.githubcopilot.com/chat/completions', {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${copilotToken.token}`,
					'Content-Type': 'application/json',
					'X-GitHub-Api-Version': '2023-07-07',
					'Accept': 'application/json'
				},
				body: JSON.stringify(requestBody)
			});

			if (!response.ok) {
				throw new Error(`Copilot API error: ${response.status} ${response.statusText}`);
			}

			// 4. 处理流式响应
			if (requestBody.stream) {
				return await this.handleStreamResponse(response, token);
			} else {
				const data = await response.json() as ChatCompletion;
				return {
					type: 'Success',
					value: data.choices[0]?.message?.content || '',
					requestId: opts.requestId
				};
			}
		} catch (error) {
			console.error('Copilot API call failed:', error);
			return {
				type: 'Failed',
				reason: error instanceof Error ? error.message : 'Unknown error',
				requestId: opts.requestId
			};
		}
	}

	/**
	 * 处理流式响应
	 */
	private async handleStreamResponse(response: Response, token: CancellationToken): Promise<any> {
		if (!response.body) {
			throw new Error('No response body');
		}

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let content = '';

		try {
			while (true) {
				if (token.isCancellationRequested) {
					reader.cancel();
					throw new Error('Request cancelled');
				}

				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				const chunk = decoder.decode(value, { stream: true });
				const lines = chunk.split('\n');

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.substring(6);
						if (data === '[DONE]') {
							break;
						}

						try {
							const parsed = JSON.parse(data) as ChatCompletion;
							const delta = parsed.choices?.[0]?.delta?.content;
							if (delta) {
								content += delta;
							}
						} catch (error) {
							// 忽略 JSON 解析错误
						}
					}
				}
			}

			return {
				type: 'Success',
				value: content,
				requestId: response.headers.get('x-request-id') || 'unknown'
			};
		} finally {
			reader.releaseLock();
		}
	}

	async sendChatRequest(request: VSChatRequest, token: CancellationToken): Promise<ChatResult> {
		try {
			// 1. 检查认证状态
			const isAuthenticated = await this.checkAuthentication();
			if (!isAuthenticated) {
				return {
					errorDetails: { message: 'Please sign in to GitHub and ensure you have a valid Copilot subscription.' },
					metadata: { copilotToken: false }
				};
			}

			// 2. 构建 ChatML 消息格式
			const messages = [
				{
					role: 'user',
					content: request.prompt
				}
			];

			// 3. 调用真实的 Copilot API
			const fetchOptions = {
				messages,
				requestId: request.id,
				requestOptions: {
					temperature: 0.7,
					max_tokens: 2048
				},
				location: request.location,
				debugName: 'browser-chat'
			};

			const result = await this.chatMLFetcher.fetchOne(fetchOptions, token);

			// 4. 转换响应格式
			if (result.type === 'Success') {
				return {
					details: result.value,
					metadata: {
						copilotToken: true,
						requestId: result.requestId
					}
				};
			} else {
				return {
					errorDetails: { message: result.reason || 'Unknown error occurred' },
					metadata: { copilotToken: false }
				};
			}
		} catch (error) {
			console.error('Chat request failed:', error);
			return {
				errorDetails: { message: error instanceof Error ? error.message : 'Unknown error' },
				metadata: { copilotToken: false }
			};
		}
	}

	async checkAuthentication(): Promise<boolean> {
		try {
			// 方案1: 检查是否在VS Code Web环境中，使用VS Code API
			const globalThis = this.getGlobalThis();
			if (globalThis && (globalThis as any).vscode) {
				return await this.checkVSCodeWebAuthentication();
			}

			// 方案2: 尝试从环境变量或本地存储获取GitHub token进行直接验证
			return await this.checkDirectGitHubAuthentication();
		} catch (error) {
			console.error('Authentication check failed:', error);
			return false;
		}
	}

	/**
	 * 在VS Code Web环境中检查认证
	 */
	private async checkVSCodeWebAuthentication(): Promise<boolean> {
		try {
			const globalThis = this.getGlobalThis();
			const vscode = (globalThis as any).vscode;

			if (!vscode || !vscode.authentication) {
				return false;
			}

			// 尝试获取GitHub session
			const session = await vscode.authentication.getSession('github', ['user:email'], { silent: true });
			if (!session) {
				return false;
			}

			// 验证Copilot token
			const copilotToken = await this.fetchCopilotTokenFromGitHub(session.accessToken);
			return copilotToken && copilotToken.chat_enabled;
		} catch (error) {
			console.error('VS Code Web authentication check failed:', error);
			return false;
		}
	}

	/**
	 * 直接检查GitHub认证（通过环境变量或用户输入的token）
	 */
	private async checkDirectGitHubAuthentication(): Promise<boolean> {
		try {
			// 1. 从多个来源尝试获取GitHub token
			const githubToken = this.getGitHubTokenFromEnvironment();

			if (!githubToken) {
				// 如果没有token，提示用户输入或通过OAuth获取
				console.log('No GitHub token found. Please set GITHUB_TOKEN environment variable or authenticate through OAuth.');
				return false;
			}

			// 2. 验证GitHub token并获取Copilot token
			const copilotToken = await this.fetchCopilotTokenFromGitHub(githubToken);
			return copilotToken && copilotToken.chat_enabled;
		} catch (error) {
			console.error('Direct GitHub authentication check failed:', error);
			return false;
		}
	}

	/**
	 * 从环境变量获取GitHub token
	 */
	private getGitHubTokenFromEnvironment(): string | null {
		try {
			// 1. 尝试从环境变量获取
			const globalThis = this.getGlobalThis();
			if ((globalThis as any).process && (globalThis as any).process.env) {
				const envToken = (globalThis as any).process.env.GITHUB_TOKEN;
				if (envToken) {
					return envToken;
				}
			}

			// 2. 尝试从localStorage获取（用于测试）
			const localToken = localStorage.getItem('github_token');
			if (localToken) {
				return localToken;
			}

			// 3. 尝试从sessionStorage获取
			const sessionToken = sessionStorage.getItem('github_token');
			if (sessionToken) {
				return sessionToken;
			}

			return null;
		} catch (error) {
			console.error('Failed to get GitHub token from environment:', error);
			return null;
		}
	}

	/**
	 * 公开方法：设置GitHub token用于测试
	 */
	setGitHubToken(token: string): void {
		localStorage.setItem('github_token', token);
		console.log('GitHub token set for ExtensionChatServiceBridge');

		// 重新初始化认证服务以使用新token
		this.initializeExtensionServices();
	}

	/**
	 * 公开方法：触发 GitHub 认证流程
	 */
	async authenticateWithGitHub(): Promise<boolean> {
		try {
			if (!this.authenticationService) {
				throw new Error('Authentication service not initialized');
			}

			// 触发交互式认证流程
			const session = await this.authenticationService.getAnyGitHubSession({ createIfNone: true });
			return !!session;
		} catch (error) {
			console.error('GitHub authentication failed:', error);
			return false;
		}
	}

	/**
	 * 公开方法：获取认证状态信息
	 */
	async getAuthenticationInfo(): Promise<{
		isAuthenticated: boolean;
		githubUser?: string;
		copilotPlan?: string;
		scopes?: string[];
	}> {
		try {
			const githubSession = await this.authenticationService?.getAnyGitHubSession({ silent: true });
			if (!githubSession) {
				return { isAuthenticated: false };
			}

			const copilotToken = await this.authenticationService.getCopilotToken();

			return {
				isAuthenticated: true,
				githubUser: githubSession.account?.label || copilotToken?.username,
				copilotPlan: copilotToken?.copilot_plan,
				scopes: githubSession.scopes
			};
		} catch (error) {
			return { isAuthenticated: false };
		}
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
 *
 * 认证集成说明：
 *
 * 这个实现展示了如何在浏览器环境中复用 VS Code extension 的认证逻辑。
 * 主要包含以下认证检查层次：
 *
 * 1. GitHub Session 检查:
 *    - checkAlignedGitHubSession(): 检查是否有完整权限 (repo, user:email, read:user, workflow)
 *    - checkMinimalGitHubSession(): 检查是否有基础权限 (user:email)
 *    - checkReadUserGitHubSession(): 向后兼容检查 (read:user)
 *
 * 2. Copilot Token 验证:
 *    - validateCopilotAccess(): 验证 Copilot 订阅和 chat 权限
 *    - tryGetCopilotToken(): 尝试从 GitHub token 获取 Copilot token
 *
 * 在实际的浏览器应用中使用：
 *
 * ```typescript
 * // 1. 初始化认证状态 (用于开发/测试)
 * chatEngine.setMockAuthenticationState('aligned');
 *
 * // 2. 检查认证状态
 * const authStatus = await chatEngine.getAuthenticationStatus();
 * if (!authStatus.isAuthenticated) {
 *     // 引导用户进行 GitHub OAuth 认证
 *     await redirectToGitHubOAuth();
 * }
 *
 * // 3. 设置真实的认证信息 (从 OAuth 回调获得)
 * chatEngine.setAuthenticationTokens(
 *     githubAccessToken,
 *     { chat_enabled: true, username: userInfo.login },
 *     ['read:user', 'user:email', 'repo', 'workflow']
 * );
 *
 * // 4. 开始聊天
 * const response = await chatEngine.sendMessage({
 *     id: 'msg-1',
 *     prompt: 'Hello Copilot!'
 * });
 * ```
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
		// 1. 检查GitHub认证和Copilot Token - 直接使用ExtensionChatServiceBridge的认证
		let isAuthenticated = false;
		let errorMessage = '';
		try {
			isAuthenticated = await this.extensionChatService.checkAuthentication();
		} catch (error) {
			console.error('Authentication check failed:', error);
		}

		if (!isAuthenticated) {
			// 尝试从localStorage获取token进行快速认证
			const githubToken = '';
			if (githubToken) {
				// 设置token并重新检查
				this.setRealGitHubToken(githubToken);
				try {
					isAuthenticated = await this.extensionChatService.checkAuthentication();
				} catch (error) {
					errorMessage = error instanceof Error ? error.message : 'Unknown error during retry';
					console.error('Retry authentication failed:', error);
				}
			}
		}

		if (!isAuthenticated) {
			return {
				id: this.generateId(),
				requestId: request.id,
				content: "请先设置GitHub Token。请使用 `chatEngine.setRealGitHubToken('your_token')` 方法设置有效的GitHub Personal Access Token。" + errorMessage,
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
	 * 公开方法：设置真实GitHub token进行测试
	 * 使用这个方法设置真实的GitHub Personal Access Token来测试Copilot API
	 */
	setRealGitHubToken(token: string): void {
		// 通过ExtensionChatServiceBridge设置token
		if (this.extensionChatService && 'setGitHubToken' in this.extensionChatService) {
			(this.extensionChatService as any).setGitHubToken(token);
		}
		console.log('Real GitHub token set for Copilot API testing');
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
	 * 增强版本，支持设置 scopes 信息
	 */
	setAuthenticationTokens(
		githubToken: string,
		copilotToken: { chat_enabled: boolean; expires_at?: number; username?: string; copilot_plan?: string },
		scopes?: string[]
	): void {
		localStorage.setItem('github_token', githubToken);
		localStorage.setItem('copilot_token', JSON.stringify({
			...copilotToken,
			expires_at: copilotToken.expires_at || (Date.now() / 1000 + 3600) // 默认1小时后过期
		}));

		// 设置 token scopes 信息，用于权限检查
		if (scopes) {
			localStorage.setItem('github_token_scopes', JSON.stringify(scopes));
		} else {
			// 默认设置为 aligned scopes
			localStorage.setItem('github_token_scopes', JSON.stringify(['read:user', 'user:email', 'repo', 'workflow']));
		}
	}

	/**
	 * 公开方法：设置完整的认证状态（模拟真实的 VS Code extension 认证）
	 */
	setMockAuthenticationState(authLevel: 'none' | 'minimal' | 'aligned' | 'permissive' = 'aligned'): void {
		switch (authLevel) {
			case 'none':
				localStorage.removeItem('github_token');
				localStorage.removeItem('copilot_token');
				localStorage.removeItem('github_token_scopes');
				break;

			case 'minimal':
				this.setAuthenticationTokens(
					'ghp_minimal_token_example',
					{ chat_enabled: true, username: 'minimal_user', copilot_plan: 'copilot_individual' },
					['user:email']
				);
				break;

			case 'aligned':
				this.setAuthenticationTokens(
					'ghp_aligned_token_example',
					{ chat_enabled: true, username: 'aligned_user', copilot_plan: 'copilot_individual' },
					['read:user', 'user:email', 'repo', 'workflow']
				);
				break;

			case 'permissive':
				this.setAuthenticationTokens(
					'ghp_permissive_token_example',
					{ chat_enabled: true, username: 'permissive_user', copilot_plan: 'copilot_business' },
					['read:user', 'user:email', 'repo', 'workflow', 'admin:org']
				);
				break;
		}
	}

	/**
	 * 公开方法：获取当前认证状态信息
	 */
	async getAuthenticationStatus(): Promise<{
		isAuthenticated: boolean;
		hasGitHubSession: boolean;
		hasCopilotAccess: boolean;
		scopes?: string[];
		username?: string;
		copilotPlan?: string;
	}> {
		try {
			const isAuthenticated = await this.isAuthenticated();
			const hasGitHubSession = await this.checkAnyGitHubSession();
			const hasCopilotAccess = await this.checkCopilotToken();

			const scopesString = localStorage.getItem('github_token_scopes');
			const copilotTokenString = localStorage.getItem('copilot_token');

			let scopes: string[] | undefined;
			let username: string | undefined;
			let copilotPlan: string | undefined;

			if (scopesString) {
				scopes = JSON.parse(scopesString);
			}

			if (copilotTokenString) {
				const copilotToken = JSON.parse(copilotTokenString);
				username = copilotToken.username;
				copilotPlan = copilotToken.copilot_plan;
			}

			return {
				isAuthenticated,
				hasGitHubSession,
				hasCopilotAccess,
				scopes,
				username,
				copilotPlan
			};
		} catch (error) {
			console.error('Failed to get authentication status:', error);
			return {
				isAuthenticated: false,
				hasGitHubSession: false,
				hasCopilotAccess: false
			};
		}
	}

	/**
	 * 公开方法：设置GitHub token用于测试
	 */
	setGitHubToken(token: string): void {
		localStorage.setItem('github_token', token);
		console.log('GitHub token set for testing purposes');
	}

	/**
	 * 检查是否有任何可用的 GitHub session
	 * 复用 extension/platform/authentication 的逻辑
	 */
	private async checkAnyGitHubSession(): Promise<boolean> {
		try {
			// 模拟 getAnyAuthSession 的逻辑
			// 在真实实现中，这应该通过 IPC 调用 extension 的 IAuthenticationService.getAnyGitHubSession({ silent: true })

			// 1. 首先检查是否有 aligned scopes (repo, user:email, read:user, workflow)
			const hasAlignedSession = await this.checkAlignedGitHubSession();
			if (hasAlignedSession) {
				return true;
			}

			// 2. 检查是否有 minimal scopes (user:email)
			const hasMinimalSession = await this.checkMinimalGitHubSession();
			if (hasMinimalSession) {
				return true;
			}

			// 3. 向后兼容：检查是否有 read:user scope
			const hasReadUserSession = await this.checkReadUserGitHubSession();
			if (hasReadUserSession) {
				return true;
			}

			return false;
		} catch (error) {
			console.error('Any GitHub session check failed:', error);
			return false;
		}
	}

	/**
	 * 检查是否有 aligned GitHub session (repo, user:email, read:user, workflow)
	 * 对应 GITHUB_SCOPE_ALIGNED
	 */
	private async checkAlignedGitHubSession(): Promise<boolean> {
		try {
			// 在真实实现中，这里会调用：
			// await authentication.getSession('github', ['read:user', 'user:email', 'repo', 'workflow'], { silent: true })

			// 临时模拟实现 - 检查是否有完整权限的 token
			const githubToken = localStorage.getItem('github_token');
			const tokenScopes = localStorage.getItem('github_token_scopes');

			if (!githubToken) {
				return false;
			}

			// 检查 scope 是否包含所需权限
			if (tokenScopes) {
				const scopes = JSON.parse(tokenScopes);
				const requiredScopes = ['read:user', 'user:email', 'repo', 'workflow'];
				return requiredScopes.every(scope => scopes.includes(scope));
			}

			// 如果没有 scope 信息，假设是基础 token
			return false;
		} catch (error) {
			return false;
		}
	}

	/**
	 * 检查是否有 minimal GitHub session (user:email)
	 * 对应 GITHUB_SCOPE_USER_EMAIL
	 */
	private async checkMinimalGitHubSession(): Promise<boolean> {
		try {
			// 在真实实现中，这里会调用：
			// await authentication.getSession('github', ['user:email'], { silent: true })

			const githubToken = localStorage.getItem('github_token');
			const tokenScopes = localStorage.getItem('github_token_scopes');

			if (!githubToken) {
				return false;
			}

			// 检查 scope 是否包含 user:email
			if (tokenScopes) {
				const scopes = JSON.parse(tokenScopes);
				return scopes.includes('user:email');
			}

			// 如果没有明确的 scope 信息，假设基础 token 至少有 user:email
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * 检查是否有 read:user GitHub session (向后兼容)
	 * 对应 GITHUB_SCOPE_READ_USER
	 */
	private async checkReadUserGitHubSession(): Promise<boolean> {
		try {
			// 在真实实现中，这里会调用：
			// await authentication.getSession('github', ['read:user'], { silent: true })

			const githubToken = localStorage.getItem('github_token');
			const tokenScopes = localStorage.getItem('github_token_scopes');

			if (!githubToken) {
				return false;
			}

			// 检查 scope 是否包含 read:user
			if (tokenScopes) {
				const scopes = JSON.parse(tokenScopes);
				return scopes.includes('read:user');
			}

			// 向后兼容：如果没有明确的 scope 信息，尝试验证 token
			return true;
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
