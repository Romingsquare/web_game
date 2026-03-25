export const MAP_SIZE        = 4000;
export const TICK_RATE       = 20;
export const BASE_SPEED      = 4.5;  // Constant speed for all players
export const BASE_RADIUS     = 20;
export const FOOD_COUNT      = 250;
export const FOOD_RADIUS     = 8;
export const FOOD_VALUE      = 1;  // score points per food
export const RESPAWN_SIZE    = BASE_RADIUS;
export const MIN_ZOOM        = 0.35;
export const MAX_ZOOM        = 1.2;

// Growth formula: radius = BASE_RADIUS + score * GROWTH_PER_FOOD
// Simple linear growth that's very gradual
export const GROWTH_PER_FOOD = 0.15;  // Each food adds 0.15 to radius (very slow growth)

// Nitro boost
export const NITRO_MULTIPLIER = 1.8;   // Reduced from 2.2 for more balanced boost
export const NITRO_DURATION   = 2000;  // 2 seconds of boost
export const NITRO_COOLDOWN   = 8000;  // 8 seconds cooldown (increased from 5s)

// Room system
export const MAX_PLAYERS_PER_ROOM = 50;
export const ROOM_ID_LENGTH       = 6;
