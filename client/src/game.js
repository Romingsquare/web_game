import { Application, Container } from 'pixi.js';
import {
  MAP_SIZE, BASE_RADIUS, BASE_SPEED,
  MIN_ZOOM, MAX_ZOOM, FOOD_COUNT,
  NITRO_MULTIPLIER, NITRO_DURATION, NITRO_COOLDOWN, MAX_RADIUS
} from '../../shared/constants.js';
import { createWorldMap } from './renderer/worldMap.js';
import { createCarSprite, resizeCar } from './renderer/carSprite.js';
import { spawnLocalFoods, animateFuelCans, checkFoodCollisions, createFuelCan } from './renderer/fuelCan.js';
import { connectToServer, onMessage, sendJoin, setPlayerStateGetter, isConnected } from './network.js';
import { showDeathScreen, hideDeathScreen } from './ui/screens.js';
import { spawnParticles } from './renderer/particles.js';
import { updateLeaderboard } from './ui/leaderboard.js';
import { updateSizeDisplay, updateMiniMap } from './ui/hud.js';

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
  color:    '#5865f2',
  username: 'Player',
  id:       null,
};

// ── Camera state ──────────────────────────────────────────────────────────────
let cameraX    = 0;
let cameraY    = 0;
let currentZoom = 1;

// ── Mouse world position ──────────────────────────────────────────────────────
const mouse = { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };

// ── Nitro state ───────────────────────────────────────────────────────────────
const nitro = { active: false, endTime: 0, cooldownEnd: 0 };
const speedLinesCanvas = document.getElementById('speed-lines');
const slCtx = speedLinesCanvas?.getContext('2d');

// ── Car sprite reference ──────────────────────────────────────────────────────
let carSprite = null;
let lastRadius = BASE_RADIUS;

// ── Network: server-authoritative state ──────────────────────────────────────
// Map of id → { sprite, serverX, serverY, serverAngle, serverRadius }
const remotePlayers = new Map();
// Map of id → sprite for server-managed food
const serverFoods   = new Map();
let   useServerFood = false; // flips true once first 'state' arrives

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initGame(username = 'Player', color = '#5865f2') {
  localPlayer.username = username;
  localPlayer.color    = color;
  app = new Application();

  await app.init({
    canvas: document.getElementById('gameCanvas'),
    resizeTo: window,
    background: '#0d0d1a',
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  // Scene graph
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

  // World map background
  mapLayer.addChild(createWorldMap());

  // Local player car
  carSprite = createCarSprite(localPlayer.color, localPlayer.username);
  carSprite.x = localPlayer.x;
  carSprite.y = localPlayer.y;
  playerLayer.addChild(carSprite);
  carSprite._color = parseInt(localPlayer.color.replace('#', ''), 16);

  // TASK 7 — spawn fuel cans
  spawnLocalFoods(foodLayer, FOOD_COUNT, MAP_SIZE);

  // Mouse tracking — convert screen coords to world coords
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX - worldContainer.x) / currentZoom;
    mouse.y = (e.clientY - worldContainer.y) / currentZoom;
  });

  // Nitro — spacebar activates boost (skip if death screen is open)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    const overlay = document.getElementById('screen-overlay');
    if (overlay.classList.contains('active')) return; // handled by screens.js
    e.preventDefault();
    activateNitro();
  });

  // Size speed-lines canvas to window
  if (speedLinesCanvas) {
    speedLinesCanvas.width  = window.innerWidth;
    speedLinesCanvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      speedLinesCanvas.width  = window.innerWidth;
      speedLinesCanvas.height = window.innerHeight;
    });
  }

  // Main ticker
  app.ticker.add(gameLoop);

  // Show HUD now that game is running
  document.getElementById('hud').classList.add('visible');

  // Network — connect to server
  connectNetwork();

  console.log(`[game] ready — ${app.screen.width}×${app.screen.height}`);
}

