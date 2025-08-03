/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * OS utilities for browser environment
 */

export function platform(): string {
	return 'browser';
}

export function arch(): string {
	return 'wasm';
}

export function homedir(): string {
	return '/home';
}

export function tmpdir(): string {
	return '/tmp';
}

export function hostname(): string {
	return 'browser-host';
}

export const EOL = '\n';
export const type = () => 'Browser';
export const release = () => '1.0.0';

export default {
	platform,
	arch,
	homedir,
	tmpdir,
	hostname,
	EOL,
	type,
	release
};
