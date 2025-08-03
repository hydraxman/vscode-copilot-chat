/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChatMessage, ChatRequest } from './chatEngine';

export interface CodeContext {
	fileName: string;
	language: string;
	code: string;
	selection?: {
		start: { line: number; column: number };
		end: { line: number; column: number };
	};
	diagnostics?: Array<{
		message: string;
		severity: 'error' | 'warning' | 'info';
		line: number;
	}>;
}

export interface WorkspaceContext {
	files: Array<{
		path: string;
		language: string;
		size: number;
	}>;
	technologies: string[];
	currentFile?: string;
}

export class ContextProcessor {
	private codeContext?: CodeContext;
	private workspaceContext?: WorkspaceContext;

	setCodeContext(context: CodeContext) {
		this.codeContext = context;
	}

	setWorkspaceContext(context: WorkspaceContext) {
		this.workspaceContext = context;
	}

	processRequest(userPrompt: string, history: ChatMessage[]): ChatRequest {
		const contextMessages: string[] = [];

		// 添加代码上下文
		if (this.codeContext) {
			contextMessages.push(this.formatCodeContext(this.codeContext));
		}

		// 添加工作区上下文
		if (this.workspaceContext && this.shouldIncludeWorkspaceContext(userPrompt)) {
			contextMessages.push(this.formatWorkspaceContext(this.workspaceContext));
		}

		// 分析用户意图
		const intent = this.detectIntent(userPrompt, this.codeContext);

		// 构建增强的提示
		const enhancedPrompt = this.buildEnhancedPrompt(userPrompt, contextMessages, intent);

		return {
			id: this.generateId(),
			prompt: enhancedPrompt,
			context: contextMessages
		};
	}

	private formatCodeContext(context: CodeContext): string {
		let formatted = `Current file: ${context.fileName} (${context.language})\n\n`;

		if (context.selection) {
			formatted += `Selected code (lines ${context.selection.start.line}-${context.selection.end.line}):\n`;
		} else {
			formatted += 'Full file content:\n';
		}

		formatted += '```' + context.language + '\n' + context.code + '\n```\n';

		if (context.diagnostics && context.diagnostics.length > 0) {
			formatted += '\nDiagnostics:\n';
			context.diagnostics.forEach(diag => {
				formatted += `- Line ${diag.line}: ${diag.severity.toUpperCase()}: ${diag.message}\n`;
			});
		}

		return formatted;
	}

	private formatWorkspaceContext(context: WorkspaceContext): string {
		let formatted = 'Workspace context:\n';

		if (context.technologies.length > 0) {
			formatted += `Technologies: ${context.technologies.join(', ')}\n`;
		}

		if (context.currentFile) {
			formatted += `Current file: ${context.currentFile}\n`;
		}

		if (context.files.length > 0) {
			formatted += '\nProject files:\n';
			context.files.slice(0, 10).forEach(file => {
				formatted += `- ${file.path} (${file.language})\n`;
			});
			if (context.files.length > 10) {
				formatted += `... and ${context.files.length - 10} more files\n`;
			}
		}

		return formatted;
	}

	private detectIntent(prompt: string, codeContext?: CodeContext): string {
		const lowerPrompt = prompt.toLowerCase();

		// 修复错误
		if (lowerPrompt.includes('fix') || lowerPrompt.includes('error') || lowerPrompt.includes('bug') ||
			(codeContext?.diagnostics && codeContext.diagnostics.some(d => d.severity === 'error'))) {
			return 'fix';
		}

		// 解释代码
		if (lowerPrompt.includes('explain') || lowerPrompt.includes('what does') ||
			lowerPrompt.includes('how does') || lowerPrompt.includes('understand')) {
			return 'explain';
		}

		// 重构代码
		if (lowerPrompt.includes('refactor') || lowerPrompt.includes('improve') ||
			lowerPrompt.includes('optimize') || lowerPrompt.includes('clean up')) {
			return 'refactor';
		}

		// 生成代码
		if (lowerPrompt.includes('create') || lowerPrompt.includes('generate') ||
			lowerPrompt.includes('write') || lowerPrompt.includes('implement')) {
			return 'generate';
		}

		// 添加功能
		if (lowerPrompt.includes('add') || lowerPrompt.includes('feature') ||
			lowerPrompt.includes('extend')) {
			return 'enhance';
		}

		// 测试
		if (lowerPrompt.includes('test') || lowerPrompt.includes('unit test') ||
			lowerPrompt.includes('testing')) {
			return 'test';
		}

		// 文档
		if (lowerPrompt.includes('document') || lowerPrompt.includes('comment') ||
			lowerPrompt.includes('docs')) {
			return 'document';
		}

		return 'general';
	}

