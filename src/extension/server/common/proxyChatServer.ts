/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createServiceIdentifier } from '../../../util/common/services';
import type { ProxyServerLifecycleState } from './proxyProtocol';

export interface IProxyChatServerService {
	readonly _serviceBrand: undefined;

	readonly state: ProxyServerLifecycleState;

	readonly port: number | undefined;

	start(): Promise<void>;

	stop(): Promise<void>;
}

export const IProxyChatServerService = createServiceIdentifier<IProxyChatServerService>('IProxyChatServerService');
