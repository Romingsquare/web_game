import { randomBytes } from 'crypto';
import {
  MAP_SIZE, BASE_RADIUS, FOOD_COUNT, FOOD_RADIUS, FOOD_VALUE,
  TICK_RATE, MAX_PLAYERS_PER_ROOM, ROOM_ID_LENGTH,
  GROWTH_PER_FOOD,
} from '../shared/constants.js';
import { saveHighScore } from './supabase.js';
import { removeRoom } from './roomManager.js';

/** Simple linear radius growth - very gradual */
function scoreToRadius(score) {
  return BASE_RADIUS + (score * GROWTH_PER_FOOD);
}



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

    // Create 4 AI Bots
    this.bots = [];
    for (let i = 0; i < 4; i++) {
        const botId = `bot_${genId()}`;
        const color = ['#e74c3c', '#2ecc71', '#f39c12', '#e91e8c'][i];
        const bot = {
            id: botId,
            username: `Bot ${i+1}`,
            color: color,
            x: randomPos(),
            y: randomPos(),
            angle: Math.random() * Math.PI * 2,
            radius: BASE_RADIUS,
            score: 0,
            dead: false,
            isBot: true,
            targetX: randomPos(),
            targetY: randomPos()
        };
        this.players.set(botId, bot);
        this.bots.push(bot);
    }
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
    this._moveBots();
    this._checkFoodCollisions();
    this._checkPlayerCollisions();
    this._refillFoods();
    this._broadcastState();
  }

  _moveBots() {
    const BOT_SPEED = 3.5; // Constant speed for bots
    for (const bot of this.bots) {
        if (bot.dead) continue;
        
        const dx = bot.targetX - bot.x;
        const dy = bot.targetY - bot.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 50) {
            bot.targetX = randomPos();
            bot.targetY = randomPos();
        } else {
            bot.angle = Math.atan2(dy, dx);
            bot.x += Math.cos(bot.angle) * BOT_SPEED;
            bot.y += Math.sin(bot.angle) * BOT_SPEED;
            bot.x = clamp(bot.x, bot.radius, MAP_SIZE - bot.radius);
            bot.y = clamp(bot.y, bot.radius, MAP_SIZE - bot.radius);
        }
    }
  }

  _checkFoodCollisions() {
    for (const player of this.players.values()) {
      if (player.dead) continue; // don't eat food while dead/waiting respawn
      const eatDistSq = (player.radius + FOOD_RADIUS) ** 2;
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const f = this.foods[i];
        const dx = player.x - f.x;
        const dy = player.y - f.y;
        if (dx * dx + dy * dy < eatDistSq) {
          player.score = (player.score || 0) + FOOD_VALUE;
          player.radius = scoreToRadius(player.score);
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
        if (a.dead || b.dead) continue; // dead players can't collide
        
        // Calculate distance between centers
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        
        // Check if circles are touching (distance < sum of radii)
        const touching = dist < (a.radius + b.radius);
        if (!touching) continue;
        
        // Determine who eats who based on size
        let killer, victim;
        if (a.radius > b.radius) {
          killer = a;
          victim = b;
        } else if (b.radius > a.radius) {
          killer = b;
          victim = a;
        } else {
          continue; // Same size, no one eats anyone
        }

        // Save high score before resetting (only for real players, not bots)
        if (!victim.isBot) {
          saveHighScore(victim.username, victim.score || 0).catch(() => {});
        }

        // Killer absorbs the victim's mass/score
        killer.score = (killer.score || 0) + (victim.score || 0) + 10;
        killer.radius = scoreToRadius(killer.score);

        // Mark victim dead — frozen until they send {t:'respawn'} or auto-respawn for bots
        victim.dead   = true;
        victim.score  = 0;
        victim.radius = BASE_RADIUS;

        // Only send killed message to real players
        if (!victim.isBot && victim.ws) {
          safeSend(victim.ws, JSON.stringify({
            t: 'killed', killerId: killer.id, killerName: killer.username,
          }));
        }
      }
    }
  }

  /** Called when a client sends {t: 'respawn'}. */
  respawnPlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.dead   = false;
    p.x      = randomPos();
    p.y      = randomPos();
    p.radius = BASE_RADIUS;
    p.score  = 0;
    safeSend(p.ws, JSON.stringify({
      t: 'respawn', x: p.x, y: p.y, radius: p.radius, score: p.score,
    }));
  }

  _refillFoods() {
    while (this.foods.length < FOOD_COUNT) this.foods.push(spawnFood());
  }

  _respawnBots() {
    for (const bot of this.bots) {
        if (bot.dead && !bot.respawnTimer) {
            bot.respawnTimer = setTimeout(() => {
                bot.dead = false;
                bot.x = randomPos();
                bot.y = randomPos();
                bot.radius = BASE_RADIUS;
                bot.score = 0;
                bot.targetX = randomPos();
                bot.targetY = randomPos();
                delete bot.respawnTimer; // Clean up timer reference
            }, 3000); // 3 seconds respawn time
        }
    }
  }

  _broadcastState() {
    this._respawnBots();
    for (const player of this.players.values()) {
      if (player.dead || player.isBot) continue; // don't send state to dead players or bots
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
    
    // Clear all bot respawn timers
    for (const bot of this.bots) {
      if (bot.respawnTimer) {
        clearTimeout(bot.respawnTimer);
        delete bot.respawnTimer;
      }
    }
    
    removeRoom(this.id);
    console.log(`[room] destroyed ${this.id} (empty)`);
  }
}
