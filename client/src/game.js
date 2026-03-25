import { Application, Container } from 'pixi.js';
import {
  MAP_SIZE, BASE_RADIUS, BASE_SPEED,
  MIN_ZOOM, MAX_ZOOM,
  NITRO_MULTIPLIER, NITRO_DURATION, NITRO_COOLDOWN,
  GROWTH_PER_FOOD,
} from '../../shared/constants.js';
import { createWorldMap } from './renderer/worldMap.js';
import { createCarSprite, resizeCar } from './renderer/carSprite.js';
import { animateFuelCans, createFuelCan } from './renderer/fuelCan.js';
import { connectToServer, onMessage, sendJoin, sendRespawn, setPlayerStateGetter, isConnected } from './network.js';
import { showDeathScreen, hideDeathScreen } from './ui/screens.js';
import { spawnParticles } from './renderer/particles.js';
import { updateLeaderboard } from './ui/leaderboard.js';
import { updateSizeDisplay, updateMiniMap } from './ui/hud.js';

/** Simple linear radius growth - very gradual */
function scoreToRadius(score) {
  return BASE_RADIUS + (score * GROWTH_PER_FOOD);
}

// ── Exports ───────────────────────────────────────────────────────────────────
export let app;
export let worldContainer;
export let mapLayer;
export let foodLayer;
export let playerLayer;
export let particleLayer;
export let hudLayer;

// ── Local player state ────────────────────────────────────────────────────────
export const localPlayer = {
  x:        MAP_SIZE / 2,
  y:        MAP_SIZE / 2,
  angle:    0,
  radius:   BASE_RADIUS,
  score:    0,
  color:    '#5865f2',
  username: 'Player',
  id:       null,
  dead:     false,
};

// ── Camera state ──────────────────────────────────────────────────────────────
let cameraX     = 0;
let cameraY     = 0;
let currentZoom = 1;

// ── Mouse world position ──────────────────────────────────────────────────────
const mouse = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };

// ── Nitro state ───────────────────────────────────────────────────────────────
const nitro = { active: false, endTime: 0, cooldownEnd: 0 };
const speedLinesCanvas = document.getElementById('speed-lines');
const slCtx = speedLinesCanvas?.getContext('2d');

// ── Car sprite reference ──────────────────────────────────────────────────────
let carSprite  = null;
let lastRadius = BASE_RADIUS;

// ── Server-authoritative remote state ────────────────────────────────────────
// id → { sprite, serverX, serverY, serverAngle, serverRadius, _lastRadius }
const remotePlayers = new Map();
// id → fuel can sprite
const serverFoods   = new Map();

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initGame(username = 'Player', color = '#5865f2', roomCode = null) {
  localPlayer.username = username;
  localPlayer.color    = color;
  localPlayer.dead     = false;

  app = new Application();
  await app.init({
    canvas: document.getElementById('gameCanvas'),
    resizeTo: window,
    background: '#f5f5f5',
    antialias: true,
  });

  // Scene graph layers
  worldContainer = new Container();
  app.stage.addChild(worldContainer);

  mapLayer      = new Container();
  foodLayer     = new Container();
  playerLayer   = new Container();
  particleLayer = new Container();
  worldContainer.addChild(mapLayer);
  worldContainer.addChild(foodLayer);
  worldContainer.addChild(playerLayer);
  worldContainer.addChild(particleLayer);

  hudLayer = new Container();
  app.stage.addChild(hudLayer);

  mapLayer.addChild(createWorldMap());

  carSprite = createCarSprite(localPlayer.color, localPlayer.username);
  carSprite.x = localPlayer.x;
  carSprite.y = localPlayer.y;
  playerLayer.addChild(carSprite);

  // ⚠️ Do NOT spawn local food cans — server sends all food via 'state' messages.
  // Spawning local food caused 500 items visible (250 fake + 250 real).

  // Mouse → world coords
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX - worldContainer.x) / currentZoom;
    mouse.y = (e.clientY - worldContainer.y) / currentZoom;
  });

  // Spacebar = nitro (skip if overlay active)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const overlay = document.getElementById('screen-overlay');
    if (overlay.classList.contains('active')) return;
    e.preventDefault();
    activateNitro();
  });

  if (speedLinesCanvas) {
    const resize = () => {
      speedLinesCanvas.width  = window.innerWidth;
      speedLinesCanvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
  }

  window.addEventListener('resize', () => {
    const c = document.getElementById('gameCanvas');
    c.style.width = '100%';
    c.style.height = '100%';
  });

  app.ticker.add(gameLoop);
  document.getElementById('hud').classList.add('visible');
  connectNetwork(roomCode);
  console.log(`[game] ready — ${app.screen.width}×${app.screen.height}`);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function gameLoop() {
  if (!localPlayer.dead) movePlayer();
  animateFuelCans(foodLayer);
  interpolateRemotePlayers();
  updateCamera();
  updateCarSprite();
  updateSizeDisplay(localPlayer.score);
  updateMiniMap(localPlayer, remotePlayers, serverFoods);
  drawSpeedLines();
}

function movePlayer() {
  const dx = mouse.x - localPlayer.x;
  const dy = mouse.y - localPlayer.y;
  localPlayer.angle = Math.atan2(dy, dx);

  const now = Date.now();
  if (nitro.active && now > nitro.endTime) nitro.active = false;
  
  // Constant speed - only boosted by nitro
  const boost = nitro.active ? NITRO_MULTIPLIER : 1;
  const speed = BASE_SPEED * boost;

  localPlayer.x += Math.cos(localPlayer.angle) * speed;
  localPlayer.y += Math.sin(localPlayer.angle) * speed;
  localPlayer.x = Math.max(localPlayer.radius, Math.min(MAP_SIZE - localPlayer.radius, localPlayer.x));
  localPlayer.y = Math.max(localPlayer.radius, Math.min(MAP_SIZE - localPlayer.radius, localPlayer.y));
}

function updateCamera() {
  const screen = app.screen;
  const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, BASE_RADIUS / localPlayer.radius));
  currentZoom += (targetZoom - currentZoom) * 0.02; // Reduced from 0.05 for slower zoom

  const targetCamX = screen.width  / 2 - localPlayer.x * currentZoom;
  const targetCamY = screen.height / 2 - localPlayer.y * currentZoom;
  cameraX += (targetCamX - cameraX) * 0.08;
  cameraY += (targetCamY - cameraY) * 0.08;

  worldContainer.x = cameraX;
  worldContainer.y = cameraY;
  worldContainer.scale.set(currentZoom);
}

