# Proxy Chat Server API Documentation

The Proxy Chat Server exposes HTTP APIs for external clients to interact with GitHub Copilot Chat functionality.

## Base Configuration

**Default Port**: `3899` (configurable via `COPILOT_CHAT_PROXY_PORT` environment variable)

**Base URL**: `http://localhost:3899`

---

## API Endpoints

### 1. Chat Request (Streaming)

**Endpoint**: `POST /chat` or `POST /v1/chat`

**Description**: Send a chat prompt to Copilot and receive streaming responses via Server-Sent Events (SSE).

**Request Body**:
```json
{
  "prompt": "Explain how async/await works",
  "conversationId": "optional-conversation-id",
  "command": "optional-slash-command",
  "references": [],
  "toolReferences": []
}
```

**Response**: Server-Sent Events (SSE) stream
- `event: ack` - Request acknowledged
- `event: chunk` - Content chunk with various types (markdown, progress, tool, etc.)
- `event: end` - Request completed successfully
- `event: error` - Request failed

**Example**:
```bash
curl -X POST http://localhost:3899/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is TypeScript?"}' \
  --no-buffer
```

---

### 2. Get Workspace Structure

**Endpoint**: `GET /api/workspace/structure`

**Description**: Retrieves the file and directory structure of all workspace folders.

**Response**:
```json
{
  "workspaceFolders": [
    {
      "name": "my-project",
      "path": "/path/to/workspace",
      "tree": [
        {
          "name": "src",
          "path": "src",
          "type": "directory",
          "children": [
            {
              "name": "index.ts",
              "path": "src/index.ts",
              "type": "file"
            }
          ]
        }
      ]
    }
  ]
}
```

**Notes**:
- Hidden files (starting with `.`) are excluded
- Common directories (`node_modules`, `__pycache__`, `dist`, `build`) are excluded
- Maximum depth: 5 levels

**Example**:
```bash
curl http://localhost:3899/api/workspace/structure
```

---

### 3. Get File Content

**Endpoint**: `GET /api/workspace/file?path={relativePath}`

**Description**: Retrieves the content of a specific file from the workspace.

**Parameters**:
- `path` (query parameter, required): Relative path to the file within the workspace

**Response**: Plain text file content (UTF-8 encoded)

**Example**:
```bash
curl "http://localhost:3899/api/workspace/file?path=src/index.ts"
```

**Error Response** (404):
```json
{
  "error": "File not found: src/nonexistent.ts"
}
```

---

### 4. Get Active Files

**Endpoint**: `GET /api/workspace/active-files`

**Description**: Returns a list of currently open files in the editor.

**Response**:
```json
{
  "files": [
    "src/index.ts",
    "src/utils/helper.ts",
    "README.md"
  ]
}
```

**Example**:
```bash
curl http://localhost:3899/api/workspace/active-files
```

---

### 5. Accept Edit

**Endpoint**: `POST /api/edit/accept`

**Description**: Accept a specific edit proposed by Copilot.

**Request Body**:
```json
{
  "editId": "edit-12345"
}
```

**Response**:
```json
{
  "success": false,
  "message": "Edit tracking not yet implemented. Edits are auto-applied in responses."
}
```

**Note**: This feature is currently a placeholder. Edits from chat responses are automatically applied. Future implementation will track pending edits for manual acceptance.

**Example**:
```bash
curl -X POST http://localhost:3899/api/edit/accept \
  -H "Content-Type: application/json" \
  -d '{"editId": "edit-12345"}'
```

---

### 6. Decline Edit

**Endpoint**: `POST /api/edit/decline`

**Description**: Decline a specific edit proposed by Copilot.

**Request Body**:
```json
{
  "editId": "edit-12345"
}
```

**Response**:
```json
{
  "success": false,
  "message": "Edit tracking not yet implemented. Edits are auto-applied in responses."
}
```

**Note**: This feature is currently a placeholder. Future implementation will track pending edits for manual rejection/revert.

**Example**:
```bash
curl -X POST http://localhost:3899/api/edit/decline \
  -H "Content-Type: application/json" \
  -d '{"editId": "edit-12345"}'
```

---

### 7. Get Model Info

**Endpoint**: `GET /api/model/info`

**Description**: Retrieves information about the currently active AI model and chat mode.

**Response**:
```json
{
  "modelId": "gpt-4.1-mini",
  "modelName": "GPT-4.1 Mini",
  "mode": "ask"
}
```

**Fields**:
- `modelId`: The internal identifier for the model (e.g., `gpt-4.1`, `gpt-5`, `copilot-base`)
- `modelName`: Human-readable name of the model
- `mode`: Current chat mode - one of:
  - `"ask"` - Standard Q&A mode (Panel chat)
  - `"edit"` - Edit mode (inline code modifications)
  - `"agent"` - Agent mode (autonomous multi-step tasks)

**Note**: Currently, the proxy server only supports `"ask"` mode. Edit and Agent modes require different request handling mechanisms.

**Example**:
```bash
curl http://localhost:3899/api/model/info
```

---

### 8. Health Check

**Endpoint**: `GET /health`

**Description**: Simple health check to verify the server is running.

**Response**:
```json
{
  "status": "ok"
}
```

**Example**:
```bash
curl http://localhost:3899/health
```

---

### 9. Shutdown

**Endpoint**: `POST /shutdown`

**Description**: Gracefully shut down the proxy server.

**Response**: HTTP 202 Accepted

**Example**:
```bash
curl -X POST http://localhost:3899/shutdown
```

