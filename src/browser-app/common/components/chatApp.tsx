/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from 'react';
import { ChatInterface } from './chatInterface';
import { CodeEditor } from './codeEditor';
import { FileExplorer } from './fileExplorer';
import { SettingsPanel } from './settingsPanel';

export interface ChatAppProps { }

export const ChatApp: React.FC<ChatAppProps> = () => {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [fileContent, setFileContent] = useState<string>('');
	const [showSettings, setShowSettings] = useState(false);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	const handleFileSelect = useCallback((fileName: string) => {
		setSelectedFile(fileName);
		// 模拟文件内容加载
		setFileContent(`// Content of ${fileName}\nconsole.log('Hello from ${fileName}');`);
	}, []);

	const handleFileChange = useCallback((content: string) => {
		setFileContent(content);
	}, []);

	const toggleSidebar = useCallback(() => {
		setSidebarCollapsed(prev => !prev);
	}, []);

	const toggleSettings = useCallback(() => {
		setShowSettings(prev => !prev);
	}, []);

	return (
		<div className="chat-app">
			{/* Header */}
			<div className="app-header">
				<div className="header-left">
					<button
						className="sidebar-toggle"
						onClick={toggleSidebar}
						title={sidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}
					>
						☰
					</button>
					<h1 className="app-title">GitHub Copilot Chat</h1>
				</div>
				<div className="header-right">
					<button
						className="settings-button"
						onClick={toggleSettings}
						title="Settings"
					>
						⚙️
					</button>
				</div>
			</div>

			<div className="app-body">
				{/* Sidebar */}
				{!sidebarCollapsed && (
					<div className="sidebar">
						<FileExplorer
							files={[
								{
									name: 'src', type: 'folder', children: [
										{ name: 'main.js', type: 'file' },
										{
											name: 'components', type: 'folder', children: [
												{ name: 'App.jsx', type: 'file' },
												{ name: 'Header.jsx', type: 'file' }
											]
										}
									]
								},
								{ name: 'package.json', type: 'file' },
								{ name: 'README.md', type: 'file' }
							]}
							onFileSelect={handleFileSelect}
							selectedFile={selectedFile}
						/>
					</div>
				)}

				{/* Main Content Area */}
				<div className="main-content">
					{/* Code Editor */}
					<div className="editor-section">
						<CodeEditor
							value={fileContent}
							language="javascript"
							onChange={handleFileChange}
							onFileSelect={handleFileSelect}
						/>
					</div>

					{/* Chat Interface */}
					<div className="chat-section">
						<ChatInterface selectedFile={selectedFile} />
					</div>
				</div>
			</div>

			{/* Settings Panel */}
			{showSettings && (
				<SettingsPanel onClose={() => setShowSettings(false)} />
			)}
		</div>
	);
};
