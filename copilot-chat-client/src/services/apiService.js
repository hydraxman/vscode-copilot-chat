/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * API Service for communicating with Proxy Chat Server
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

class ApiService {
	/**
	 * Check server health
	 */
	async checkHealth() {
		const response = await fetch(`${API_BASE}/health`);
		if (!response.ok) {
			throw new Error('Server health check failed');
		}
		return response.json();
	}

	/**
	 * Get model information
	 */
	async getModelInfo() {
		const response = await fetch(`${API_BASE}/api/model/info`);
		if (!response.ok) {
			throw new Error('Failed to fetch model info');
		}
		return response.json();
	}

	/**
	 * Get workspace structure
	 */
	async getWorkspaceStructure() {
		const response = await fetch(`${API_BASE}/api/workspace/structure`);
		if (!response.ok) {
			throw new Error('Failed to fetch workspace structure');
		}
		return response.json();
	}

	/**
	 * Get file content
	 */
	async getFileContent(filePath) {
		const response = await fetch(`${API_BASE}/api/workspace/file?path=${encodeURIComponent(filePath)}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${filePath}`);
		}
		return response.text();
	}

	/**
	 * Get active files
	 */
	async getActiveFiles() {
		const response = await fetch(`${API_BASE}/api/workspace/active-files`);
		if (!response.ok) {
			throw new Error('Failed to fetch active files');
		}
		return response.json();
	}

	/**
	 * Send chat message (streaming)
	 */
	async sendChatMessage(prompt, conversationId = null, onChunk, onComplete, onError) {
		try {
			const response = await fetch(`${API_BASE}/chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					prompt,
					conversationId,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || ''; // Keep incomplete line in buffer

				for (const line of lines) {
					if (!line.trim()) {
						continue;
					}

					if (line.startsWith('event: ')) {
						const eventType = line.slice(7).trim();
						continue;
					}

					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));

							if (data.conversationId !== undefined) {
								// This is the end event
								if (onComplete) {
									onComplete(data);
								}
							} else if (data.status !== undefined) {
								// This is an error event
								if (onError) {
									onError(data);
								}
							} else {
								// This is a chunk event
								if (onChunk) {
									onChunk(data);
								}
							}
						} catch (e) {
							console.error('Failed to parse SSE data:', e, line);
						}
					}
				}
			}
		} catch (error) {
			if (onError) {
				onError({ message: error.message });
			}
			throw error;
		}
	}

	/**
	 * Accept an edit
	 */
	async acceptEdit(editId) {
		const response = await fetch(`${API_BASE}/api/edit/accept`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ editId }),
		});

		if (!response.ok) {
			throw new Error('Failed to accept edit');
		}
		return response.json();
	}

	/**
	 * Decline an edit
	 */
	async declineEdit(editId) {
		const response = await fetch(`${API_BASE}/api/edit/decline`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ editId }),
		});

		if (!response.ok) {
			throw new Error('Failed to decline edit');
		}
		return response.json();
	}
}

export const apiService = new ApiService();
