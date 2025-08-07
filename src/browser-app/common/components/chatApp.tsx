/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from 'react';
import { ChatInterface } from './chatInterface';
import { SettingsPanel } from './settingsPanel';

export interface ChatAppProps { }

export const ChatApp: React.FC<ChatAppProps> = () => {
	const [showSettings, setShowSettings] = useState(false);

	const toggleSettings = useCallback(() => {
		setShowSettings(prev => !prev);
	}, []);

	return (
		<div className="chat-app">
			{/* Header */}
			<div className="app-header">
				<div className="header-left">
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
				{/* Chat Interface - Full Width */}
				<div className="chat-section-full">
					<ChatInterface />
				</div>
			</div>

			{/* Settings Panel */}
			{showSettings && (
				<SettingsPanel onClose={() => setShowSettings(false)} />
			)}
		</div>
	);
};
