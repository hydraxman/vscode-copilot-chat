/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import type {
	ChatRequest,
	ChatRequestTurn,
	ChatResponseStream,
	ChatResponseTurn,
	ChatResult,
	ExtendedChatResponsePart
} from 'vscode';
import { defaultAgentName, getChatParticipantIdFromName } from '../../../platform/chat/common/chatAgents';
import { ChatResponseStreamImpl } from '../../../util/common/chatResponseStreamImpl';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';
import { Event } from '../../../util/vs/base/common/event';
import { generateUuid } from '../../../util/vs/base/common/uuid';
import { IInstantiationService, ServicesAccessor } from '../../../util/vs/platform/instantiation/common/instantiation';
import * as vscodeTypes from '../../../vscodeTypes';
import { ChatResponseMarkdownPart, ChatResponseProgressPart, ChatResponseProgressPart2 } from '../../../vscodeTypes';
import { ChatParticipantRequestHandler, IChatAgentArgs } from './chatParticipantRequestHandler';

export interface ProgrammaticChatOptions {
	readonly agentName?: string;
	readonly intentId?: string;
	readonly history?: ReadonlyArray<ChatRequestTurn | ChatResponseTurn>;
}

export interface ProgrammaticChatResponse {
	readonly result: ChatResult;
	readonly parts: readonly ExtendedChatResponsePart[];
	readonly text: string;
}

interface SimpleChatRequest extends ChatRequest {
	id: string;
}

// Mirror the TestChatRequest shape used in tests (simplified)
function createRequest(prompt: string): SimpleChatRequest {
	return {
		prompt,
		command: undefined,
		references: [],
		location: vscodeTypes.ChatLocation.Panel,
		location2: undefined,
		attempt: 0,
		enableCommandDetection: false,
		isParticipantDetected: false,
		toolReferences: [],
		// ChatRequest.toolInvocationToken is typed as never for normal (non-tool-invocation) requests
		toolInvocationToken: undefined as never,
		model: null as any,
		tools: new Map(),
		id: generateUuid()
	};
}

// NOTE: We intentionally avoid importing/activating ConversationFeature here to prevent
// duplicate provider registration and to respect layering (prompt/* should not pull in vscode-node/* directly).
export async function sendProgrammaticChatMessage(
	accessor: ServicesAccessor,
	prompt: string,
	options: ProgrammaticChatOptions = {}
): Promise<ProgrammaticChatResponse> {

	if (!prompt.trim()) {
		throw new Error('Prompt must be non-empty');
	}

	const instantiationService = accessor.get(IInstantiationService);

	// Assume the main extension activation already set up required providers.
	try {
		const request = createRequest(prompt);
		const agentName = options.agentName ?? defaultAgentName;
		const chatAgentArgs: IChatAgentArgs = {
			agentName,
			agentId: getChatParticipantIdFromName(agentName),
			intentId: options.intentId ?? ''
		};

		const parts: ExtendedChatResponsePart[] = [];
		const stream: ChatResponseStream = new ChatResponseStreamImpl(
			part => parts.push(part),
			/* clear */() => { },
			/* finalize */ undefined
		);

		const handler = instantiationService.createInstance(
			ChatParticipantRequestHandler,
			options.history ?? [],
			request,
			stream,
			CancellationToken.None,
			chatAgentArgs,
			Event.None
		);

		const result = await handler.getResult();

		const textChunks: string[] = [];
		for (const p of parts) {
			if (p instanceof ChatResponseMarkdownPart) {
				textChunks.push(typeof p.value === 'string' ? p.value : p.value.value);
			} else if (p instanceof ChatResponseProgressPart || p instanceof ChatResponseProgressPart2) {
				// @ts-ignore internal fields vary
				textChunks.push((p as any).message ?? (p as any).value ?? '');
			}
		}

		return { result, parts, text: textChunks.join('\n') };
	} finally {
		// Nothing to clean up; stream finalization handled by caller if needed.
	}
}