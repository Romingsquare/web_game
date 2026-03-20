import { randomBytes } from 'crypto';
import {
  MAP_SIZE, BASE_RADIUS, FOOD_COUNT, FOOD_RADIUS, FOOD_VALUE,
  EAT_RATIO, TICK_RATE, MAX_PLAYERS_PER_ROOM, ROOM_ID_LENGTH, MAX_RADIUS, GROWTH_FACTOR,
} from '../shared/constants.js';
import { saveHighScore } from './supabase.js';
import { removeRoom } from './roomManager.js';

let foodIdCounter = 0;

function randomPos() { return Math.random() * (MAP_SIZE - 200) + 100; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function genId() { return randomBytes(ROOM_ID_LENGTH).toString('base64url').slice(0, ROOM_ID_LENGTH); }
function spawnFood() { return { id: `f${foodIdCounter++}`, x: randomPos(), y: randomPos() }; }
function safeSend(ws, msg) { try { ws.send(msg); } catch { /* gone */ } }

const VIEWPORT_BUFFER = 200;

export class Room {
  constructor() {
    this.id        = genId();
    this.players   = new Map();
    this.foods     = [];
    this.sockets   = new Set();
    this.createdAt = Date.now();

    // Fill foods
    for (let i = 0; i < FOOD_COUNT; i++) this.foods.push(spawnFood());

    this.tickInterval        = setInterval(() => this.tick(), 1000 / TICK_RATE);
    this.leaderboardInterval = setInterval(() => this.broadcastLeaderboard(), 2000);

    console.log(`[room] created ${this.id}`);
  }

  // ── Player management ───────────────────────────────────────────────────────

  addPlayer(ws, playerData) {
    this.players.set(playerData.id, playerData);
    this.sockets.add(ws);
    ws.roomId = this.id;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;

    // Save high score using score, not radius
    const playerScore = p.score || 0;
    saveHighScore(p.username, playerScore).catch(() => {});

    this.players.delete(id);
    this.sockets.delete(p.ws);

    // Notify remaining players
    this.broadcast(JSON.stringify({ t: 'playerLeft', id }));

    if (this.sockets.size === 0) this.destroy();
  }

  isFull()  { return this.players.size >= MAX_PLAYERS_PER_ROOM; }
  isEmpty() { return this.players.size === 0; }

  // ── Broadcast helpers ───────────────────────────────────────────────────────

  broadcast(msgString) {
    for (const ws of this.sockets) safeSend(ws, msgString);
  }

  broadcastExcept(msgString, excludeId) {
    for (const p of this.players.values()) {
      if (p.id !== excludeId) safeSend(p.ws, msgString);
    }
  }

  // ── Game tick ───────────────────────────────────────────────────────────────

  tick() {
    this._checkFoodCollisions();
    this._checkPlayerCollisions();
    this._refillFoods();
    this._broadcastState();
  }

  _checkFoodCollisions() {
    for (const player of this.players.values()) {
      const eatDistSq = (player.radius + FOOD_RADIUS) ** 2;
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const f = this.foods[i];
        const dx = player.x - f.x;
        const dy = player.y - f.y;
        if (dx * dx + dy * dy < eatDistSq) {
          // Increase score
          player.score = (player.score || 0) + FOOD_VALUE;
          // Calculate radius from score (exponential slowdown)
          player.radius = Math.min(MAX_RADIUS, BASE_RADIUS + Math.sqrt(player.score * GROWTH_FACTOR));
          this.foods.splice(i, 1);
        }
      }
    }
  }

  _checkPlayerCollisions() {
    const list = Array.from(this.players.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > a.radius + b.radius) continue;

        let killer, victim;
        if (a.radius >= b.radius * EAT_RATIO)      { killer = a; victim = b; }
        else if (b.radius >= a.radius * EAT_RATIO) { killer = b; victim = a; }
        else continue;

        safeSend(victim.ws, JSON.stringify({
          t: 'killed', killerId: killer.id, killerName: killer.username,
        }));

        // Save high score using score, not radius
        const victimScore = victim.score || 0;
        saveHighScore(victim.username, victimScore).catch(() => {});

        // Respawn victim in place
        victim.x      = randomPos();
        victim.y      = randomPos();
        victim.radius = BASE_RADIUS;
        victim.score  = 0;

        safeSend(victim.ws, JSON.stringify({
          t: 'respawn', x: victim.x, y: victim.y, radius: victim.radius, score: victim.score,
        }));
      }
    }
  }

  _refillFoods() {
    while (this.foods.length < FOOD_COUNT) this.foods.push(spawnFood());
  }

  _broadcastState() {
    for (const player of this.players.values()) {
      const { visPlayers, visFoods } = this._getVisible(player);
      safeSend(player.ws, JSON.stringify({
        t: 'state', players: visPlayers, foods: visFoods,
      }));
    }
  }

  _getVisible(viewer) {
    const halfW = (1920 / 2) / (BASE_RADIUS / viewer.radius) + VIEWPORT_BUFFER;
    const halfH = (1080 / 2) / (BASE_RADIUS / viewer.radius) + VIEWPORT_BUFFER;

    const visPlayers = [];
    for (const p of this.players.values()) {
      if (Math.abs(p.x - viewer.x) < halfW && Math.abs(p.y - viewer.y) < halfH) {
        visPlayers.push({ 
          id: p.id, 
          x: p.x, 
          y: p.y, 
          angle: p.angle,
          radius: p.radius, 
          score: p.score || 0,
          username: p.username, 
          color: p.color 
        });
      }
    }
    const visFoods = this.foods.filter(f =>
      Math.abs(f.x - viewer.x) < halfW && Math.abs(f.y - viewer.y) < halfH
    );
    return { visPlayers, visFoods };
  }

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  broadcastLeaderboard() {
    const ranked = Array.from(this.players.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((p, i) => ({
        id:       p.id,
        username: p.username,
        color:    p.color,
        radius:   Math.floor(p.score || 0), // show score in leaderboard
        rank:     i + 1,
      }));

    const msg = JSON.stringify({ t: 'board', ranked, total: this.players.size });
    this.broadcast(msg);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────

  destroy() {
    clearInterval(this.tickInterval);
    clearInterval(this.leaderboardInterval);
    removeRoom(this.id);
    console.log(`[room] destroyed ${this.id} (empty)`);
  }
}
