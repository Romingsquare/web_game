export const MAP_SIZE        = 4000;
export const TICK_RATE       = 20;
export const BASE_SPEED      = 4;
export const BASE_RADIUS     = 20;
export const FOOD_COUNT      = 250;
export const FOOD_RADIUS     = 8;
export const FOOD_VALUE      = 1; // score points per food
export const EAT_RATIO       = 1.10;
export const RESPAWN_SIZE    = BASE_RADIUS;
export const MIN_ZOOM        = 0.6;
export const MAX_ZOOM        = 1.2;
export const MAX_RADIUS      = 300; // visual cap, but score keeps growing

// Growth formula: radius = BASE_RADIUS + sqrt(score * GROWTH_FACTOR)
export const GROWTH_FACTOR   = 20; // controls how fast radius grows with score

// Nitro boost
export const NITRO_MULTIPLIER = 2.2;
export const NITRO_DURATION   = 2000;
export const NITRO_COOLDOWN   = 5000;

// Room system
export const MAX_PLAYERS_PER_ROOM = 50;
export const ROOM_ID_LENGTH       = 6;
