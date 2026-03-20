import { Container, Graphics } from 'pixi.js';
import { FOOD_RADIUS, FOOD_VALUE, BASE_RADIUS, GROWTH_FACTOR } from '../../../shared/constants.js';

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

  // Main can body
  const body = new Graphics();
  drawCan(body, color);
  container.addChild(body);

  container._glow = glow;
  container._body = body;

  return container;
}

function drawCan(g, color) {
  // Fuel can: small rounded rect with a nozzle on top
  g.roundRect(-FOOD_RADIUS * 0.7, -FOOD_RADIUS, FOOD_RADIUS * 1.4, FOOD_RADIUS * 1.8, 3)
   .fill({ color });
  // Nozzle (darker shade)
  const darkerColor = darkenColor(color, 0.8);
  g.roundRect(-FOOD_RADIUS * 0.2, -FOOD_RADIUS * 1.35, FOOD_RADIUS * 0.55, FOOD_RADIUS * 0.5, 2)
   .fill({ color: darkerColor });
  // Highlight stripe (lighter shade)
  const lighterColor = lightenColor(color, 1.2);
  g.roundRect(-FOOD_RADIUS * 0.45, -FOOD_RADIUS * 0.7, FOOD_RADIUS * 0.25, FOOD_RADIUS * 1.1, 2)
   .fill({ color: lighterColor, alpha: 0.6 });
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

/**
 * Spawns `count` fuel cans at random positions and adds them to foodLayer.
 * @param {Container} foodLayer
 * @param {number} count
 * @param {number} mapSize
 * @returns {Array} array of can data objects {id, x, y}
 */
export function spawnLocalFoods(foodLayer, count, mapSize) {
  const foods = [];
  for (let i = 0; i < count; i++) {
    const id = `local_${i}`;
    const x  = Math.random() * (mapSize - 100) + 50;
    const y  = Math.random() * (mapSize - 100) + 50;
    const can = createFuelCan(x, y, id);
    foodLayer.addChild(can);
    foods.push({ id, x, y });
  }
  return foods;
}

/**
 * Checks if the local player overlaps any fuel can.
 * Removes eaten cans, grows player score, respawns them at new random positions.
 * @param {Container} foodLayer
 * @param {object} player  - localPlayer ref {x, y, radius, score}
 * @param {number} mapSize
 */
export function checkFoodCollisions(foodLayer, player, mapSize) {
  const eatDistSq = (player.radius + FOOD_RADIUS) ** 2;

  for (let i = foodLayer.children.length - 1; i >= 0; i--) {
    const can = foodLayer.children[i];
    const dx  = player.x - can.x;
    const dy  = player.y - can.y;
    if (dx * dx + dy * dy < eatDistSq) {
      // Increase score
      player.score += FOOD_VALUE;
      
      // Calculate radius from score (exponential slowdown)
      player.radius = BASE_RADIUS + Math.sqrt(player.score * GROWTH_FACTOR);

      // Respawn can at new random position with new color
      can.x = Math.random() * (mapSize - 100) + 50;
      can.y = Math.random() * (mapSize - 100) + 50;
      can._born = Date.now(); // reset pulse phase
      
      // Change color
      const newColor = FOOD_COLORS[Math.floor(Math.random() * FOOD_COLORS.length)];
      can._color = newColor;
      can._body.clear();
      drawCan(can._body, newColor);
      can._glow.clear();
      can._glow.circle(0, 0, FOOD_RADIUS * 1.8).fill({ color: newColor, alpha: 0.2 });
    }
  }
}