	private buildEnhancedPrompt(userPrompt: string, contextMessages: string[], intent: string): string {
		let enhancedPrompt = '';

		// 根据意图添加系统指导
		switch (intent) {
			case 'fix':
				enhancedPrompt += 'I need help fixing an issue in my code. ';
				break;
			case 'explain':
				enhancedPrompt += 'Please explain the following code. ';
				break;
			case 'refactor':
				enhancedPrompt += 'I want to refactor and improve this code. ';
				break;
			case 'generate':
				enhancedPrompt += 'I need you to generate code for me. ';
				break;
			case 'enhance':
				enhancedPrompt += 'I want to add new functionality to this code. ';
				break;
			case 'test':
				enhancedPrompt += 'I need help with testing this code. ';
				break;
			case 'document':
				enhancedPrompt += 'I need help documenting this code. ';
				break;
		}

		// 添加上下文信息
		if (contextMessages.length > 0) {
			enhancedPrompt += '\n\nContext:\n' + contextMessages.join('\n\n') + '\n\n';
		}

		// 添加用户提示
		enhancedPrompt += 'User request: ' + userPrompt;

		return enhancedPrompt;
	}

	private shouldIncludeWorkspaceContext(prompt: string): boolean {
		const workspaceKeywords = ['project', 'workspace', 'files', 'structure', 'architecture', 'overview'];
		return workspaceKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	// 意图检测的进阶功能
	getIntentConfidence(prompt: string, codeContext?: CodeContext): { intent: string; confidence: number } {
		const intents = [
			{ id: 'fix', keywords: ['fix', 'error', 'bug', 'issue', 'problem', 'wrong'], weight: 1 },
			{ id: 'explain', keywords: ['explain', 'what', 'how', 'why', 'understand', 'meaning'], weight: 1 },
			{ id: 'refactor', keywords: ['refactor', 'improve', 'optimize', 'clean', 'better'], weight: 1 },
			{ id: 'generate', keywords: ['create', 'generate', 'write', 'implement', 'build'], weight: 1 },
			{ id: 'enhance', keywords: ['add', 'feature', 'extend', 'modify', 'change'], weight: 1 },
			{ id: 'test', keywords: ['test', 'testing', 'unit test', 'spec', 'validation'], weight: 1 },
			{ id: 'document', keywords: ['document', 'comment', 'docs', 'documentation'], weight: 1 }
		];

		const lowerPrompt = prompt.toLowerCase();
		const scores = intents.map(intent => {
			const score = intent.keywords.reduce((acc, keyword) => {
				return acc + (lowerPrompt.includes(keyword) ? intent.weight : 0);
			}, 0);
			return { intent: intent.id, score };
		});

		// 额外考虑代码上下文
		if (codeContext?.diagnostics && codeContext.diagnostics.some(d => d.severity === 'error')) {
			const fixScore = scores.find(s => s.intent === 'fix');
			if (fixScore) {
				fixScore.score += 2; // 增加修复意图的权重
			}
		}

		const maxScore = Math.max(...scores.map(s => s.score));
		const bestMatch = scores.find(s => s.score === maxScore);

		return {
			intent: bestMatch?.intent || 'general',
			confidence: maxScore > 0 ? Math.min(maxScore / 3, 1) : 0
		};
	}
}

export const contextProcessor = new ContextProcessor();
