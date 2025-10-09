import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import { apiService } from './services/apiService';
import './App.css';

function App() {
  const [modelInfo, setModelInfo] = useState(null);
  const [workspaceStructure, setWorkspaceStructure] = useState(null);
  const [activeFiles, setActiveFiles] = useState([]);
  const [serverStatus, setServerStatus] = useState('connecting');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Initialize connection and load data
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check server health
      const health = await apiService.checkHealth();
      if (health.status === 'ok') {
        setServerStatus('connected');
      }

      // Load model info
      const model = await apiService.getModelInfo();
      setModelInfo(model);

      // Load workspace structure
      const workspace = await apiService.getWorkspaceStructure();
      setWorkspaceStructure(workspace);

      // Load active files
      const files = await apiService.getActiveFiles();
      setActiveFiles(files.files || []);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setServerStatus('error');
    }
  };

  const handleRefreshWorkspace = async () => {
    try {
      const workspace = await apiService.getWorkspaceStructure();
      setWorkspaceStructure(workspace);

      const files = await apiService.getActiveFiles();
      setActiveFiles(files.files || []);
    } catch (error) {
      console.error('Failed to refresh workspace:', error);
    }
  };

  return (
    <div className="app">
      <div className="app-container">
        <Sidebar
          workspaceStructure={workspaceStructure}
          activeFiles={activeFiles}
          onRefresh={handleRefreshWorkspace}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="main-content">
          <ChatInterface
            modelInfo={modelInfo}
            onRefreshWorkspace={handleRefreshWorkspace}
          />
        </div>
      </div>
      <StatusBar
        serverStatus={serverStatus}
        modelInfo={modelInfo}
        onRefresh={initializeApp}
      />
    </div>
  );
}

export default App;
