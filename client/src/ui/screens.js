const overlay       = document.getElementById('screen-overlay');
const welcomeScreen = document.getElementById('welcome-screen');
const deathScreen   = document.getElementById('death-screen');
const deathKiller   = document.getElementById('death-killer');
const respawnBtn    = document.getElementById('respawn-btn');
const swatches      = document.querySelectorAll('.swatch');

// ── Color picker ──────────────────────────────────────────────────────────────
let selectedColor = '#5865f2';

swatches.forEach(btn => {
  btn.addEventListener('click', () => {
    swatches.forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    selectedColor = btn.dataset.color;
  });
});

export function getSelectedColor() {
  return selectedColor;
}

// ── Online count (shown on welcome screen) ────────────────────────────────────
const onlineCountEl = document.getElementById('online-count');

export function updateOnlineCount(totalPlayers, roomCount) {
  if (!onlineCountEl) return;
  const arenaWord = roomCount !== 1 ? 'arenas' : 'arena';
  onlineCountEl.textContent = `Players online: ${totalPlayers} across ${roomCount} ${arenaWord}`;
}

// ── Welcome screen ────────────────────────────────────────────────────────────
export function hideOverlay() {
  overlay.classList.remove('active');
  welcomeScreen.style.display = 'none';
  deathScreen.style.display   = 'none';
}

// ── Death screen ──────────────────────────────────────────────────────────────
let _onRespawn = null;

export function showDeathScreen(killerName, onRespawn) {
  _onRespawn = onRespawn;
  document.getElementById('death-killer').textContent =
    killerName ? `Destroyed by ${killerName}` : '';
  welcomeScreen.style.display = 'none';
  deathScreen.style.display   = 'flex';
  overlay.classList.add('active');
}

export function hideDeathScreen() {
  overlay.classList.remove('active');
  deathScreen.style.display = 'none';
}

respawnBtn.addEventListener('click', triggerRespawn);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' &&
      overlay.classList.contains('active') &&
      deathScreen.style.display !== 'none') {
    e.preventDefault();
    triggerRespawn();
  }
});

function triggerRespawn() {
  hideDeathScreen();
  _onRespawn?.();
}
