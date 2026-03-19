import { TICK_RATE } from '../../shared/constants.js';
import { setMyId } from './ui/leaderboard.js';
import { updateOnlineCount } from './ui/screens.js';

const SEND_INTERVAL = 1000 / TICK_RATE; // 50ms

let socket   = null;
let handlers = {};  // t → callback

/**
 * Connect to the game server.
 * @param {string} url  - ws:// or wss:// URL
 * @param {object} callbacks - { onOpen, onClose, onMessage(msg) }
 */
export function connectToServer(url, callbacks = {}) {
  socket = new WebSocket(url);

  socket.addEventListener('open', () => {
    console.log('[net] connected to', url);
    callbacks.onOpen?.();
    startSendLoop();
  });

  socket.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch { return; }

    // Route to registered handler
    const handler = handlers[msg.t];
    if (handler) handler(msg);

    // Built-in handlers
    if (msg.t === 'welcome') setMyId(msg.id);
    if (msg.t === 'online')  updateOnlineCount(msg.totalPlayers, msg.roomCount);

    // Also call generic onMessage if provided
    callbacks.onMessage?.(msg);
  });

  socket.addEventListener('close', () => {
    console.log('[net] disconnected');
    callbacks.onClose?.();
    stopSendLoop();
  });

  socket.addEventListener('error', (e) => {
    console.error('[net] error', e);
  });
}

/**
 * Register a handler for a specific message type.
 * @param {string} type  - e.g. 'state', 'welcome', 'killed', 'board'
 * @param {function} fn
 */
export function onMessage(type, fn) {
  handlers[type] = fn;
}

/**
 * Send the join message once after connecting.
 */
export function sendJoin(username, color) {
  send({ t: 'join', username, color });
}

// ── Move send loop ────────────────────────────────────────────────────────────

let sendLoopId  = null;
let _getState   = null; // injected by game.js

/**
 * Inject a function that returns the current local player state.
 * Called every SEND_INTERVAL ms to push position to server.
 */
export function setPlayerStateGetter(fn) {
  _getState = fn;
}

function startSendLoop() {
  sendLoopId = setInterval(() => {
    if (!_getState) return;
    const p = _getState();
    send({
      t:      'move',
      x:      p.x,
      y:      p.y,
      angle:  p.angle,
      radius: p.radius,
    });
  }, SEND_INTERVAL);
}

function stopSendLoop() {
  if (sendLoopId) { clearInterval(sendLoopId); sendLoopId = null; }
}

function send(obj) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

export function isConnected() {
  return socket?.readyState === WebSocket.OPEN;
}
