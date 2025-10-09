import React from 'react';
import { Circle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import './StatusBar.css';

function StatusBar({ serverStatus, modelInfo, onRefresh }) {
  const getStatusIcon = () => {
    switch (serverStatus) {
      case 'connected':
        return <CheckCircle2 size={14} className="status-icon success" />;
      case 'error':
        return <XCircle size={14} className="status-icon error" />;
      default:
        return <Circle size={14} className="status-icon connecting" />;
    }
  };

  const getStatusText = () => {
    switch (serverStatus) {
      case 'connected':
        return 'Connected';
      case 'error':
        return 'Connection Error';
      default:
        return 'Connecting...';
    }
  };

  return (
    <div className="status-bar">
      <div className="status-section">
        <button
          className="status-button"
          onClick={onRefresh}
          title="Refresh connection"
        >
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </button>
      </div>

      {modelInfo && (
        <>
          <div className="status-section">
            <span className="status-label">Model:</span>
            <span className="status-value">{modelInfo.modelName || modelInfo.modelId}</span>
          </div>
          <div className="status-section">
            <span className="status-label">Mode:</span>
            <span className="status-value">{modelInfo.mode}</span>
          </div>
        </>
      )}

      <div className="status-section right">
        <span className="status-info">
          Copilot Chat Web Client v1.0
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
