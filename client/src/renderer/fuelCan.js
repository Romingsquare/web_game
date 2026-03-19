import { Container, Graphics } from 'pixi.js';
import { FOOD_RADIUS, FOOD_VALUE, BASE_RADIUS } from '../../../shared/constants.js';

const CAN_COLOR    = 0x2ecc71;
const CAN_GLOW     = 0x27ae60;
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

  // Outer glow ring
  const glow = new Graphics();
  glow.circle(0, 0, FOOD_RADIUS * 1.8)
      .fill({ color: CAN_GLOW, alpha: 0.25 });
  container.addChild(glow);

  // Main can body
  const body = new Graphics();
  drawCan(body);
  container.addChild(body);

  container._glow = glow;
  container._body = body;

  return container;
}

function drawCan(g) {
  // Fuel can: small rounded rect with a nozzle on top
  g.roundRect(-FOOD_RADIUS * 0.7, -FOOD_RADIUS, FOOD_RADIUS * 1.4, FOOD_RADIUS * 1.8, 3)
   .fill({ color: CAN_COLOR });
  // Nozzle
  g.roundRect(-FOOD_RADIUS * 0.2, -FOOD_RADIUS * 1.35, FOOD_RADIUS * 0.55, FOOD_RADIUS * 0.5, 2)
   .fill({ color: 0x27ae60 });
  // Highlight stripe
  g.roundRect(-FOOD_RADIUS * 0.45, -FOOD_RADIUS * 0.7, FOOD_RADIUS * 0.25, FOOD_RADIUS * 1.1, 2)
   .fill({ color: 0x58d68d, alpha: 0.6 });
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
    can._glow.alpha = 0.25 + pulse * 0.2;
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
 * Removes eaten cans, grows player, respawns them at new random positions.
 * @param {Container} foodLayer
 * @param {object} player  - localPlayer ref {x, y, radius}
 * @param {number} mapSize
 */
export function checkFoodCollisions(foodLayer, player, mapSize) {
  const eatDistSq = (player.radius + FOOD_RADIUS) ** 2;

  for (let i = foodLayer.children.length - 1; i >= 0; i--) {
    const can = foodLayer.children[i];
    const dx  = player.x - can.x;
    const dy  = player.y - can.y;
    if (dx * dx + dy * dy < eatDistSq) {
      // Grow player
      player.radius += FOOD_VALUE;

      // Respawn can at new random position
      can.x = Math.random() * (mapSize - 100) + 50;
      can.y = Math.random() * (mapSize - 100) + 50;
      can._born = Date.now(); // reset pulse phase
    }
  }
}
