import { initGame } from './game.js';
import { getSelectedColor } from './ui/screens.js';
import { connectToServer, onMessage } from './network.js';
import { updateOnlineCount } from './ui/screens.js';

// ── Connect early just to show online count on menu ───────────────────────────
const wsUrl = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:9001`;
connectToServer(wsUrl, {});
onMessage('online', (msg) => updateOnlineCount(msg.totalPlayers, msg.roomCount));

// ── Play button ───────────────────────────────────────────────────────────────
const overlay       = document.getElementById('screen-overlay');
const usernameInput = document.getElementById('username-input');
const playBtn       = document.getElementById('play-btn');

let gameStarted = false;

function startGame() {
  if (gameStarted) return;
  const username = usernameInput.value.trim() || 'Anonymous';
  const color    = getSelectedColor();
  gameStarted = true;
  overlay.classList.remove('active');
  initGame(username, color).catch(console.error);
}

playBtn.addEventListener('click', startGame);
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startGame();
});
