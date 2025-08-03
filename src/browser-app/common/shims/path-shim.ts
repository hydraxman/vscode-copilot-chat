/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Path utilities for browser environment
 */

export function join(...paths: string[]): string {
	return paths.filter(p => p).join('/').replace(/\/+/g, '/');
}

export function dirname(path: string): string {
	const parts = path.split('/');
	return parts.slice(0, -1).join('/') || '/';
}

export function basename(path: string, ext?: string): string {
	const parts = path.split('/');
	let name = parts[parts.length - 1] || '';
	if (ext && name.endsWith(ext)) {
		name = name.slice(0, -ext.length);
	}
	return name;
}

export function extname(path: string): string {
	const name = basename(path);
	const dotIndex = name.lastIndexOf('.');
	return dotIndex >= 0 ? name.slice(dotIndex) : '';
}

export function relative(from: string, to: string): string {
	const fromParts = from.split('/').filter(p => p);
	const toParts = to.split('/').filter(p => p);

	let i = 0;
	while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
		i++;
	}

	const upCount = fromParts.length - i;
	const relativeParts = Array(upCount).fill('..').concat(toParts.slice(i));

	return relativeParts.join('/') || '.';
}

export function resolve(...paths: string[]): string {
	let resolved = '';
	for (const path of paths) {
		if (path.startsWith('/')) {
			resolved = path;
		} else {
			resolved = join(resolved || '/', path);
		}
	}
	return resolved || '/';
}

export const sep = '/';
export const delimiter = ':';
export const posix = {
	join,
	dirname,
	basename,
	extname,
	relative,
	resolve,
	sep: '/',
	delimiter: ':'
};

export default {
	join,
	dirname,
	basename,
	extname,
	relative,
	resolve,
	sep,
	delimiter,
	posix
};
