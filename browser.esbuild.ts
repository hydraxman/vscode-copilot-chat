/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.join(__dirname);
const isWatch = process.argv.includes('--watch');
const isDev = process.argv.includes('--dev');

const browserChatAppBuildOptions = {
	bundle: true,
	logLevel: 'info',
	minify: !isDev,
	outdir: './dist/browser',
	sourcemap: isDev ? 'linked' : false,
	sourcesContent: false,
	treeShaking: true,
	platform: 'browser',
	format: 'esm',
	target: 'es2022',
	jsx: 'transform',
	jsxFactory: 'React.createElement',
	jsxFragment: 'React.Fragment',
	entryPoints: [
		{ in: './src/browser-app/common/main.tsx', out: 'chat-app' }
	],
	external: [],
	define: {
		'process.env.NODE_ENV': isDev ? '"development"' : '"production"',
		'global': 'globalThis',
	},
	loader: {
		'.wasm': 'file',
		'.tiktoken': 'file',
		'.svg': 'text',
		'.png': 'file',
		'.css': 'text',
	},
	alias: {
		// 将VS Code API重定向到我们的shim
		'vscode': './src/browser-app/common/vscode-shim.ts',
		// React从全局变量获取
		'react': 'data:text/javascript,export default window.React; export const useState = window.React.useState; export const useEffect = window.React.useEffect; export const useCallback = window.React.useCallback; export const useRef = window.React.useRef; export const useMemo = window.React.useMemo; export const createElement = window.React.createElement; export const Fragment = window.React.Fragment;',
		'react-dom': 'data:text/javascript,export default window.ReactDOM; export const render = window.ReactDOM.render; export const unmountComponentAtNode = window.ReactDOM.unmountComponentAtNode;',
		// 其他Node.js模块的浏览器替代
		'fs': './src/browser-app/common/shims/fs-shim.ts',
		'path': './src/browser-app/common/shims/path-shim.ts',
		'os': './src/browser-app/common/shims/os-shim.ts',
		'crypto': './src/browser-app/common/shims/crypto-shim.ts',
	},
	plugins: [
		{
			name: 'css-injector',
			setup(build) {
				build.onLoad({ filter: /\.css$/ }, async (args) => {
					const css = await fs.promises.readFile(args.path, 'utf8');
					const contents = `
						const style = document.createElement('style');
						style.textContent = ${JSON.stringify(css)};
						document.head.appendChild(style);
					`;
					return { contents, loader: 'js' };
				});
			}
		},
		{
			name: 'html-generator',
			setup(build) {
				build.onEnd(() => {
					// 生成HTML文件
					const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GitHub Copilot Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            height: 100vh;
            overflow: hidden;
            background-color: #1e1e1e;
            color: #cccccc;
        }

        #root {
            height: 100vh;
            width: 100vw;
        }

        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-size: 18px;
        }
    </style>
</head>
<body>
    <div id="root">
        <div class="loading">Loading GitHub Copilot Chat...</div>
    </div>

    <!-- React CDN Links -->
    <script crossorigin src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>

    <script type="module">
        // 为模块提供React全局变量
        window.React = window.React;
        window.ReactDOM = window.ReactDOM;

        // 提供vscpp作为React.createElement的别名 (VS Code内部使用)
        window.vscpp = window.React.createElement;
        window.vscppf = window.React.Fragment;

        // 动态导入主模块
        import('./chat-app.js').then(module => {
            // 模块加载完成
        }).catch(error => {
            console.error('Failed to load chat app:', error);
            document.getElementById('root').innerHTML = '<div class="loading">Failed to load app. Please refresh.</div>';
        });
    </script>
</body>
</html>`;

					fs.writeFileSync(path.join(REPO_ROOT, 'dist/browser/index.html'), htmlContent);
					console.log('Generated index.html');
				});
			}
		}
	]
} satisfies esbuild.BuildOptions;

async function copyAssets() {
	// 复制必要的资源文件
	const assetsDir = path.join(REPO_ROOT, 'dist/browser/assets');
	if (!fs.existsSync(assetsDir)) {
		fs.mkdirSync(assetsDir, { recursive: true });
	}

	// 复制WASM文件
	const wasmFiles = fs.readdirSync(path.join(REPO_ROOT, 'dist'))
		.filter(file => file.endsWith('.wasm') || file.endsWith('.tiktoken'));

	for (const file of wasmFiles) {
		const src = path.join(REPO_ROOT, 'dist', file);
		const dest = path.join(assetsDir, file);
		if (fs.existsSync(src)) {
			fs.copyFileSync(src, dest);
			console.log(`Copied ${file} to browser assets`);
		}
	}
}

async function main() {
	console.log('Building browser chat app...');

	if (isWatch) {
		const context = await esbuild.context(browserChatAppBuildOptions);
		await context.watch();
		console.log('Watching for changes...');
	} else {
		await esbuild.build(browserChatAppBuildOptions);
		await copyAssets();
		console.log('Build complete!');
		console.log('To serve the app: npx http-server dist/browser -p 8080');
	}
}

main().catch(console.error);
