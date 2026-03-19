import {
  players, foods,
  initFoods, spawnFood, refillFoods,
  respawnPlayer, getVisibleState,
} from './gameState.js';
import {
  TICK_RATE, FOOD_RADIUS, FOOD_VALUE, EAT_RATIO, BASE_RADIUS,
} from '../shared/constants.js';
import { saveHighScore } from './supabase.js';

const TICK_MS        = 1000 / TICK_RATE;
const BOARD_INTERVAL = 2000; // ms between leaderboard broadcasts

let tickCount    = 0;
let lastBoardMs  = 0;

export function startGameLoop(uwsApp) {
  initFoods();
  console.log(`[loop] started — ${TICK_RATE} ticks/s`);

  setInterval(() => tick(uwsApp), TICK_MS);
}

function tick(uwsApp) {
  tickCount++;

  checkFoodCollisions();
  checkPlayerCollisions(uwsApp);
  refillFoods();

  broadcastState(uwsApp);

  const now = Date.now();
  if (now - lastBoardMs >= BOARD_INTERVAL) {
    lastBoardMs = now;
    broadcastLeaderboard(uwsApp);
  }
}

// ── Collision: food ───────────────────────────────────────────────────────────

function checkFoodCollisions() {
  for (const player of players.values()) {
    const eatDistSq = (player.radius + FOOD_RADIUS) ** 2;

    for (let i = foods.length - 1; i >= 0; i--) {
      const f  = foods[i];
      const dx = player.x - f.x;
      const dy = player.y - f.y;
      if (dx * dx + dy * dy < eatDistSq) {
        player.radius += FOOD_VALUE;
        foods.splice(i, 1);
      }
    }
  }
}

// ── Collision: player vs player ───────────────────────────────────────────────

function checkPlayerCollisions(uwsApp) {
  const list = Array.from(players.values());

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];

      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > a.radius + b.radius) continue; // no overlap

      // Determine killer and victim
      let killer, victim;
      if (a.radius >= b.radius * EAT_RATIO) {
        killer = a; victim = b;
      } else if (b.radius >= a.radius * EAT_RATIO) {
        killer = b; victim = a;
      } else {
        continue; // too close in size
      }

      // Notify victim
      safeSend(victim.ws, JSON.stringify({
        t:          'killed',
        killerId:   killer.id,
        killerName: killer.username,
      }));

      // Save high score before respawn resets radius
      saveHighScore(victim.username, victim.radius).catch(() => {});

      // Respawn victim
      respawnPlayer(victim.id);

      // Notify victim of new spawn position
      const v = players.get(victim.id);
      if (v) {
        safeSend(v.ws, JSON.stringify({
          t:      'respawn',
          x:      v.x,
          y:      v.y,
          radius: v.radius,
        }));
      }
    }
  }
}

// ── Broadcast: game state ─────────────────────────────────────────────────────

function broadcastState(uwsApp) {
  for (const player of players.values()) {
    const { players: visPlayers, foods: visFoods } = getVisibleState(player);
    safeSend(player.ws, JSON.stringify({
      t:       'state',
      players: visPlayers,
      foods:   visFoods,
    }));
  }
}

// ── Broadcast: leaderboard ────────────────────────────────────────────────────

function broadcastLeaderboard(uwsApp) {
  const top = Array.from(players.values())
    .sort((a, b) => b.radius - a.radius)
    .slice(0, 10)
    .map(p => ({ username: p.username, radius: Math.round(p.radius) }));

  const msg = JSON.stringify({ t: 'board', top });

  for (const player of players.values()) {
    safeSend(player.ws, msg);
  }
}

// ── Util ──────────────────────────────────────────────────────────────────────

function safeSend(ws, msg) {
  try { ws.send(msg); } catch { /* client already gone */ }
}