function updateCarSprite() {
  carSprite.x = localPlayer.x;
  carSprite.y = localPlayer.y;
  carSprite.rotation = localPlayer.angle + Math.PI / 2;

  // Only redraw if radius changed by >1px to stop per-frame flicker
  if (Math.abs(localPlayer.radius - lastRadius) > 1.0) {
    resizeCar(carSprite, localPlayer.radius);
    lastRadius = localPlayer.radius;
  }
}

// ── Nitro ─────────────────────────────────────────────────────────────────────
function activateNitro() {
  const now = Date.now();
  if (now < nitro.cooldownEnd) return;
  nitro.active      = true;
  nitro.endTime     = now + NITRO_DURATION;
  nitro.cooldownEnd = now + NITRO_COOLDOWN;
}

function drawSpeedLines() {
  if (!slCtx) return;
  const w = speedLinesCanvas.width;
  const h = speedLinesCanvas.height;
  slCtx.clearRect(0, 0, w, h);

  const now = Date.now();
  const nitroBar = document.getElementById('nitro-bar');
  if (nitroBar) {
    if (nitro.active) {
      const pct = Math.max(0, (nitro.endTime - now) / NITRO_DURATION) * 100;
      nitroBar.style.width    = pct + '%';
      nitroBar.style.background = '#5865f2';
    } else if (now < nitro.cooldownEnd) {
      const pct = Math.max(0, 1 - (nitro.cooldownEnd - now) / NITRO_COOLDOWN) * 100;
      nitroBar.style.width    = pct + '%';
      nitroBar.style.background = 'rgba(88,101,242,0.3)';
    } else {
      nitroBar.style.width    = '100%';
      nitroBar.style.background = '#5865f2';
    }
  }

  if (!nitro.active) return;
  const progress = 1 - (nitro.endTime - now) / NITRO_DURATION;
  const alpha    = Math.max(0, 0.55 - progress * 0.55);
  if (alpha <= 0) return;

  const cx = w / 2, cy = h / 2;
  slCtx.strokeStyle = `rgba(88,101,242,${alpha})`;
  slCtx.lineWidth   = 1.5;
  for (let i = 0; i < 24; i++) {
    const angle = (Math.PI * 2 * i) / 24;
    const inner = 80  + Math.random() * 60;
    const outer = inner + 60 + Math.random() * 120;
    slCtx.beginPath();
    slCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    slCtx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    slCtx.stroke();
  }
}

