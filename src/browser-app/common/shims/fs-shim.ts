/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * File system shim for browser environment
 */

export class Stats {
	constructor(public isFile: boolean, public isDirectory: boolean, public size: number) { }
}

export function readFileSync(path: string, encoding?: string): string | Buffer {
	throw new Error('readFileSync not supported in browser');
}

export function writeFileSync(path: string, data: string | Buffer): void {
	throw new Error('writeFileSync not supported in browser');
}

export function existsSync(path: string): boolean {
	return false;
}

export function statSync(path: string): Stats {
	throw new Error('statSync not supported in browser');
}

export function mkdirSync(path: string, options?: any): void {
	// no-op in browser
}

export function readdirSync(path: string): string[] {
	return [];
}

export const promises = {
	readFile: async (path: string, encoding?: string): Promise<string | Buffer> => {
		throw new Error('readFile not supported in browser');
	},
	writeFile: async (path: string, data: string | Buffer): Promise<void> => {
		throw new Error('writeFile not supported in browser');
	},
	mkdir: async (path: string, options?: any): Promise<void> => {
		// no-op in browser
	},
	stat: async (path: string): Promise<Stats> => {
		throw new Error('stat not supported in browser');
	}
};

export default {
	readFileSync,
	writeFileSync,
	existsSync,
	statSync,
	mkdirSync,
	readdirSync,
	promises,
	Stats
};
