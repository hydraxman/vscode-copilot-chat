# Copilot Chat Web Client

A standalone web client for GitHub Copilot Chat, enabling remote "vibe coding" through a browser interface.

## Features

- 💬 **Real-time Chat**: Stream responses from Copilot using Server-Sent Events (SSE)
- 📁 **Workspace Explorer**: Browse files and folders from your VS Code workspace
- 👁️ **File Viewer**: View file contents directly in the browser
- 📋 **Active Files**: See currently open files in VS Code
- 🎨 **VS Code Theme**: Familiar VS Code Dark+ theme
- 🔄 **Live Updates**: Real-time synchronization with VS Code workspace

## Prerequisites

1. **Proxy Chat Server Running**: The VS Code extension must be running with the proxy server enabled on port 3899
2. **Node.js**: Version 18 or higher
3. **npm**: Comes with Node.js

## Installation

```bash
cd copilot-chat-client
npm install
```

## Development

Start the development server with Vite:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

The dev server is configured to proxy API requests to `http://localhost:3899` (the Proxy Chat Server).

## Building for Production

```bash
npm run build
```

This will create an optimized production build in the `dist/` directory.

To preview the production build:

```bash
npm run preview
```

## Configuration

### Environment Variables

Create a `.env` file to customize the configuration:

```env
# Base URL for the Proxy Chat Server API
VITE_API_BASE=http://localhost:3899
```

### Proxy Chat Server

The client expects the Proxy Chat Server to be running on `localhost:3899`. To start the server:

1. Open VS Code with the Copilot Chat extension
2. The proxy server should start automatically if configured
3. Or set the environment variable: `COPILOT_CHAT_PROXY_PORT=3899`

## Project Structure

```
copilot-chat-client/
├── index.html              # HTML entry point
├── package.json            # Dependencies and scripts
├── vite.config.js          # Vite configuration
├── src/
│   ├── main.jsx           # React entry point
│   ├── App.jsx            # Root component
│   ├── App.css            # App styles
│   ├── index.css          # Global styles
│   ├── components/        # React components
│   │   ├── ChatInterface.jsx    # Main chat UI
│   │   ├── ChatMessage.jsx      # Message display
│   │   ├── Sidebar.jsx          # Workspace explorer
│   │   └── StatusBar.jsx        # Status bar
│   └── services/          # API services
│       └── apiService.js        # Proxy server API client
└── dist/                  # Production build output
```

## API Integration

The client communicates with the following Proxy Chat Server endpoints:

- `GET /health` - Server health check
- `POST /chat` - Send chat messages (SSE streaming)
- `GET /api/model/info` - Get current AI model information
- `GET /api/workspace/structure` - Get workspace file tree
- `GET /api/workspace/file?path=<path>` - Get file content
- `GET /api/workspace/active-files` - Get currently open files
- `POST /api/edit/accept` - Accept suggested edits (placeholder)
- `POST /api/edit/decline` - Decline suggested edits (placeholder)

See the [Proxy Server API Documentation](../docs/proxy-server-api.md) for details.

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **React Markdown** - Markdown rendering with code highlighting
- **Server-Sent Events (SSE)** - Real-time streaming

## Usage

1. **Start Proxy Server**: Ensure the VS Code extension with proxy server is running
2. **Launch Client**: Run `npm run dev`
3. **Open Browser**: Navigate to `http://localhost:5173`
4. **Start Chatting**: Ask Copilot questions about your code!

### Example Prompts

- "Explain how async/await works in JavaScript"
- "What files are currently open?"
- "Show me the workspace structure"
- "Help me refactor this function"
- "Find bugs in my code"

## Troubleshooting

### Connection Issues

If you see "Connection Error" in the status bar:

1. Check that the Proxy Chat Server is running on port 3899
2. Verify the server is accessible: `curl http://localhost:3899/health`
3. Check browser console for error messages
4. Ensure no firewall is blocking the connection

### CORS Issues

The development server is configured to proxy requests to avoid CORS issues. If you encounter CORS errors:

1. Ensure you're accessing the client via `localhost:5173`, not a different host
2. Check the `vite.config.js` proxy configuration
3. Verify the Proxy Chat Server allows requests from your client origin

### Build Errors

If you encounter build errors:

1. Delete `node_modules/` and run `npm install` again
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Check Node.js version: `node --version` (should be 18+)

## Contributing

This client is part of the vscode-copilot-chat extension project. Follow the main project's contribution guidelines.

## License

See the LICENSE.txt file in the project root.
