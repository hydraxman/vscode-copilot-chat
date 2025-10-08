/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type { ChatRequest, ExtendedChatResponsePart } from 'vscode';
import { Worker } from 'worker_threads';
import { defaultAgentName, getChatParticipantIdFromName } from '../../../platform/chat/common/chatAgents';
import { IEndpointProvider } from '../../../platform/endpoint/common/endpointProvider';
import { ILogService } from '../../../platform/log/common/logService';
import type { IChatEndpoint } from '../../../platform/networking/common/networking';
import { ChatResponseStreamImpl, FinalizableChatResponseStream, tryFinalizeResponseStream } from '../../../util/common/chatResponseStreamImpl';
import { CancellationTokenSource } from '../../../util/vs/base/common/cancellation';
import { CancellationError } from '../../../util/vs/base/common/errors';
import { Event } from '../../../util/vs/base/common/event';
import { Disposable } from '../../../util/vs/base/common/lifecycle';
import * as path from '../../../util/vs/base/common/path';
import { generateUuid } from '../../../util/vs/base/common/uuid';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { ChatPrepareToolInvocationPart, ChatRequestTurn2, ChatResponseAnchorPart, ChatResponseCodeCitationPart, ChatResponseCodeblockUriPart, ChatResponseCommandButtonPart, ChatResponseFileTreePart, ChatResponseMarkdownPart, ChatResponseMarkdownWithVulnerabilitiesPart, ChatResponseNotebookEditPart, ChatResponseProgressPart, ChatResponseProgressPart2, ChatResponseReferencePart, ChatResponseTextEditPart, ChatResponseThinkingProgressPart, ChatResponseTurn2, ChatResponseWarningPart, ChatToolInvocationPart, MarkdownString, ChatLocation as VSChatLocation } from '../../../vscodeTypes';
import { ChatParticipantRequestHandler } from '../../prompt/node/chatParticipantRequestHandler';
import { IProxyChatServerService } from '../common/proxyChatServer';
import { ProxyHostToServerChunkMessage, ProxyHostToServerMessage, ProxyServerLifecycleState, ProxyServerToHostChatRequestMessage, ProxyServerToHostMessage, SerializedChatPart } from '../common/proxyProtocol';

// Worker JS is emitted beside this file after build. Keep .js extension.
const workerPath = path.join(__dirname, 'proxyChatServerWorker.js');

// OutputChannel will be created lazily; not all runtimes where this file loads necessarily expose the VS Code API.
let VSCodeAPI: (typeof import('vscode')) | undefined;

interface ConversationState {
	readonly history: (vscode.ChatRequestTurn | vscode.ChatResponseTurn)[];
}

interface PendingRequestState {
	readonly requestId: string;
	readonly conversationId: string;
	readonly cancellation: CancellationTokenSource;
	readonly stream: ProxyChatResponseStream;
	readonly requestTurn: vscode.ChatRequestTurn;
}

type ChatRequestModel = ChatRequest['model'];

class ServerChatRequest implements ChatRequest {
	public readonly id = generateUuid();
	public readonly toolInvocationToken: never = undefined as never;
	public readonly tools = new Map<string, boolean>();
	public readonly location = VSChatLocation.Panel;
	public readonly location2 = undefined;
	public readonly attempt: number;
	public readonly enableCommandDetection = false;
	public readonly isParticipantDetected = false;
	public readonly references: readonly vscode.ChatPromptReference[];
	public readonly toolReferences: readonly vscode.ChatLanguageModelToolReference[];
	public readonly editedFileEvents = undefined;
	public readonly acceptedConfirmationData: any[] = [];
	public readonly rejectedConfirmationData: any[] = [];
	public readonly model: ChatRequestModel;

	constructor(
		public prompt: string,
		public command: string | undefined,
		attempt: number,
		references: readonly vscode.ChatPromptReference[],
		toolReferences: readonly vscode.ChatLanguageModelToolReference[],
		model: ChatRequestModel,
	) {
		this.attempt = attempt;
		this.references = Array.from(references);
		this.toolReferences = Array.from(toolReferences);
		this.model = model;
	}
}

class ProxyChatResponseStream extends ChatResponseStreamImpl implements FinalizableChatResponseStream {
	private readonly _contentParts: ExtendedChatResponsePart[] = [];

	constructor(private readonly forward: (chunk: SerializedChatPart) => void) {
		super(ProxyChatResponseStream.createPushHandler(forward), () => { }, () => { });
	}

