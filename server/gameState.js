import { MAP_SIZE, BASE_RADIUS, FOOD_COUNT, FOOD_RADIUS } from '../shared/constants.js';

// ── In-memory state ───────────────────────────────────────────────────────────
export const players = new Map();  // id → playerObject
export const foods   = [];         // { id, x, y }

let foodIdCounter = 0;

// ── Player helpers ────────────────────────────────────────────────────────────

export function addPlayer(id, ws) {
  const player = {
    id,
    ws,
    username:  'Anonymous',
    color:     '#5865f2',
    x:         randomPos(),
    y:         randomPos(),
    angle:     0,
    radius:    BASE_RADIUS,
    mapSize:   MAP_SIZE,
    lastMove:  Date.now(),
  };
  players.set(id, player);
  return player;
}

export function removePlayer(id) {
  players.delete(id);
}

export function updatePlayerMove(id, { x, y, angle }) {
  const p = players.get(id);
  if (!p) return;
  // Server trusts client position for now (authoritative collision handled in gameLoop)
  p.x        = clamp(x, p.radius, MAP_SIZE - p.radius);
  p.y        = clamp(y, p.radius, MAP_SIZE - p.radius);
  p.angle    = angle;
  p.lastMove = Date.now();
}

export function respawnPlayer(id) {
  const p = players.get(id);
  if (!p) return;
  p.x      = randomPos();
  p.y      = randomPos();
  p.radius = BASE_RADIUS;
}

// ── Food helpers ──────────────────────────────────────────────────────────────

export function initFoods() {
  foods.length = 0;
  for (let i = 0; i < FOOD_COUNT; i++) {
    foods.push(spawnFood());
  }
}

export function spawnFood() {
  return {
    id: `f${foodIdCounter++}`,
    x:  randomPos(),
    y:  randomPos(),
  };
}

export function refillFoods() {
  while (foods.length < FOOD_COUNT) {
    foods.push(spawnFood());
  }
}

// ── Viewport culling ──────────────────────────────────────────────────────────
const VIEWPORT_BUFFER = 200;

/**
 * Returns players and foods visible to a given player (viewport + buffer).
 * Assumes a rough screen size of 1920×1080 at zoom 1.
 */
export function getVisibleState(viewer) {
  const halfW = (1920 / 2) / (BASE_RADIUS / viewer.radius) + VIEWPORT_BUFFER;
  const halfH = (1080 / 2) / (BASE_RADIUS / viewer.radius) + VIEWPORT_BUFFER;

  const visPlayers = [];
  for (const p of players.values()) {
    if (Math.abs(p.x - viewer.x) < halfW && Math.abs(p.y - viewer.y) < halfH) {
      visPlayers.push({
        id:       p.id,
        x:        p.x,
        y:        p.y,
        angle:    p.angle,
        radius:   p.radius,
        username: p.username,
        color:    p.color,
      });
    }
  }

  const visFoods = foods.filter(f =>
    Math.abs(f.x - viewer.x) < halfW && Math.abs(f.y - viewer.y) < halfH
  );

  return { players: visPlayers, foods: visFoods };
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function randomPos() {
  return Math.random() * (MAP_SIZE - 200) + 100;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