// ── Game loop (runs every frame) ──────────────────────────────────────────────
function gameLoop() {
  movePlayer();
  if (!useServerFood) {
    checkFoodCollisions(foodLayer, localPlayer, MAP_SIZE);
  }
  animateFuelCans(foodLayer);
  interpolateRemotePlayers();
  updateCamera();
  updateCarSprite();
  updateSizeDisplay(localPlayer.radius);
  updateMiniMap(localPlayer, remotePlayers, serverFoods);
  drawSpeedLines();
}

function movePlayer() {
  const dx = mouse.x - localPlayer.x;
  const dy = mouse.y - localPlayer.y;
  const dist = Math.hypot(dx, dy);

  // Always move toward mouse, no stopping
  localPlayer.angle = Math.atan2(dy, dx);

  // Speed scales down as car grows; nitro multiplies it
  const now = Date.now();
  if (nitro.active && now > nitro.endTime) nitro.active = false;
  const boost = nitro.active ? NITRO_MULTIPLIER : 1;
  const speed = (BASE_SPEED / Math.sqrt(localPlayer.radius / BASE_RADIUS)) * boost;

  localPlayer.x += Math.cos(localPlayer.angle) * speed;
  localPlayer.y += Math.sin(localPlayer.angle) * speed;
  localPlayer.x = Math.max(localPlayer.radius, Math.min(MAP_SIZE - localPlayer.radius, localPlayer.x));
  localPlayer.y = Math.max(localPlayer.radius, Math.min(MAP_SIZE - localPlayer.radius, localPlayer.y));

  // Cap radius at MAX_RADIUS
  if (localPlayer.radius > MAX_RADIUS) localPlayer.radius = MAX_RADIUS;
}

function updateCamera() {
  const screen = app.screen;

  // Target zoom: smaller car = zoomed in, bigger car = zoomed out
  const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM,
    BASE_RADIUS / localPlayer.radius
  ));

  // Lerp zoom
  currentZoom += (targetZoom - currentZoom) * 0.05;

  // Target camera position: keep local player centered
  const targetCamX = screen.width  / 2 - localPlayer.x * currentZoom;
  const targetCamY = screen.height / 2 - localPlayer.y * currentZoom;

  // Lerp camera
  cameraX += (targetCamX - cameraX) * 0.08;
  cameraY += (targetCamY - cameraY) * 0.08;

  worldContainer.x     = cameraX;
  worldContainer.y     = cameraY;
  worldContainer.scale.set(currentZoom);
}

function updateCarSprite() {
  carSprite.x = localPlayer.x;
  carSprite.y = localPlayer.y;

  // Rotate car: angle 0 = right, but car faces up by default, so offset by -π/2
  carSprite.rotation = localPlayer.angle + Math.PI / 2;

  // Redraw if radius changed
  if (localPlayer.radius !== lastRadius) {
    resizeCar(carSprite, localPlayer.radius);
    lastRadius = localPlayer.radius;
  }
}

// ── Nitro ─────────────────────────────────────────────────────────────────────

function activateNitro() {
  const now = Date.now();
  if (now < nitro.cooldownEnd) return; // still on cooldown
  nitro.active      = true;
  nitro.endTime     = now + NITRO_DURATION;
  nitro.cooldownEnd = now + NITRO_COOLDOWN;
}

function drawSpeedLines() {
  if (!slCtx) return;
  const w = speedLinesCanvas.width;
  const h = speedLinesCanvas.height;
  slCtx.clearRect(0, 0, w, h);

  // Update nitro bar
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
      nitroBar.style.background = 'rgba(255,255,255,0.3)';
    } else {
      nitroBar.style.width    = '100%';
      nitroBar.style.background = '#5865f2';
    }
  }

  if (!nitro.active) return;

  const progress = 1 - (nitro.endTime - now) / NITRO_DURATION;
  const alpha    = Math.max(0, 0.55 - progress * 0.55);
  if (alpha <= 0) return;

  const cx = w / 2;
  const cy = h / 2;
  const lineCount = 24;

  slCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
  slCtx.lineWidth   = 1.5;

  for (let i = 0; i < lineCount; i++) {
    const angle  = (Math.PI * 2 * i) / lineCount;
    const inner  = 80 + Math.random() * 60;
    const outer  = inner + 60 + Math.random() * 120;
    slCtx.beginPath();
    slCtx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    slCtx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    slCtx.stroke();
  }
}

