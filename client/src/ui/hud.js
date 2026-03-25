import { MAP_SIZE } from '../../../shared/constants.js';

const sizeDisplay = document.getElementById('size-display');
const miniMapCanvas = document.getElementById('mini-map');
const mmCtx = miniMapCanvas.getContext('2d');

const MM_W = miniMapCanvas.width;   // 150
const MM_H = miniMapCanvas.height;  // 150
const MM_UPDATE_INTERVAL = 200;     // ms

let _lastMmUpdate = 0;

// ── Size display ──────────────────────────────────────────────────────────────

/** Call every frame with the local player's current score */
export function updateSizeDisplay(score) {
  sizeDisplay.textContent = `Score: ${Math.round(score)}`;
}

// ── Mini-map ──────────────────────────────────────────────────────────────────

/**
 * Redraws the mini-map at most every MM_UPDATE_INTERVAL ms.
 * @param {object} localPlayer  - { x, y, radius, color }
 * @param {Map}    remotePlayers - id → { serverX, serverY, serverRadius }
 * @param {Map}    serverFoods   - id → { x, y } (can sprite, has .x/.y)
 */
export function updateMiniMap(localPlayer, remotePlayers, serverFoods) {
  const now = Date.now();
  if (now - _lastMmUpdate < MM_UPDATE_INTERVAL) return;
  _lastMmUpdate = now;

  // Background
  mmCtx.clearRect(0, 0, MM_W, MM_H);
  mmCtx.fillStyle = 'rgba(0,0,0,0.6)';
  mmCtx.fillRect(0, 0, MM_W, MM_H);

  const scaleX = MM_W / MAP_SIZE;
  const scaleY = MM_H / MAP_SIZE;

  // Food dots — tiny green
  mmCtx.fillStyle = 'rgba(46,204,113,0.6)';
  for (const can of serverFoods.values()) {
    mmCtx.fillRect(can.x * scaleX - 1, can.y * scaleY - 1, 2, 2);
  }

  // Remote players — white dots sized by radius (skip dead players)
  for (const entry of remotePlayers.values()) {
    // Skip if this is a dead player (radius would be at BASE_RADIUS and they shouldn't move)
    if (entry.serverRadius <= BASE_RADIUS && entry.serverX === entry.lastX && entry.serverY === entry.lastY) {
      continue;
    }
    entry.lastX = entry.serverX;
    entry.lastY = entry.serverY;
    
    const r = Math.max(2, entry.serverRadius * scaleX * 0.5);
    mmCtx.beginPath();
    mmCtx.arc(entry.serverX * scaleX, entry.serverY * scaleY, r, 0, Math.PI * 2);
    mmCtx.fillStyle = 'rgba(255,255,255,0.7)';
    mmCtx.fill();
  }

  // Local player — bright accent dot
  const lr = Math.max(3, localPlayer.radius * scaleX * 0.5);
  mmCtx.beginPath();
  mmCtx.arc(localPlayer.x * scaleX, localPlayer.y * scaleY, lr, 0, Math.PI * 2);
  mmCtx.fillStyle = localPlayer.color || '#5865f2';
  mmCtx.fill();

  // Border
  mmCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  mmCtx.lineWidth = 1;
  mmCtx.strokeRect(0, 0, MM_W, MM_H);
}
