#!/usr/bin/env node
// source: https://github.com/yjs/y-websocket-server/blob/main/src/server.js
import http from 'http';
import { Server } from 'ws';

import { setupWSConnection } from './utils.js';

const wss = new Server({ noServer: true });
const host = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '1234');

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('okay');
});

wss.on('connection', setupWSConnection);

server.on('upgrade', (request, socket, head) => {
  console.log('upgrade');
  // You may check auth of request here..
  // Call `wss.HandleUpgrade` *after* you checked whether the client has access
  // (e.g. by checking cookies, or url parameters).
  // See https://github.com/websockets/ws#client-authentication
  wss.handleUpgrade(
    request,
    socket,
    head,
    /** @param {any} ws */ (ws) => {
      wss.emit('connection', ws, request);
    },
  );
});

server.listen(port, host, () => {
  console.log(`running at '${host}' on port ${port}`);
});
