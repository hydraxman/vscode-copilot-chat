/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState } from 'react';

export interface FileItem {
	name: string;
	type: 'file' | 'folder';
	children?: FileItem[];
}

export interface FileExplorerProps {
	files: FileItem[];
	onFileSelect: (fileName: string) => void;
	selectedFile: string | null;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
	files,
	onFileSelect,
	selectedFile
}) => {
	const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

	const toggleFolder = (folderName: string) => {
		const newExpanded = new Set(expandedFolders);
		if (newExpanded.has(folderName)) {
			newExpanded.delete(folderName);
		} else {
			newExpanded.add(folderName);
		}
		setExpandedFolders(newExpanded);
	};

	const renderFileItem = (item: FileItem, depth = 0): React.ReactNode => {
		const isExpanded = expandedFolders.has(item.name);
		const isSelected = selectedFile === item.name;

		return (
			<div key={item.name} className="file-item">
				<div
					className={`file-item-content ${isSelected ? 'selected' : ''}`}
					style={{ paddingLeft: `${depth * 16 + 8}px` }}
					onClick={() => {
						if (item.type === 'folder') {
							toggleFolder(item.name);
						} else {
							onFileSelect(item.name);
						}
					}}
				>
					<span className="file-icon">
						{item.type === 'folder' ? (isExpanded ? '📂' : '📁') : '📄'}
					</span>
					<span className="file-name">{item.name}</span>
				</div>
				{item.type === 'folder' && isExpanded && item.children && (
					<div className="folder-children">
						{item.children.map(child => renderFileItem(child, depth + 1))}
					</div>
				)}
			</div>
		);
	};

	return (
		<div className="file-explorer">
			<div className="explorer-header">
				<h3>Explorer</h3>
				<button className="new-file-btn" title="New File">
					📄+
				</button>
			</div>
			<div className="file-list">
				{files.length === 0 ? (
					<div className="empty-explorer">
						<p>No files to display</p>
						<p>Upload or create files to get started</p>
					</div>
				) : (
					files.map(file => renderFileItem(file))
				)}
			</div>
		</div>
	);
};
