/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import ReactDOM from 'react-dom';
import { ChatApp } from './components/chatApp';
import { chatEngine } from './core/chatEngine';
import { contextProcessor } from './core/contextProcessor';
import './styles/app.css';

// 导出核心组件供外部测试使用
export { chatEngine, contextProcessor };

// 初始化浏览器环境
function initializeBrowserApp() {
	console.log('Initializing GitHub Copilot Chat for Browser...');

	// 设置全局错误处理
	window.addEventListener('error', (event) => {
		console.error('Global error:', event.error);
	});

	window.addEventListener('unhandledrejection', (event) => {
		console.error('Unhandled promise rejection:', event.reason);
	});

	// 挂载React应用
	const container = document.getElementById('root');
	if (!container) {
		throw new Error('Root element not found');
	}

	// 使用React 17的渲染方式
	ReactDOM.render(React.createElement(ChatApp), container);

	console.log('GitHub Copilot Chat initialized successfully!');
}

// 等待DOM加载完成
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeBrowserApp);
} else {
	initializeBrowserApp();
}