	override push(part: ExtendedChatResponsePart): void {
		super.push(part);
		this.captureContentPart(part);
	}

	override progress(value: string): void {
		this.forward({ kind: 'progress', message: value });
		super.progress(value);
	}

	get contentParts(): readonly ExtendedChatResponsePart[] { return this._contentParts; }

	private captureContentPart(part: ExtendedChatResponsePart) {
		if (part instanceof ChatResponseMarkdownPart || part instanceof ChatResponseFileTreePart || part instanceof ChatResponseAnchorPart || part instanceof ChatResponseCommandButtonPart || part instanceof ChatToolInvocationPart) {
			this._contentParts.push(part);
		}
	}

	static createPushHandler(forward: (chunk: SerializedChatPart) => void) {
		return (part: ExtendedChatResponsePart) => {
			forward(serializeChatPart(part));
		};
	}
}

function serializeChatPart(part: ExtendedChatResponsePart): SerializedChatPart {
	if (part instanceof ChatResponseProgressPart || part instanceof ChatResponseProgressPart2) { return { kind: 'progress', message: part.value }; }
	if (part instanceof ChatResponseMarkdownWithVulnerabilitiesPart || part instanceof ChatResponseMarkdownPart) {
		const value = (part as unknown as { value: string | MarkdownString }).value; return { kind: 'markdown', value: toMarkdownString(value) };
	}
	if (part instanceof ChatResponseThinkingProgressPart) {
		const body = Array.isArray(part.value) ? part.value.join('\n') : part.value; return { kind: 'thinking', title: part.id ?? '', body };
	}
	if (part instanceof ChatResponseWarningPart) { const value = (part as any).value; return { kind: 'warning', value: toMarkdownString(value) }; }
	if (part instanceof ChatResponseCodeblockUriPart) { return { kind: 'code', value: part.value.toString() }; }
	if (part instanceof ChatResponseReferencePart) { const v = (part as any).value; return { kind: 'reference', value: v?.toString?.() ?? '' }; }
	if (part instanceof ChatPrepareToolInvocationPart) { return { kind: 'tool', name: part.toolName, status: 'start' }; }
	if (part instanceof ChatToolInvocationPart) {
		return { kind: 'tool', name: part.toolName, status: part.isComplete ? 'end' : 'start', details: { callId: part.toolCallId, isError: part.isError, isComplete: part.isComplete } };
	}
	if (part instanceof ChatResponseTextEditPart || part instanceof ChatResponseNotebookEditPart || part instanceof ChatResponseCodeCitationPart) { return { kind: 'raw', value: part }; }
	return { kind: 'raw', value: part };
}

function toMarkdownString(value: string | MarkdownString): string { return typeof value === 'string' ? value : value.value; }

export class ProxyChatServerService extends Disposable implements IProxyChatServerService {
	declare readonly _serviceBrand: undefined;

	private _state = ProxyServerLifecycleState.Stopped;
	private _port: number | undefined;
	private worker?: Worker;
	private readonly pendingRequests = new Map<string, PendingRequestState>();
	private readonly conversations = new Map<string, ConversationState>();
	private readonly agentId = getChatParticipantIdFromName(defaultAgentName);
	private readonly agentName = defaultAgentName;
	private defaultModel: ChatRequestModel | undefined;
	private startPromise: Promise<void> | undefined;
	private readonly debugVerbose = 1;
	private outputChannel: vscode.OutputChannel | undefined;

	private oc(line: string) {
		if (!this.outputChannel) { return; }
		if (line.length > 10_000) { line = line.slice(0, 9990) + '...[truncated]'; }
		this.outputChannel.appendLine(line);
	}

