/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ChatLanguageModelToolReference, ChatPromptReference } from 'vscode';

export interface ProxyChatRequestPayload {
	readonly prompt: string;
	readonly conversationId?: string;
	readonly command?: string;
	readonly references?: readonly ChatPromptReference[];
	readonly toolReferences?: readonly ChatLanguageModelToolReference[];
}

export interface ProxyServerToHostChatRequestMessage {
	readonly type: 'chatRequest';
	readonly requestId: string;
	readonly payload: ProxyChatRequestPayload;
}

export interface ProxyServerToHostCancelMessage {
	readonly type: 'cancelRequest';
	readonly requestId: string;
}

export interface ProxyServerToHostShutdownMessage {
	readonly type: 'shutdown';
}

export type ProxyServerToHostMessage = ProxyServerToHostChatRequestMessage | ProxyServerToHostCancelMessage | ProxyServerToHostShutdownMessage;

export type SerializedChatPart =
	| { readonly kind: 'progress'; readonly message: string }
	| { readonly kind: 'markdown'; readonly value: string }
	| { readonly kind: 'thinking'; readonly title: string; readonly body: string }
	| { readonly kind: 'reference'; readonly value: string }
	| { readonly kind: 'code'; readonly language?: string; readonly value: string }
	| { readonly kind: 'warning'; readonly value: string }
	| { readonly kind: 'tool'; readonly name: string; readonly status: 'start' | 'end'; readonly details?: unknown }
	| { readonly kind: 'raw'; readonly value: unknown };

export interface ProxyHostToServerChunkMessage {
	readonly type: 'responseChunk';
	readonly requestId: string;
	readonly chunk: SerializedChatPart;
}

export interface ProxyHostToServerCompleteMessage {
	readonly type: 'responseComplete';
	readonly requestId: string;
	readonly conversationId: string;
	readonly metadata?: Record<string, unknown>;
}

export interface ProxyHostToServerErrorMessage {
	readonly type: 'responseError';
	readonly requestId: string;
	readonly status: number;
	readonly message: string;
}

export interface ProxyHostToServerReadyMessage {
	readonly type: 'serverReady';
	readonly port: number;
}

export type ProxyHostToServerMessage =
	| ProxyHostToServerChunkMessage
	| ProxyHostToServerCompleteMessage
	| ProxyHostToServerErrorMessage
	| ProxyHostToServerReadyMessage;

export const enum ProxyServerLifecycleState {
	Starting = 'starting',
	Ready = 'ready',
	Stopping = 'stopping',
	Stopped = 'stopped'
}
