export const MAP_SIZE        = 4000;
export const TICK_RATE       = 20;
export const BASE_SPEED      = 4;
export const BASE_RADIUS     = 20;
export const FOOD_COUNT      = 250;
export const FOOD_RADIUS     = 8;
export const FOOD_VALUE      = 1;  // score points per food
export const EAT_RATIO       = 1.10;
export const RESPAWN_SIZE    = BASE_RADIUS;
export const MIN_ZOOM        = 0.35;
export const MAX_ZOOM        = 1.2;

// Growth formula: radius = BASE_RADIUS + LOG_SCALE * ln(1 + score * LOG_RATE)
// This means radius grows quickly at first, then tapers off at high scores.
// There is NO hard cap — the car always grows, just slower and slower.
export const LOG_SCALE  = 80;  // controls max visual size
export const LOG_RATE   = 0.3; // controls how fast you reach the taper

// Convenience: compute radius from score (shared client + server)
// radius = BASE_RADIUS + LOG_SCALE * Math.log1p(score * LOG_RATE)
// Math.log1p(x) = ln(1 + x), which is stable near 0

// Nitro boost
export const NITRO_MULTIPLIER = 2.2;
export const NITRO_DURATION   = 2000;
export const NITRO_COOLDOWN   = 5000;

// Room system
export const MAX_PLAYERS_PER_ROOM = 50;
export const ROOM_ID_LENGTH       = 6;
