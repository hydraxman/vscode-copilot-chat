import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			// Proxy API requests to the Copilot Chat Server
			'/api': {
				target: 'http://localhost:3899',
				changeOrigin: true,
			},
			'/chat': {
				target: 'http://localhost:3899',
				changeOrigin: true,
			},
			'/health': {
				target: 'http://localhost:3899',
				changeOrigin: true,
			}
		}
	},
	build: {
		outDir: 'dist',
		sourcemap: true,
	}
});