// ── Network ───────────────────────────────────────────────────────────────────

function connectNetwork() {
  const wsUrl = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:9001`;

  // If already connected from main.js menu screen, just send join
  // Otherwise connect fresh (local dev without menu pre-connect)
  if (isConnected()) {
    sendJoin(localPlayer.username, localPlayer.color);
  } else {
    connectToServer(wsUrl, {
      onOpen() { sendJoin(localPlayer.username, localPlayer.color); },
    });
  }

  // Inject player state getter so network.js can send moves every 50ms
  setPlayerStateGetter(() => localPlayer);

  // Server confirms our join — sync position
  onMessage('welcome', (msg) => {
    localPlayer.x      = msg.x;
    localPlayer.y      = msg.y;
    localPlayer.radius = msg.radius;
    localPlayer.id     = msg.id;
  });

  // Full world state tick
  onMessage('state', (msg) => {
    useServerFood = true;
    reconcileRemotePlayers(msg.players);
    reconcileServerFoods(msg.foods);
  });

  // We were killed
  onMessage('killed', (msg) => {
    spawnParticles(particleLayer, localPlayer.x, localPlayer.y, localPlayer.color);
    showDeathScreen(msg.killerName, () => {
      // Player clicked respawn — server will send respawn message
    });
  });

  // Server respawned us
  onMessage('respawn', (msg) => {
    localPlayer.x      = msg.x;
    localPlayer.y      = msg.y;
    localPlayer.radius = msg.radius;
    hideDeathScreen();
  });

  // Live leaderboard — broadcast every 2s from server
  onMessage('board', (msg) => {
    updateLeaderboard(msg.ranked, msg.total);
  });
}

// ── Remote player reconciliation ──────────────────────────────────────────────

function reconcileRemotePlayers(serverList) {
  const seen = new Set();

  for (const p of serverList) {
    if (p.id === localPlayer.id) continue; // skip self
    seen.add(p.id);

    if (!remotePlayers.has(p.id)) {
      // New player — create sprite
      const sprite = createCarSprite(p.color, p.username);
      playerLayer.addChild(sprite);
      remotePlayers.set(p.id, {
        sprite,
        serverX:      p.x,
        serverY:      p.y,
        serverAngle:  p.angle,
        serverRadius: p.radius,
      });
    } else {
      // Update server target for interpolation
      const entry = remotePlayers.get(p.id);
      entry.serverX      = p.x;
      entry.serverY      = p.y;
      entry.serverAngle  = p.angle;
      entry.serverRadius = p.radius;
    }
  }

  // Remove players no longer in view
  for (const [id, entry] of remotePlayers) {
    if (!seen.has(id)) {
      playerLayer.removeChild(entry.sprite);
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
      serverFoods.delete(id);
    }
  }
}

// ── Remote player interpolation (called each frame) ──────────────────────────

function interpolateRemotePlayers() {
  const LERP = 0.15;
  for (const entry of remotePlayers.values()) {
    const s = entry.sprite;
    s.x        += (entry.serverX     - s.x)        * LERP;
    s.y        += (entry.serverY     - s.y)        * LERP;
    s.rotation  = entry.serverAngle + Math.PI / 2;

    if (Math.round(entry.serverRadius) !== Math.round(entry._lastRadius || 0)) {
      resizeCar(s, entry.serverRadius);
      entry._lastRadius = entry.serverRadius;
    }
  }
}
