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

export interface ProxyServerToHostGetWorkspaceStructureMessage {
	readonly type: 'getWorkspaceStructure';
	readonly requestId: string;
}

export interface ProxyServerToHostGetFileContentMessage {
	readonly type: 'getFileContent';
	readonly requestId: string;
	readonly filePath: string;
}

export interface ProxyServerToHostGetActiveFilesMessage {
	readonly type: 'getActiveFiles';
	readonly requestId: string;
}

export interface ProxyServerToHostAcceptEditMessage {
	readonly type: 'acceptEdit';
	readonly requestId: string;
	readonly editId: string;
}

export interface ProxyServerToHostDeclineEditMessage {
	readonly type: 'declineEdit';
	readonly requestId: string;
	readonly editId: string;
}

export interface ProxyServerToHostGetModelInfoMessage {
	readonly type: 'getModelInfo';
	readonly requestId: string;
}

export type ProxyServerToHostMessage =
	| ProxyServerToHostChatRequestMessage
	| ProxyServerToHostCancelMessage
	| ProxyServerToHostShutdownMessage
	| ProxyServerToHostGetWorkspaceStructureMessage
	| ProxyServerToHostGetFileContentMessage
	| ProxyServerToHostGetActiveFilesMessage
	| ProxyServerToHostAcceptEditMessage
	| ProxyServerToHostDeclineEditMessage
	| ProxyServerToHostGetModelInfoMessage;

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

export interface ProxyHostToServerWorkspaceStructureMessage {
	readonly type: 'workspaceStructure';
	readonly requestId: string;
	readonly structure: WorkspaceStructure;
}

export interface ProxyHostToServerFileContentMessage {
	readonly type: 'fileContent';
	readonly requestId: string;
	readonly content: string;
	readonly encoding?: string;
}

export interface ProxyHostToServerActiveFilesMessage {
	readonly type: 'activeFiles';
	readonly requestId: string;
	readonly files: string[];
}

export interface ProxyHostToServerEditResponseMessage {
	readonly type: 'editResponse';
	readonly requestId: string;
	readonly success: boolean;
	readonly message?: string;
}

export interface ProxyHostToServerModelInfoMessage {
	readonly type: 'modelInfo';
	readonly requestId: string;
	readonly modelId: string;
	readonly modelName: string;
	readonly mode: 'ask' | 'edit' | 'agent';
}

export interface ProxyHostToServerApiErrorMessage {
	readonly type: 'apiError';
	readonly requestId: string;
	readonly message: string;
}

export type ProxyHostToServerMessage =
	| ProxyHostToServerChunkMessage
	| ProxyHostToServerCompleteMessage
	| ProxyHostToServerErrorMessage
	| ProxyHostToServerReadyMessage
	| ProxyHostToServerWorkspaceStructureMessage
	| ProxyHostToServerFileContentMessage
	| ProxyHostToServerActiveFilesMessage
	| ProxyHostToServerEditResponseMessage
	| ProxyHostToServerModelInfoMessage
	| ProxyHostToServerApiErrorMessage;

export interface WorkspaceFileNode {
	readonly name: string;
	readonly path: string;
	readonly type: 'file' | 'directory';
	readonly children?: WorkspaceFileNode[];
}

export interface WorkspaceStructure {
	readonly workspaceFolders: Array<{
		readonly name: string;
		readonly path: string;
		readonly tree: WorkspaceFileNode[];
	}>;
}

export const enum ProxyServerLifecycleState {
	Starting = 'starting',
	Ready = 'ready',
	Stopping = 'stopping',
	Stopped = 'stopped'
}