// ── Network ───────────────────────────────────────────────────────────────────
function connectNetwork(roomCode = null) {
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:9001`;

  if (isConnected()) {
    sendJoin(localPlayer.username, localPlayer.color, roomCode);
  } else {
    connectToServer(wsUrl, {
      onOpen() { sendJoin(localPlayer.username, localPlayer.color, roomCode); },
    });
  }

  setPlayerStateGetter(() => localPlayer);

  onMessage('welcome', (msg) => {
    localPlayer.x      = msg.x;
    localPlayer.y      = msg.y;
    localPlayer.radius = msg.radius;
    localPlayer.score  = msg.score || 0;
    localPlayer.id     = msg.id;
    localPlayer.dead   = false;

    const roomCodeEl = document.getElementById('room-code');
    if (roomCodeEl && msg.roomId) roomCodeEl.textContent = msg.roomId;

    const roomDisplay = document.getElementById('room-code-display');
    if (roomDisplay) roomDisplay.style.display = 'block';
  });

  onMessage('state', (msg) => {
    reconcileRemotePlayers(msg.players);
    reconcileServerFoods(msg.foods);
  });

  onMessage('killed', (msg) => {
    localPlayer.dead = true;
    spawnParticles(particleLayer, localPlayer.x, localPlayer.y, localPlayer.color);
    showDeathScreen(msg.killerName, () => {
      sendRespawn(); // request server to give us a new spawn point
    });
  });

  onMessage('respawn', (msg) => {
    localPlayer.x      = msg.x;
    localPlayer.y      = msg.y;
    localPlayer.radius = msg.radius;
    localPlayer.score  = msg.score || 0;
    localPlayer.dead   = false;
    hideDeathScreen();
    // Snap camera to new position — no lerp stutter on respawn
    cameraX = app.screen.width  / 2 - localPlayer.x;
    cameraY = app.screen.height / 2 - localPlayer.y;
  });

  onMessage('board', (msg) => {
    updateLeaderboard(msg.ranked, msg.total);
  });
}

// ── Remote player reconciliation ──────────────────────────────────────────────
function reconcileRemotePlayers(serverList) {
  const seen = new Set();

  for (const p of serverList) {
    if (p.id === localPlayer.id) {
      // Trust server for score + radius (server is authoritative)
      if (p.score !== undefined) {
        localPlayer.score  = p.score;
        localPlayer.radius = p.radius; // use server-computed log radius
      }
      continue;
    }
    seen.add(p.id);

    if (!remotePlayers.has(p.id)) {
      const sprite = createCarSprite(p.color, p.username);
      playerLayer.addChild(sprite);
      remotePlayers.set(p.id, {
        sprite,
        serverX:      p.x,
        serverY:      p.y,
        serverAngle:  p.angle,
        serverRadius: p.radius,
        _lastRadius:  0,
      });
    } else {
      const entry = remotePlayers.get(p.id);
      entry.serverX      = p.x;
      entry.serverY      = p.y;
      entry.serverAngle  = p.angle;
      entry.serverRadius = p.radius;
    }
  }

  for (const [id, entry] of remotePlayers) {
    if (!seen.has(id)) {
      playerLayer.removeChild(entry.sprite);
      entry.sprite.destroy({ children: true });
      remotePlayers.delete(id);
    }
  }
}

// ── Server food reconciliation ────────────────────────────────────────────────
function reconcileServerFoods(foodList) {
  const seen = new Set();

  for (const f of foodList) {
    seen.add(f.id);
    if (!serverFoods.has(f.id)) {
      const can = createFuelCan(f.x, f.y, f.id);
      foodLayer.addChild(can);
      serverFoods.set(f.id, can);
    }
  }

  for (const [id, can] of serverFoods) {
    if (!seen.has(id)) {
      foodLayer.removeChild(can);
      can.destroy({ children: true });
      serverFoods.delete(id);
    }
  }
}

// ── Remote player interpolation ───────────────────────────────────────────────
function interpolateRemotePlayers() {
  const LERP = 0.15;
  for (const entry of remotePlayers.values()) {
    const s = entry.sprite;
    s.x       += (entry.serverX - s.x) * LERP;
    s.y       += (entry.serverY - s.y) * LERP;
    s.rotation = entry.serverAngle + Math.PI / 2;

    // Redraw only if radius changed >1px to prevent flicker
    if (Math.abs(entry.serverRadius - entry._lastRadius) > 1.0) {
      resizeCar(s, entry.serverRadius);
      entry._lastRadius = entry.serverRadius;
    }
  }
}
