/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * VS Code API shim for browser environment
 * This provides browser-compatible implementations of VS Code APIs used by the chat extension
 */

// Browser globals helper
const browserGlobals = globalThis as any;

// Browser storage implementation
class BrowserStorage {
	private storage = new Map<string, any>();

	get<T>(key: string, defaultValue?: T): T | undefined {
		const value = this.storage.get(key);
		return value !== undefined ? value : defaultValue;
	}

	update(key: string, value: any): Promise<void> {
		this.storage.set(key, value);
		// 持久化到 localStorage
		try {
			if (browserGlobals.localStorage) {
				browserGlobals.localStorage.setItem(`copilot_chat_${key}`, JSON.stringify(value));
			}
		} catch (e) {
			console.warn('Failed to persist to localStorage:', e);
		}
		return Promise.resolve();
	}

	keys(): readonly string[] {
		return Array.from(this.storage.keys());
	}
}

// Simple event emitter
class SimpleEventEmitter<T> {
	private listeners: ((e: T) => void)[] = [];

	fire(event: T): void {
		this.listeners.forEach(listener => {
			try {
				listener(event);
			} catch (e) {
				console.error('Event listener error:', e);
			}
		});
	}

	on(listener: (e: T) => void): { dispose(): void } {
		this.listeners.push(listener);
		return {
			dispose: () => {
				const index = this.listeners.indexOf(listener);
				if (index >= 0) {
					this.listeners.splice(index, 1);
				}
			}
		};
	}

	get event() {
		return this.on.bind(this);
	}
}

// Browser file system abstraction
class BrowserFileSystem {
	private files = new Map<string, string>();

	async readFile(uri: any): Promise<Uint8Array> {
		const path = typeof uri === 'string' ? uri : uri.path;
		const content = this.files.get(path) || '';
		return new TextEncoder().encode(content);
	}

	async writeFile(uri: any, content: Uint8Array): Promise<void> {
		const path = typeof uri === 'string' ? uri : uri.path;
		const text = new TextDecoder().decode(content);
		this.files.set(path, text);
	}

	async stat(uri: any): Promise<{ type: number; size: number }> {
		const path = typeof uri === 'string' ? uri : uri.path;
		const content = this.files.get(path);
		return {
			type: content ? 1 : 0, // 1 = file, 0 = unknown
			size: content ? content.length : 0
		};
	}
}

// VS Code API implementation for browser
const vscode = {
	// Extension context
	ExtensionContext: class {
		subscriptions: any[] = [];
		workspaceState = new BrowserStorage();
		globalState = new BrowserStorage();
		extensionUri = { scheme: 'browser', path: '/extension' };
		extensionPath = '/extension';
		asAbsolutePath = (relativePath: string) => `/extension/${relativePath}`;
	},

	// Commands
	commands: {
		executeCommand: async (command: string, ...args: any[]): Promise<any> => {
			console.log(`[Browser] Command executed: ${command}`, args);
			return null;
		},
		registerCommand: (command: string, callback: (...args: any[]) => any) => {
			console.log(`[Browser] Command registered: ${command}`);
			return { dispose: () => { } };
		}
	},

	// Window API
	window: {
		showInformationMessage: async (message: string, ...items: string[]): Promise<string | undefined> => {
			console.log(`[Info] ${message}`);
			if (items.length > 0) {
				// 简单的浏览器确认对话框
				if (browserGlobals.confirm) {
					const result = browserGlobals.confirm(`${message}\n\nOptions: ${items.join(', ')}`);
					return result ? items[0] : undefined;
				}
			}
			if (browserGlobals.alert) {
				browserGlobals.alert(message);
			}
			return undefined;
		},
		showWarningMessage: async (message: string): Promise<void> => {
			console.warn(`[Warning] ${message}`);
			if (browserGlobals.alert) {
				browserGlobals.alert(`Warning: ${message}`);
			}
		},
		showErrorMessage: async (message: string): Promise<void> => {
			console.error(`[Error] ${message}`);
			if (browserGlobals.alert) {
				browserGlobals.alert(`Error: ${message}`);
			}
		},
		createOutputChannel: (name: string) => {
			console.log(`[Browser] Output channel created: ${name}`);
			return {
				append: (value: string) => console.log(`[${name}]`, value),
				appendLine: (value: string) => console.log(`[${name}]`, value),
				show: () => { },
				dispose: () => { }
			};
		}
	},

	// Workspace API
	workspace: {
		fs: new BrowserFileSystem(),
		workspaceFolders: [],
		onDidChangeWorkspaceFolders: new SimpleEventEmitter().event,
		getConfiguration: (section?: string) => ({
			get: (key: string, defaultValue?: any) => {
				const storageKey = section ? `${section}.${key}` : key;
				try {
					if (browserGlobals.localStorage) {
						const stored = browserGlobals.localStorage.getItem(`copilot_config_${storageKey}`);
						return stored ? JSON.parse(stored) : defaultValue;
					}
				} catch {
					// ignore
				}
				return defaultValue;
			},
			update: async (key: string, value: any) => {
				const storageKey = section ? `${section}.${key}` : key;
				try {
					if (browserGlobals.localStorage) {
						browserGlobals.localStorage.setItem(`copilot_config_${storageKey}`, JSON.stringify(value));
					}
				} catch (e) {
					console.warn('Failed to update configuration:', e);
				}
			}
		}),
		onDidChangeConfiguration: new SimpleEventEmitter().event
	},

	// URI utilities
	Uri: {
		parse: (path: string) => ({ scheme: 'browser', path }),
		file: (path: string) => ({ scheme: 'file', path }),
		from: (components: any) => components
	},

	// Environment
	env: {
		appName: 'GitHub Copilot Chat (Browser)',
		appRoot: '/browser-app',
		language: browserGlobals.navigator?.language || 'en',
		clipboard: {
			writeText: async (text: string) => {
				try {
					if (browserGlobals.navigator?.clipboard) {
						await browserGlobals.navigator.clipboard.writeText(text);
					}
				} catch {
					console.warn('Clipboard write failed');
				}
			},
			readText: async () => {
				try {
					if (browserGlobals.navigator?.clipboard) {
						return await browserGlobals.navigator.clipboard.readText();
					}
				} catch {
					// ignore
				}
				return '';
			}
		}
	},

	// Event emitter
	EventEmitter: SimpleEventEmitter,

	// Disposable
	Disposable: class {
		constructor(private callOnDispose: () => void) { }
		dispose() {
			this.callOnDispose();
		}
		static from(...disposables: { dispose(): void }[]) {
			return {
				dispose: () => disposables.forEach(d => d.dispose())
			};
		}
	},

	// Chat API (simplified)
	chat: {
		createChatParticipant: (id: string, handler: any) => {
			console.log(`[Browser] Chat participant created: ${id}`);
			return { dispose: () => { } };
		}
	},

	// Language models (simplified)
	lm: {
		selectChatModels: async () => [],
		onDidChangeChatModels: new SimpleEventEmitter().event
	},

	// Progress
	ProgressLocation: {
		Notification: 15,
		Window: 10
	},

	// Other enums and constants
	FileType: {
		File: 1,
		Directory: 2
	},

	TreeItemCollapsibleState: {
		None: 0,
		Collapsed: 1,
		Expanded: 2
	}
};

// Export individual APIs for compatibility
export const commands = vscode.commands;
export const workspace = vscode.workspace;
export const Uri = vscode.Uri;
export const env = vscode.env;
export const EventEmitter = vscode.EventEmitter;
export const Disposable = vscode.Disposable;

// Default export
export default vscode;
