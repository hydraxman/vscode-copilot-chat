/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';

export interface SettingsPanelProps {
	onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
	const [apiKey, setApiKey] = useState('');
	const [model, setModel] = useState('gpt-4');
	const [theme, setTheme] = useState('dark');
	const [fontSize, setFontSize] = useState(14);

	const handleSave = () => {
		// 这里可以保存设置到localStorage或其他持久化存储
		localStorage.setItem('copilot-settings', JSON.stringify({
			apiKey,
			model,
			theme,
			fontSize
		}));
		onClose();
	};

	const handleReset = () => {
		setApiKey('');
		setModel('gpt-4');
		setTheme('dark');
		setFontSize(14);
	};

	return (
		<div className="settings-panel">
			<div className="settings-overlay" onClick={onClose} />
			<div className="settings-content">
				<div className="settings-header">
					<h2>Settings</h2>
					<button onClick={onClose} className="close-button">
						✕
					</button>
				</div>

				<div className="settings-body">
					<div className="setting-group">
						<label htmlFor="api-key">API Key</label>
						<input
							id="api-key"
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="Enter your OpenAI API key..."
						/>
					</div>

					<div className="setting-group">
						<label htmlFor="model">AI Model</label>
						<select
							id="model"
							value={model}
							onChange={(e) => setModel(e.target.value)}
						>
							<option value="gpt-4">GPT-4</option>
							<option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
							<option value="claude-3">Claude 3</option>
							<option value="gemini-pro">Gemini Pro</option>
						</select>
					</div>

					<div className="setting-group">
						<label htmlFor="theme">Theme</label>
						<select
							id="theme"
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
						>
							<option value="dark">Dark</option>
							<option value="light">Light</option>
							<option value="auto">Auto</option>
						</select>
					</div>

					<div className="setting-group">
						<label htmlFor="font-size">Font Size</label>
						<input
							id="font-size"
							type="number"
							min="10"
							max="24"
							value={fontSize}
							onChange={(e) => setFontSize(parseInt(e.target.value))}
						/>
					</div>
				</div>

				<div className="settings-footer">
					<button onClick={handleReset} className="reset-button">
						Reset to Defaults
					</button>
					<div className="button-group">
						<button onClick={onClose} className="cancel-button">
							Cancel
						</button>
						<button onClick={handleSave} className="save-button">
							Save
						</button>
					</div>
				</div>
			</div>
		</div>
	);
};
