#!/bin/bash

# Copilot Chat Web Client - Quick Start Script

echo "=================================="
echo "Copilot Chat Web Client Installer"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher!"
    echo "Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed!"
    exit 1
fi

echo "✅ npm $(npm -v) detected"
echo ""

# Check if proxy server is running
echo "Checking Proxy Chat Server..."
if curl -s http://localhost:3899/health > /dev/null 2>&1; then
    echo "✅ Proxy Chat Server is running on port 3899"
else
    echo "⚠️  Warning: Proxy Chat Server is not responding on port 3899"
    echo "   Make sure the VS Code extension is running with proxy server enabled"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "To start the development server, run:"
echo "  npm run dev"
echo ""
echo "To build for production, run:"
echo "  npm run build"
echo ""
echo "=================================="
echo "Starting development server..."
echo "=================================="
echo ""

npm run dev
