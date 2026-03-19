import 'dotenv/config';
import { randomUUID } from 'crypto';
import uWS from 'uWebSockets.js';
import { addPlayer, removePlayer, updatePlayerMove, players } from './gameState.js';
import { startGameLoop } from './gameLoop.js';

const PORT = parseInt(process.env.PORT) || 9001;

const app = uWS.App();

app.ws('/*', {
  maxPayloadLength: 1024,

  open(ws) {
    const id     = randomUUID();
    const player = addPlayer(id, ws);
    ws.playerData = player;

    ws.send(JSON.stringify({
      t:       'welcome',
      id:      player.id,
      x:       player.x,
      y:       player.y,
      radius:  player.radius,
      mapSize: player.mapSize,
    }));

    console.log(`[+] ${id} connected (${players.size} online)`);
  },

  message(ws, rawMsg) {
    let msg;
    try { msg = JSON.parse(Buffer.from(rawMsg)); }
    catch { return; }

    const player = ws.playerData;
    if (!player) return;

    if (msg.t === 'join') {
      player.username = String(msg.username || 'Anonymous').slice(0, 16);
      player.color    = /^#[0-9a-fA-F]{6}$/.test(msg.color) ? msg.color : '#5865f2';
      console.log(`[join] ${player.username}`);
    }

    if (msg.t === 'move') {
      updatePlayerMove(player.id, {
        x:     Number(msg.x)     || player.x,
        y:     Number(msg.y)     || player.y,
        angle: Number(msg.angle) || player.angle,
      });
    }
  },

  close(ws) {
    const player = ws.playerData;
    if (player) {
      removePlayer(player.id);
      console.log(`[-] ${player.id} disconnected (${players.size} online)`);
    }
  },
});

app.get('/health', (res) => {
  res.writeStatus('200 OK').end('OK');
});

app.listen(PORT, (token) => {
  if (token) {
    console.log(`[server] listening on port ${PORT}`);
    startGameLoop(app);
  } else {
    console.error(`[server] failed to bind port ${PORT}`);
    process.exit(1);
  }
});
