import { Container, Graphics, Text, TextStyle, BlurFilter } from 'pixi.js';
import { BASE_RADIUS } from '../../../shared/constants.js';

const WHEEL_COLOR      = 0x222222;
const WINDSHIELD_COLOR = 0xaaddff;

/**
 * Creates a full car container: glow, body, wheels, windshield, username badge.
 * @param {string} color  - hex color string e.g. '#e74c3c'
 * @param {string} username
 * @returns {Container}
 */
export function createCarSprite(color, username) {
  const hexColor = parseInt(color.replace('#', ''), 16);
  const container = new Container();

  // --- Glow layer (blurred copy of body at 50% opacity) ---
  const glow = new Graphics();
  drawBody(glow, hexColor, BASE_RADIUS);
  glow.alpha = 0.45;
  const blurFilter = new BlurFilter();
  blurFilter.blur = 12;
  glow.filters = [blurFilter];
  container.addChild(glow);

  // --- Car body ---
  const body = new Graphics();
  drawBody(body, hexColor, BASE_RADIUS);
  container.addChild(body);

  // --- Wheels (4 corners) ---
  const wheels = new Graphics();
  drawWheels(wheels, BASE_RADIUS);
  container.addChild(wheels);

  // --- Windshield (front) ---
  const windshield = new Graphics();
  drawWindshield(windshield, BASE_RADIUS);
  container.addChild(windshield);

  // --- Username badge ---
  const label = createLabel(username);
  label.y = -(BASE_RADIUS * 2.2);
  container.addChild(label);

  // Store references for resize on grow
  container._glow       = glow;
  container._body       = body;
  container._wheels     = wheels;
  container._windshield = windshield;
  container._label      = label;
  container._color      = hexColor;

  return container;
}

/**
 * Redraws the car at a new radius (called when player grows).
 */
export function resizeCar(container, radius) {
  container._glow.clear();
  drawBody(container._glow, container._color, radius);

  container._body.clear();
  drawBody(container._body, container._color, radius);

  container._wheels.clear();
  drawWheels(container._wheels, radius);

  container._windshield.clear();
  drawWindshield(container._windshield, radius);

  container._label.y = -(radius * 2.2);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function drawBody(g, hexColor, r) {
  // Rounded rectangle: width = r*2, height = r*3 (taller than wide for top-down car)
  const w = r * 2;
  const h = r * 3;
  g.roundRect(-w / 2, -h / 2, w, h, r * 0.4)
   .fill({ color: hexColor });
}

function drawWheels(g, r) {
  const ww = r * 0.45; // wheel width
  const wh = r * 0.7;  // wheel height
  const bx = r * 1.0;  // horizontal offset from center
  const by = r * 0.9;  // vertical offset from center

  g.fill({ color: WHEEL_COLOR });
  // front-left
  g.roundRect(-bx - ww / 2, -by - wh / 2, ww, wh, 2);
  // front-right
  g.roundRect( bx - ww / 2, -by - wh / 2, ww, wh, 2);
  // rear-left
  g.roundRect(-bx - ww / 2,  by - wh / 2, ww, wh, 2);
  // rear-right
  g.roundRect( bx - ww / 2,  by - wh / 2, ww, wh, 2);
  g.fill();
}

function drawWindshield(g, r) {
  const ww = r * 1.1;
  const wh = r * 0.45;
  // Sits near the front (negative y = top of car = front)
  g.roundRect(-ww / 2, -(r * 1.1), ww, wh, 3)
   .fill({ color: WINDSHIELD_COLOR, alpha: 0.75 });
}

function createLabel(username) {
  const style = new TextStyle({
    fontFamily: 'Inter, sans-serif',
    fontSize: 13,
    fontWeight: '600',
    fill: '#ffffff',
    stroke: { color: '#000000', width: 3 },
    dropShadow: false,
  });
  const text = new Text({ text: username, style });
  text.anchor.set(0.5, 1);
  return text;
}
