/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Crypto shim for browser environment
 */

const browserGlobals = globalThis as any;

export function randomBytes(size: number): Uint8Array {
	if (browserGlobals.crypto && browserGlobals.crypto.getRandomValues) {
		const bytes = new Uint8Array(size);
		browserGlobals.crypto.getRandomValues(bytes);
		return bytes;
	}

	// Fallback
	const bytes = new Uint8Array(size);
	for (let i = 0; i < size; i++) {
		bytes[i] = Math.floor(Math.random() * 256);
	}
	return bytes;
}

export function createHash(algorithm: string) {
	return {
		update: (data: string | Buffer) => ({
			digest: (encoding?: string) => {
				// Simple hash implementation for browser
				let hash = 0;
				const str = typeof data === 'string' ? data : data.toString();
				for (let i = 0; i < str.length; i++) {
					const char = str.charCodeAt(i);
					hash = ((hash << 5) - hash) + char;
					hash = hash & hash; // Convert to 32-bit integer
				}
				return encoding === 'hex' ? hash.toString(16) : hash.toString();
			}
		})
	};
}

export default {
	randomBytes,
	createHash
};
