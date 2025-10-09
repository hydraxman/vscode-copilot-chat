import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, RefreshCw, X, Menu } from 'lucide-react';
import { apiService } from '../services/apiService';
import './Sidebar.css';

function Sidebar({ workspaceStructure, activeFiles, onRefresh, collapsed, onToggleCollapse }) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [loadingFile, setLoadingFile] = useState(false);

  const toggleFolder = (path) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath) => {
    setSelectedFile(filePath);
    setLoadingFile(true);

    try {
      const content = await apiService.getFileContent(filePath);
      setFileContent(content);
    } catch (error) {
      console.error('Failed to load file:', error);
      setFileContent(`Error loading file: ${error.message}`);
    } finally {
      setLoadingFile(false);
    }
  };

  const renderFileTree = (node, level = 0, parentPath = '') => {
    const fullPath = parentPath ? `${parentPath}/${node.name}` : node.name;
    const isExpanded = expandedFolders.has(fullPath);

    if (node.type === 'directory') {
      return (
        <div key={fullPath} className="tree-node">
          <div
            className="tree-item directory"
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => toggleFolder(fullPath)}
          >
            {isExpanded ? (
              <>
                <ChevronDown size={16} className="tree-icon" />
                <FolderOpen size={16} className="tree-icon" />
              </>
            ) : (
              <>
                <ChevronRight size={16} className="tree-icon" />
                <Folder size={16} className="tree-icon" />
              </>
            )}
            <span className="tree-label">{node.name}</span>
          </div>
          {isExpanded && node.children && (
            <div className="tree-children">
              {node.children.map(child => renderFileTree(child, level + 1, fullPath))}
            </div>
          )}
        </div>
      );
    } else {
      const isActive = activeFiles.includes(fullPath);
      const isSelected = selectedFile === fullPath;

      return (
        <div
          key={fullPath}
          className={`tree-item file ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 16 + 32}px` }}
          onClick={() => handleFileClick(fullPath)}
        >
          <File size={16} className="tree-icon" />
          <span className="tree-label">{node.name}</span>
        </div>
      );
    }
  };

  if (collapsed) {
    return (
      <div className="sidebar collapsed">
        <button className="collapse-button" onClick={onToggleCollapse}>
          <Menu size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Workspace Explorer</h3>
        <div className="sidebar-actions">
          <button className="icon-button" onClick={onRefresh} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="icon-button" onClick={onToggleCollapse} title="Collapse">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-header">
          <span>Active Files</span>
          <span className="badge">{activeFiles.length}</span>
        </div>
        <div className="active-files-list">
          {activeFiles.length === 0 ? (
            <div className="empty-message">No files open</div>
          ) : (
            activeFiles.map(file => (
              <div
                key={file}
                className={`active-file-item ${selectedFile === file ? 'selected' : ''}`}
                onClick={() => handleFileClick(file)}
              >
                <File size={14} />
                <span>{file.split('/').pop()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-section file-tree-section">
        <div className="section-header">
          <span>Files</span>
        </div>
        <div className="file-tree">
          {workspaceStructure ? (
            workspaceStructure.workspaceFolders.map(folder => (
              <div key={folder.name} className="workspace-folder">
                <div className="workspace-folder-name">{folder.name}</div>
                {folder.tree.children && folder.tree.children.map(child =>
                  renderFileTree(child, 0, '')
                )}
              </div>
            ))
          ) : (
            <div className="empty-message">Loading workspace...</div>
          )}
        </div>
      </div>

      {selectedFile && (
        <div className="file-preview">
          <div className="preview-header">
            <span className="preview-title">{selectedFile.split('/').pop()}</span>
            <button className="icon-button" onClick={() => setSelectedFile(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="preview-content">
            {loadingFile ? (
              <div className="loading-message">Loading...</div>
            ) : (
              <pre><code>{fileContent}</code></pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
