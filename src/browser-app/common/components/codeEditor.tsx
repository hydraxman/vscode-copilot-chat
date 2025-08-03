/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';

export interface CodeEditorProps {
	value: string;
	language: string;
	onChange: (value: string) => void;
	onFileSelect?: (fileName: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
	value,
	language,
	onChange,
	onFileSelect
}) => {
	const [fileName, setFileName] = useState('untitled.txt');

	const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value);
	};

	const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newName = e.target.value;
		setFileName(newName);
		onFileSelect?.(newName);
	};

	return (
		<div className="code-editor">
			<div className="editor-header">
				<input
					type="text"
					value={fileName}
					onChange={handleFileNameChange}
					className="file-name-input"
					placeholder="Enter file name..."
				/>
				<select
					value={language}
					onChange={(e) => {
						// 这里可以添加语言改变的逻辑
					}}
					className="language-selector"
				>
					<option value="javascript">JavaScript</option>
					<option value="typescript">TypeScript</option>
					<option value="python">Python</option>
					<option value="java">Java</option>
					<option value="css">CSS</option>
					<option value="html">HTML</option>
					<option value="json">JSON</option>
					<option value="markdown">Markdown</option>
				</select>
			</div>
			<div className="editor-container">
				<textarea
					value={value}
					onChange={handleTextChange}
					className="code-textarea"
					placeholder="Start typing your code here..."
					spellCheck={false}
				/>
			</div>
			<div className="editor-footer">
				<span className="language-info">{language}</span>
				<span className="char-count">{value.length} characters</span>
			</div>
		</div>
	);
};
