import { Graphics, Container } from 'pixi.js';

const PARTICLE_COUNT    = 10;
const PARTICLE_DURATION = 400; // ms
const MIN_SPEED         = 3;
const MAX_SPEED         = 6;

/**
 * Spawns a burst of particles at (x, y) in the given color.
 * Particles fade out over PARTICLE_DURATION ms then remove themselves.
 * @param {Container} particleLayer
 * @param {number} x  - world x
 * @param {number} y  - world y
 * @param {string|number} color - hex color of the destroyed car
 */
export function spawnParticles(particleLayer, x, y, color = 0x5865f2) {
  const hexColor = typeof color === 'string'
    ? parseInt(color.replace('#', ''), 16)
    : color;

  const count = PARTICLE_COUNT + Math.floor(Math.random() * 3); // 10–12

  for (let i = 0; i < count; i++) {
    const angle  = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed  = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
    const radius = 4 + Math.random() * 5;

    const g = new Graphics();
    g.circle(0, 0, radius).fill({ color: hexColor });
    g.x = x;
    g.y = y;

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const born = Date.now();

    particleLayer.addChild(g);

    // Animate via requestAnimationFrame — lightweight, no ticker dependency
    function step() {
      const elapsed = Date.now() - born;
      if (elapsed >= PARTICLE_DURATION) {
        particleLayer.removeChild(g);
        g.destroy();
        return;
      }
      const progress = elapsed / PARTICLE_DURATION;
      g.x     += vx;
      g.y     += vy;
      g.alpha  = 1 - progress;
      g.scale.set(1 - progress * 0.5);
      requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }
}
