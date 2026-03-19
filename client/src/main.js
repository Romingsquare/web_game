import { initGame } from './game.js';
import { getSelectedColor } from './ui/screens.js';

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