	private tryInitOutputChannel(): void {
		if (this.outputChannel) { return; }
		try {
			if (!VSCodeAPI) {
				// Dynamic import only if available (extension host). In pure node worker contexts this will throw.
				VSCodeAPI = require('vscode');
			}
			if (VSCodeAPI?.window?.createOutputChannel) {
				this.outputChannel = VSCodeAPI.window.createOutputChannel('Proxy Chat Server');
				this.outputChannel.appendLine('[info] output channel initialized');
				this.logService.info('[ProxyChatServer] output channel initialized');
			} else {
				this.logService.warn('[ProxyChatServer] VS Code window API not available; output channel not created');
			}
		} catch (e) {
			this.logService.warn('[ProxyChatServer] failed to create output channel: ' + (e instanceof Error ? e.message : String(e)));
		}
	}

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ILogService private readonly logService: ILogService,
		@IEndpointProvider private readonly endpointProvider: IEndpointProvider,
	) {
		super();
		this.tryInitOutputChannel();
		// Lazy async start, don't block activation
		queueMicrotask(() => this.start().catch(err => this.logService.error(err instanceof Error ? err : new Error(String(err)), '[ProxyChatServer] start failed')));
	}

	get state(): ProxyServerLifecycleState { return this._state; }
	get port(): number | undefined { return this._port; }

	async start(): Promise<void> {
		if (this._state === ProxyServerLifecycleState.Ready) { return; }
		if (this._state === ProxyServerLifecycleState.Starting) { await this.startPromise; return; }
		this.logService.info('[ProxyChatServer] start() invoked');
		this.oc('[info] start() invoked');
		this._state = ProxyServerLifecycleState.Starting;
		this.startPromise = this.initialize();
		try { await this.startPromise; } finally { this.startPromise = undefined; }
	}

	private async initialize(): Promise<void> {
		this.logService.info('[ProxyChatServer] initialize() begin - resolving model');
		this.oc('[info] initialize(): resolving model');
		try {
			this.defaultModel = await resolveProxyDefaultModel(this.endpointProvider, this.logService);
			const modelId = (this.defaultModel as any)?.id ?? 'unknown';
			this.logService.info(`[ProxyChatServer] model resolved: ${modelId}`);
			this.oc(`[info] model resolved: ${modelId}`);
		} catch (err) {
			this._state = ProxyServerLifecycleState.Stopped;
			this.logService.error(err instanceof Error ? err : new Error(String(err)), '[ProxyChatServer] model resolution failed');
			this.oc(`[error] model resolution failed: ${err instanceof Error ? err.message : String(err)}`);
			throw err;
		}

		const requestedPort = Number(process.env.COPILOT_CHAT_PROXY_PORT ?? 3998);
		this.logService.info(`[ProxyChatServer] spawning worker on port ${requestedPort}`);
		this.oc(`[info] spawning worker on port ${requestedPort}`);
		this.worker = new Worker(workerPath, { workerData: { port: requestedPort, debug: this.debugVerbose } });

		this.worker.on('message', (message: ProxyServerToHostMessage) => this.handleWorkerMessage(message));
		this.worker.on('error', err => {
			const msg = err instanceof Error ? err.message : String(err);
			this.logService.error(err instanceof Error ? err : new Error(String(err)), '[ProxyChatServer] Worker error');
			this.oc(`[error] worker error: ${msg}`);
			this.stop().catch(e => this.logService.error(e instanceof Error ? e : new Error(String(e)), '[ProxyChatServer] stop after worker error failed'));
		});
		this.worker.on('exit', code => {
			this.logService.warn(`[ProxyChatServer] worker exited code=${code}`);
			this.oc(`[warn] worker exited code=${code}`);
			if (code !== 0) { this.logService.error(new Error(`[ProxyChatServer] Worker exited with code ${code}`)); }
			this._state = ProxyServerLifecycleState.Stopped;
			this._port = undefined;
			this.worker = undefined;
		});

		this._port = requestedPort;
		this._state = ProxyServerLifecycleState.Ready;
		this.logService.info(`[ProxyChatServer] listening on port ${requestedPort}`);
		this.oc(`[info] listening on port ${requestedPort}`);
	}

	private handleWorkerMessage(message: ProxyServerToHostMessage) {
		if (this.debugVerbose) {
			const line = `[ProxyChatServer] <- worker message type=${message.type}`;
			this.logService.info(line);
			this.oc(`[debug] ${line}`);
		}
		switch (message.type) {
			case 'chatRequest':
				this.handleChatRequest(message).catch(err => {
					const errorMsg = err instanceof Error ? err.message : String(err);
					this.logService.error(`[ProxyChatServer] Failed to process chat request: ${errorMsg}`);
					this.oc(`[error] process chat request failed: ${errorMsg}`);
					this.postMessageToWorker({ type: 'responseError', requestId: message.requestId, status: 500, message: errorMsg });
				});
				break;
			case 'cancelRequest':
				if (this.debugVerbose) { const m = `[ProxyChatServer] cancellation requested requestId=${message.requestId}`; this.logService.info(m); this.oc(`[debug] ${m}`); }
				this.cancelRequest(message.requestId);
				break;
			case 'shutdown':
				this.logService.info('[ProxyChatServer] shutdown message received from worker');
				this.oc('[info] shutdown message received from worker');
				void this.stop();
				break;
		}
	}

	private async handleChatRequest(message: ProxyServerToHostChatRequestMessage): Promise<void> {
		if (!this.defaultModel) { throw new Error('Proxy chat server model is not initialized'); }

		const conversationId = message.payload.conversationId ?? generateUuid();
		let conversation = this.conversations.get(conversationId);
		if (!conversation) { conversation = { history: [] }; this.conversations.set(conversationId, conversation); }

		const attempt = Math.floor(conversation.history.length / 2);
		const chatRequest = new ServerChatRequest(
			message.payload.prompt,
			message.payload.command,
			attempt,
			message.payload.references ?? [],
			message.payload.toolReferences ?? [],
			this.defaultModel
		);

		this.echoPromptToChatUI(chatRequest.prompt).catch(err => {
			this.logService.warn(`[ProxyChatServer] echoPromptToChatUI failed: ${err instanceof Error ? err.message : String(err)}`);
		});


		const startTs = Date.now();
		const promptPreview = chatRequest.prompt.length > 120 ? chatRequest.prompt.slice(0, 117) + '...' : chatRequest.prompt;
		const handleLine = `[ProxyChatServer] handling request requestId=${message.requestId} conversationId=${conversationId} attempt=${attempt} prompt="${promptPreview}"`;
		this.logService.info(handleLine);
		this.oc(`[info] ${handleLine}`);
		const stream = new ProxyChatResponseStream(chunk => {
			if (this.debugVerbose && (chunk.kind === 'progress' || chunk.kind === 'tool')) {
				const sk = `[ProxyChatServer] -> stream kind=${chunk.kind}` + (chunk.kind === 'progress' ? ` message="${chunk.message}"` : '');
				this.logService.info(sk);
				this.oc(`[debug] ${sk}`);
			}
			this.postMessageToWorker({ type: 'responseChunk', requestId: message.requestId, chunk } satisfies ProxyHostToServerChunkMessage);
		});

		const requestTurn = new ChatRequestTurn2(
			chatRequest.prompt,
			chatRequest.command,
			Array.from(chatRequest.references),
			this.agentId,
			Array.from(chatRequest.toolReferences),
			undefined
		) as unknown as vscode.ChatRequestTurn;

		const cancellation = new CancellationTokenSource();
		const pending: PendingRequestState = { requestId: message.requestId, conversationId, cancellation, stream, requestTurn };
		this.pendingRequests.set(message.requestId, pending);

		try {
			const handler = this.instantiationService.createInstance(
				ChatParticipantRequestHandler,
				conversation.history,
				chatRequest,
				stream,
				cancellation.token,
				{ agentName: this.agentName, agentId: this.agentId, intentId: undefined },
				Event.None
			);

			const chatResult = await handler.getResult();
			await tryFinalizeResponseStream(stream);

			conversation.history.push(requestTurn);
			const responseTurn = new ChatResponseTurn2(stream.contentParts, chatResult, this.agentId) as unknown as vscode.ChatResponseTurn;
			conversation.history.push(responseTurn);

			const duration = Date.now() - startTs;
			const completeLine = `[ProxyChatServer] request complete requestId=${message.requestId} durationMs=${duration}`;
			this.logService.info(completeLine);
			this.oc(`[info] ${completeLine}`);
			this.postMessageToWorker({ type: 'responseComplete', requestId: message.requestId, conversationId, metadata: sanitizeMetadata(chatResult?.metadata) });
		} catch (err) {
			const em = err instanceof Error ? err.message : String(err);
			this.logService.error(err instanceof Error ? err : new Error(String(err)), '[ProxyChatServer] Request failed');
			this.oc(`[error] request failed requestId=${message.requestId} error=${em}`);
			this.postMessageToWorker({ type: 'responseError', requestId: message.requestId, status: err instanceof CancellationError ? 499 : 500, message: err instanceof Error ? err.message : String(err) });
		} finally {
			if (!this.pendingRequests.has(message.requestId)) {
				// already removed by cancellation path
			}
			this.pendingRequests.delete(message.requestId);
		}
	}

	private cancelRequest(requestId: string) {
		const pending = this.pendingRequests.get(requestId);
		if (!pending) { return; }
		const cancelLine = `[ProxyChatServer] cancelling requestId=${requestId}`;
		this.logService.info(cancelLine);
		this.oc(`[info] ${cancelLine}`);
		pending.cancellation.cancel();
	}

	private async echoPromptToChatUI(prompt: string): Promise<void> {
		try {
			if (!VSCodeAPI) { VSCodeAPI = require('vscode'); }
			if (!VSCodeAPI?.commands) { return; }
			await VSCodeAPI.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
			await VSCodeAPI.commands.executeCommand('type', { text: prompt });
			await VSCodeAPI.commands.executeCommand('workbench.action.chat.submit');
		} catch (err) {
			this.logService.trace('[ProxyChatServer] echoPromptToChatUI noop');
		}
	}

	private postMessageToWorker(message: ProxyHostToServerMessage) { if (this.worker) { this.worker.postMessage(message); } }

	async stop(): Promise<void> {
		if (this._state === ProxyServerLifecycleState.Stopped || this._state === ProxyServerLifecycleState.Stopping) { return; }
		this._state = ProxyServerLifecycleState.Stopping;
		this.logService.info('[ProxyChatServer] stop() invoked');
		this.oc('[info] stop() invoked');
		for (const pending of this.pendingRequests.values()) { pending.cancellation.cancel(); }
		this.pendingRequests.clear();
		await new Promise<void>(resolve => {
			if (!this.worker) { return resolve(); }
			this.worker.once('exit', () => resolve());
			this.worker.postMessage({ type: 'shutdown' });
		});
		this._state = ProxyServerLifecycleState.Stopped;
		this._port = undefined;
		this.worker = undefined;
		this.startPromise = undefined;
		this.logService.info('[ProxyChatServer] stopped');
		this.oc('[info] stopped');
	}
}

