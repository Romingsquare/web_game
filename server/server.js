import 'dotenv/config';
import { randomUUID } from 'crypto';
import uWS from 'uWebSockets.js';
import { MAP_SIZE, BASE_RADIUS } from '../shared/constants.js';
import { getOrCreateRoom, getRoomById, getStats, broadcastAll } from './roomManager.js';

const PORT = parseInt(process.env.PORT) || 9001;

// Sockets that connected but haven't sent 'join' yet
const pendingConnections = new Set();

const app = uWS.App();

app.ws('/*', {
  maxPayloadLength: 1024,

  open(ws) {
    pendingConnections.add(ws);
    // Send current online count so menu screen can show it immediately
    ws.send(JSON.stringify({ t: 'online', ...getStats() }));
  },

  message(ws, rawMsg) {
    let msg;
    try { msg = JSON.parse(Buffer.from(rawMsg)); }
    catch { return; }

    // ── join ──────────────────────────────────────────────────────────────────
    if (msg.t === 'join') {
      const id = randomUUID();
      const username = String(msg.username || 'Anonymous').slice(0, 16);
      const color    = /^#[0-9a-fA-F]{6}$/.test(msg.color) ? msg.color : '#5865f2';
      const requestedRoomId = msg.roomId ? String(msg.roomId).toUpperCase().slice(0, 6) : null;

      const playerData = {
        id, ws, username, color,
        x:        Math.random() * (MAP_SIZE - 200) + 100,
        y:        Math.random() * (MAP_SIZE - 200) + 100,
        angle:    0,
        radius:   BASE_RADIUS,
        score:    0,
        lastMove: Date.now(),
      };

      const room = getOrCreateRoom(requestedRoomId);
      room.addPlayer(ws, playerData);
      ws.playerData = playerData;
      pendingConnections.delete(ws);

      ws.send(JSON.stringify({
        t:       'welcome',
        id:      playerData.id,
        x:       playerData.x,
        y:       playerData.y,
        radius:  playerData.radius,
        score:   playerData.score,
        mapSize: MAP_SIZE,
        roomId:  room.id,
      }));

      // Broadcast updated online count to everyone
      broadcastAll(JSON.stringify({ t: 'online', ...getStats() }));
      // Also send to pending connections (on menu screen)
      const onlineMsg = JSON.stringify({ t: 'online', ...getStats() });
      for (const pws of pendingConnections) {
        try { pws.send(onlineMsg); } catch { /* gone */ }
      }

      console.log(`[join] ${username} → room ${room.id} (${room.players.size} in room)`);
    }

    // ── move ──────────────────────────────────────────────────────────────────
    if (msg.t === 'move') {
      const player = ws.playerData;
      if (!player) return;
      const room = getRoomById(ws.roomId);
      if (!room) return;
      const p = room.players.get(player.id);
      if (!p) return;
      p.x        = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, Number(msg.x) || p.x));
      p.y        = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, Number(msg.y) || p.y));
      p.angle    = Number(msg.angle) || p.angle;
      p.lastMove = Date.now();
    }
  },

  close(ws) {
    if (pendingConnections.has(ws)) {
      pendingConnections.delete(ws);
      return;
    }

    const player = ws.playerData;
    if (!player) return;

    const room = getRoomById(ws.roomId);
    if (room) room.removePlayer(player.id);

    // Broadcast updated count to all remaining players + pending
    const onlineMsg = JSON.stringify({ t: 'online', ...getStats() });
    broadcastAll(onlineMsg);
    for (const pws of pendingConnections) {
      try { pws.send(onlineMsg); } catch { /* gone */ }
    }

    console.log(`[-] ${player.username} left`);
  },
});

app.get('/health', (res) => {
  res.writeStatus('200 OK').end('OK');
});

app.listen(PORT, (token) => {
  if (token) console.log(`[server] listening on port ${PORT}`);
  else { console.error(`[server] failed to bind port ${PORT}`); process.exit(1); }
});
