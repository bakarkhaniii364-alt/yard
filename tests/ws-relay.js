// DEPRECATED: Local WebSocket relay used for test workflows.
//
// Cloud deployments (Cloudflare Pages) cannot run arbitrary Node.js servers.
// The app now uses Supabase Realtime for signaling and state synchronization.
// This file is retained only for local test/debugging; it is deprecated.

import { WebSocketServer } from 'ws';

console.warn('[RELAY] tests/ws-relay.js is deprecated; prefer Supabase Realtime for signaling.');

const wss = new WebSocketServer({ port: 8080 });
const stateCache = {};

wss.on('connection', (ws) => {
  console.log('[RELAY] New client connected (deprecated relay)');
  Object.values(stateCache).forEach((cachedMsg) => ws.send(JSON.stringify(cachedMsg)));
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'state_update') {
        stateCache[`${message.roomId}_${message.key}`] = message;
      }
      // Broadcast to others
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) client.send(JSON.stringify(message));
      });
    } catch (e) { console.error('[RELAY] Error parsing message:', e); }
  });
});
