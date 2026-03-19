import { Graphics, Container } from 'pixi.js';
import { MAP_SIZE } from '../../../shared/constants.js';

const GRID_SIZE   = 200; // px between grid lines
const ROAD_EVERY  = 5;   // every 5th line is a "road" (brighter)

/**
 * Draws the static world background: dark asphalt fill + grid lines.
 * Returns a Container ready to be added to mapLayer.
 */
export function createWorldMap() {
  const container = new Container();

  // --- Asphalt base ---
  const base = new Graphics();
  base.rect(0, 0, MAP_SIZE, MAP_SIZE).fill({ color: 0x111118 });
  container.addChild(base);

  // --- Grid lines ---
  const grid = new Graphics();
  const lineCount = MAP_SIZE / GRID_SIZE;

  for (let i = 0; i <= lineCount; i++) {
    const pos    = i * GRID_SIZE;
    const isRoad = i % ROAD_EVERY === 0;
    const color  = isRoad ? 0x2a2a3a : 0x1a1a28;
    const alpha  = isRoad ? 0.9 : 0.5;
    const width  = isRoad ? 2 : 1;

    // vertical
    grid.moveTo(pos, 0).lineTo(pos, MAP_SIZE)
        .stroke({ color, alpha, width });

    // horizontal
    grid.moveTo(0, pos).lineTo(MAP_SIZE, pos)
        .stroke({ color, alpha, width });
  }

  container.addChild(grid);

  // --- Map border ---
  const border = new Graphics();
  border.rect(0, 0, MAP_SIZE, MAP_SIZE)
        .stroke({ color: 0x5865f2, alpha: 0.6, width: 4 });
  container.addChild(border);

  return container;
}