function createProxyChatModel(endpoint: IChatEndpoint): ChatRequestModel {
	const model = {
		id: endpoint.model,
		name: endpoint.name,
		vendor: 'copilot',
		family: endpoint.family,
		version: endpoint.version,
		maxInputTokens: endpoint.modelMaxPromptTokens,
		sendRequest: async () => { throw new Error('Proxy chat model cannot send requests directly'); },
		countTokens: async () => 0
	} as unknown as ChatRequestModel;

	const withCapabilities = model as unknown as { capabilities: { supportsToolCalling: boolean; toolCalling: boolean | number; imageInput?: boolean } };
	withCapabilities.capabilities = { supportsToolCalling: endpoint.supportsToolCalls, toolCalling: endpoint.supportsToolCalls, imageInput: endpoint.supportsVision };
	(model as any).maxOutputTokens = endpoint.maxOutputTokens;
	return model;
}

async function resolveProxyDefaultModel(endpointProvider: IEndpointProvider, logService: ILogService): Promise<ChatRequestModel> {
	// 允许通过环境变量精确指定单个模型 (最高优先级)
	const exactEnvModel = process.env.COPILOT_CHAT_PROXY_MODEL?.trim();
	if (exactEnvModel) {
		try {
			const endpoint = await endpointProvider.getChatEndpoint(exactEnvModel as any);
			logService.info(`[ProxyChatServer] Using explicit model from COPILOT_CHAT_PROXY_MODEL=${exactEnvModel}`);
			return createProxyChatModel(endpoint);
		} catch (err) {
			logService.warn(`[ProxyChatServer] Failed to resolve explicit model '${exactEnvModel}': ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	// 可通过 COPILOT_CHAT_PROXY_PREFERRED_MODELS 覆盖默认优先级，使用逗号分隔
	const overrideList = process.env.COPILOT_CHAT_PROXY_PREFERRED_MODELS?.split(',').map(s => s.trim()).filter(Boolean);

	// 默认优先级：新增 gpt-5 / gpt-5-mini (如果后端已支持) 放在最前；保持向后兼容
	const defaultPreferred = ['gpt-5', 'gpt-5-mini', 'gpt-4.1-mini', 'gpt-4.1', 'copilot-base'];
	const preferredModels = overrideList && overrideList.length ? overrideList : defaultPreferred;

	for (const candidate of preferredModels) {
		try {
			const endpoint = await endpointProvider.getChatEndpoint(candidate as any);
			logService.info(`[ProxyChatServer] Resolved model '${candidate}'`);
			return createProxyChatModel(endpoint);
		} catch (err) {
			logService.warn(`[ProxyChatServer] Failed to resolve model ${candidate}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
	throw new Error('Unable to resolve a chat model for proxy server');
}

function sanitizeMetadata(metadata: unknown): Record<string, unknown> | undefined {
	if (!metadata) { return undefined; }
	try { return JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>; } catch { return undefined; }
}

