# Copilot Chat Web Client - Quick Start Script for Windows

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Copilot Chat Web Client Installer" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check Node.js version
$versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
if ($versionNumber -lt 18) {
    Write-Host "❌ Node.js version must be 18 or higher!" -ForegroundColor Red
    Write-Host "Current version: $nodeVersion" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "✅ npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Check if proxy server is running
Write-Host "Checking Proxy Chat Server..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3899/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ Proxy Chat Server is running on port 3899" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Warning: Proxy Chat Server is not responding on port 3899" -ForegroundColor Yellow
    Write-Host "   Make sure the VS Code extension is running with proxy server enabled" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 1
    }
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the development server, run:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "To build for production, run:" -ForegroundColor Cyan
Write-Host "  npm run build" -ForegroundColor White
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Starting development server..." -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

npm run dev
