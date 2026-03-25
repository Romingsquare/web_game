import { Container, Graphics } from 'pixi.js';
import { FOOD_RADIUS } from '../../../shared/constants.js';

const FOOD_COLORS = [
  0xff6b6b, // red
  0x4ecdc4, // cyan
  0xffe66d, // yellow
  0x95e1d3, // mint
  0xf38181, // pink
  0xaa96da, // purple
  0xfcbad3, // light pink
  0xa8e6cf, // light green
];

const PULSE_SPEED  = 0.003; // radians per ms

/**
 * Creates a single fuel can sprite with pulse animation.
 * @param {number} x
 * @param {number} y
 * @param {string|number} id
 * @returns {Container}
 */
export function createFuelCan(x, y, id) {
  const container = new Container();
  container.x = x;
  container.y = y;
  container._id = id;
  container._born = Date.now();
  
  // Random color for this food
  const color = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)];
  container._color = color;

  // Outer glow ring
  const glow = new Graphics();
  glow.circle(0, 0, FOOD_RADIUS * 1.8)
      .fill({ color, alpha: 0.2 });
  container.addChild(glow);

  // Main body (particle circle)
  const body = new Graphics();
  body.circle(0, 0, FOOD_RADIUS)
      .fill({ color });
  container.addChild(body);

  container._glow = glow;
  container._body = body;

  return container;
}

function darkenColor(color, factor) {
  const r = ((color >> 16) & 0xff) * factor;
  const g = ((color >> 8) & 0xff) * factor;
  const b = (color & 0xff) * factor;
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

function lightenColor(color, factor) {
  const r = Math.min(255, ((color >> 16) & 0xff) * factor);
  const g = Math.min(255, ((color >> 8) & 0xff) * factor);
  const b = Math.min(255, (color & 0xff) * factor);
  return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
}

/**
 * Animates all fuel cans in the container — call once per ticker tick.
 * @param {Container} foodLayer
 */
export function animateFuelCans(foodLayer) {
  const now = Date.now();
  for (const can of foodLayer.children) {
    const t = (now - can._born) * PULSE_SPEED;
    const pulse = Math.sin(t);
    // Scale ±8%
    const s = 1 + pulse * 0.08;
    can._body.scale.set(s);
    // Alpha ±20% on glow
    can._glow.alpha = 0.2 + pulse * 0.15;
  }
}