---

## Configuration

### Environment Variables

- `COPILOT_CHAT_PROXY_PORT`: Port number (default: `3899`)
- `COPILOT_CHAT_PROXY_MODEL`: Explicit model to use (e.g., `gpt-4.1-mini`)
- `COPILOT_CHAT_PROXY_PREFERRED_MODELS`: Comma-separated list of preferred models to try in order

**Example**:
```bash
export COPILOT_CHAT_PROXY_PORT=4000
export COPILOT_CHAT_PROXY_MODEL=gpt-5
```

---

## Error Handling

All API endpoints may return error responses:

**Generic Error Response**:
```json
{
  "error": "Error message description"
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (invalid JSON, missing parameters)
- `404` - Not Found (file not found, endpoint not found)
- `500` - Internal Server Error
- `503` - Service Unavailable (server shutting down)

---

## Logging

The proxy server logs all operations to:
1. **VS Code Output Channel**: "Proxy Chat Server"
   - Open with: `Ctrl+Shift+U` → Select "Proxy Chat Server"
2. **Console**: When debug mode is enabled (worker level logging)

**Log Levels**:
- `[info]` - Normal operations
- `[debug]` - Verbose request/response tracking
- `[warn]` - Non-critical issues
- `[error]` - Failures and exceptions

---

## Implementation Notes

### Workspace Structure
- The workspace structure API recursively scans directories up to 5 levels deep
- Excludes hidden files and common ignore patterns
- Uses VS Code's FileSystem API for cross-platform compatibility

### File Content
- Files are read as UTF-8 text
- Searches all workspace folders for the requested file
- Returns 404 if file is not found in any workspace folder

### Active Files
- Returns files currently open in the editor
- Filters for `file://` and `vscode-userdata://` schemes
- Paths are relative to workspace root

### Edit Tracking (Placeholder)
- Accept/Decline APIs are currently placeholders
- Edits from chat responses are automatically applied
- Future implementation will require:
  - Tracking edits with unique IDs
  - Storing WorkspaceEdit objects
  - Manual apply/revert mechanisms

### Model & Mode
- Model information is resolved at server startup
- Uses model preference order: `gpt-5` → `gpt-5-mini` → `gpt-4.1-mini` → `gpt-4.1` → `copilot-base`
- Mode is currently hardcoded to `"ask"` (Panel chat)
- Future: Support for `"edit"` and `"agent"` modes

---

## Usage Examples

### Python Client Example

```python
import requests
import json

# Get model info
response = requests.get('http://localhost:3899/api/model/info')
model_info = response.json()
print(f"Using model: {model_info['modelName']} in {model_info['mode']} mode")

# Get workspace structure
response = requests.get('http://localhost:3899/api/workspace/structure')
workspace = response.json()
print(f"Workspace folders: {len(workspace['workspaceFolders'])}")

# Get active files
response = requests.get('http://localhost:3899/api/workspace/active-files')
active_files = response.json()
print(f"Active files: {', '.join(active_files['files'])}")

# Read a file
response = requests.get('http://localhost:3899/api/workspace/file?path=src/index.ts')
content = response.text
print(f"File content length: {len(content)} bytes")

# Send chat request (streaming)
response = requests.post(
    'http://localhost:3899/chat',
    json={'prompt': 'Explain this code'},
    stream=True
)

for line in response.iter_lines():
    if line:
        line_str = line.decode('utf-8')
        if line_str.startswith('data: '):
            data = json.loads(line_str[6:])
            print(data)
```

### JavaScript/Node.js Client Example

```javascript
const axios = require('axios');

const BASE_URL = 'http://localhost:3899';

// Get model info
async function getModelInfo() {
  const response = await axios.get(`${BASE_URL}/api/model/info`);
  console.log('Model:', response.data.modelName, 'Mode:', response.data.mode);
}

// Get workspace structure
async function getWorkspaceStructure() {
  const response = await axios.get(`${BASE_URL}/api/workspace/structure`);
  console.log('Workspace folders:', response.data.workspaceFolders.length);
  return response.data;
}

// Get file content
async function getFileContent(filePath) {
  const response = await axios.get(`${BASE_URL}/api/workspace/file`, {
    params: { path: filePath }
  });
  return response.data;
}

// Send chat request
async function sendChatRequest(prompt) {
  const response = await axios.post(`${BASE_URL}/chat`, {
    prompt: prompt
  }, {
    responseType: 'stream'
  });

  response.data.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log('Received:', data);
      }
    }
  });
}

// Run examples
(async () => {
  await getModelInfo();
  await getWorkspaceStructure();
  const content = await getFileContent('src/index.ts');
  console.log('File content:', content.substring(0, 100) + '...');
  await sendChatRequest('What does this code do?');
})();
```

---

## Future Enhancements

### Planned Features
1. **Edit Tracking System**
   - Track all edits proposed by Copilot
   - Allow manual acceptance/rejection
   - Support for edit preview and diff view
   - Batch accept/decline operations

2. **Mode Support**
   - Support for Edit mode (inline modifications)
   - Support for Agent mode (autonomous tasks)
   - Mode switching via API

3. **Enhanced Context**
   - Include file metadata (size, last modified)
   - Support for file filtering patterns
   - Workspace search/grep capabilities

4. **Authentication**
   - Optional API key authentication
   - Rate limiting
   - Request quota management

5. **WebSocket Support**
   - Bidirectional communication
   - Real-time workspace change notifications
   - Progress updates for long-running operations
