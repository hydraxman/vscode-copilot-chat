/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Proxy Chat Server Worker

const { parentPort, workerData } = require('worker_threads');
const http = require('http');

const DEBUG = !!(workerData && workerData.debug);
function log(msg) { if (DEBUG) { console.log(`[ProxyChatWorker] ${msg}`); } }

if (!parentPort) {
	throw new Error('proxyChatServerWorker must have a parentPort');
}

/** @type {Map<string, {res: import('http').ServerResponse, cancelled: boolean, done: boolean}>} */
const active = new Map();

const port = Number(workerData?.port || 3899);
log(`worker init (pid=${process.pid}) targetPort=${port} debug=${DEBUG}`);

function sendToHost(message) {
	parentPort.postMessage(message);
}

function writeSSE(res, event, data) {
	if (DEBUG) { log(`-> SSE event=${event}`); }
	res.write(`event: ${event}\n`);
	res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function endSSE(res) {
	try { res.write('\n'); } catch { /* noop */ }
	try { res.end(); } catch { /* noop */ }
}

parentPort.on('message', msg => {
	switch (msg.type) {
		case 'responseChunk': {
			const entry = active.get(msg.requestId);
			if (!entry) { return; }
			if (DEBUG) { log(`chunk -> client requestId=${msg.requestId} kind=${msg.chunk.kind}`); }
			writeSSE(entry.res, 'chunk', msg.chunk);
			break;
		}
		case 'responseComplete': {
			const entry = active.get(msg.requestId);
			if (!entry) { return; }
			entry.done = true;
			log(`complete -> client requestId=${msg.requestId}`);
			writeSSE(entry.res, 'end', { conversationId: msg.conversationId, metadata: msg.metadata });
			endSSE(entry.res);
			active.delete(msg.requestId);
			break;
		}
		case 'responseError': {
			const entry = active.get(msg.requestId);
			if (!entry) { return; }
			entry.done = true;
			log(`error -> client requestId=${msg.requestId} status=${msg.status}`);
			writeSSE(entry.res, 'error', { status: msg.status, message: msg.message });
			endSSE(entry.res);
			active.delete(msg.requestId);
			break;
		}
		case 'shutdown': {
			log('shutdown message from host');
			for (const { res } of active.values()) {
				writeSSE(res, 'error', { status: 503, message: 'Server shutting down' });
				endSSE(res);
			}
			active.clear();
			process.exit(0);
		}
	}
});

const server = http.createServer((req, res) => {
	if (req.method === 'POST' && (req.url === '/chat' || req.url === '/v1/chat')) {
		log(`incoming chat request url=${req.url}`);
		// 强制按 UTF-8 读取，避免中文被错误按系统本地编码解码
		req.setEncoding('utf8');
		let body = '';
		let bodyBytes = 0;
		req.on('data', chunk => {
			body += chunk;
			bodyBytes += Buffer.byteLength(chunk, 'utf8');
		});
		req.on('end', () => {
			let payload;
			try { payload = JSON.parse(body || '{}'); } catch (e) {
				log('invalid JSON');
				res.statusCode = 400; res.end('Invalid JSON'); return;
			}
			if (!payload || typeof payload.prompt !== 'string') {
				log('missing prompt');
				res.statusCode = 400; res.end('Missing prompt'); return;
			}

			// SSE headers
			res.writeHead(200, {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				'Connection': 'keep-alive',
				'X-Accel-Buffering': 'no'
			});

			const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
			log(`request accepted requestId=${requestId} bodyBytes=${bodyBytes}`);
			active.set(requestId, { res, cancelled: false, done: false });

			// 使用 response 的 close 事件识别真正的“客户端提前断开”，避免把正常的 request end 误判为取消
			res.on('close', () => {
				const entry = active.get(requestId);
				if (!entry) { return; }
				if (entry.done) { return; } // 已完成 / 已出错，不算取消
				active.delete(requestId);
				log(`client aborted connection requestId=${requestId}`);
				sendToHost({ type: 'cancelRequest', requestId });
			});

			// 发送到宿主侧
			sendToHost({ type: 'chatRequest', requestId, payload: { prompt: payload.prompt, conversationId: payload.conversationId, command: payload.command, references: payload.references, toolReferences: payload.toolReferences } });
			writeSSE(res, 'ack', { requestId });
		});
		return;
	}

	if (req.method === 'POST' && req.url === '/shutdown') {
		log('shutdown endpoint called');
		res.writeHead(202); res.end('Shutting down');
		process.nextTick(() => process.exit(0));
		return;
	}

	if (req.method === 'GET' && req.url === '/health') {
		res.writeHead(200, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ status: 'ok' }));
		return;
	}

	res.statusCode = 404; res.end('Not found');
});

server.listen(port, () => {
	log(`listening on port ${port}`);
	parentPort.postMessage({ type: 'serverReady', port });
});
