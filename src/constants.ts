/** Grid dimensions */
export const GRID_COLS = 8;
export const GRID_ROWS = 8;

/** Visual sizing (pixels) */
export const TILE_SIZE = 64;
export const TILE_GAP = 4;
export const TILE_RADIUS = 10;
export const BOARD_PADDING = 20;

/** Derived board dimensions */
export const CELL_SIZE = TILE_SIZE + TILE_GAP;
export const BOARD_WIDTH = CELL_SIZE * GRID_COLS - TILE_GAP + BOARD_PADDING * 2;
export const BOARD_HEIGHT = CELL_SIZE * GRID_ROWS - TILE_GAP + BOARD_PADDING * 2;

/** Animation durations (seconds) */
export const SWAP_DURATION = 0.2;
export const FALL_DURATION = 0.15; // per cell
export const DESTROY_DURATION = 0.25;
export const SPAWN_DURATION = 0.15;

/** Scoring */
export const POINTS_PER_TILE = 10;
export const COMBO_MULTIPLIER = 1.5;

/** Minimum match length */
export const MIN_MATCH = 3;

/** Tile colors — indices map to TileType enum values */
export const TILE_COLORS: number[] = [
  0xe74c3c, // Red
  0x3498db, // Blue
  0x2ecc71, // Green
  0xf1c40f, // Yellow
  0x9b59b6, // Purple
  0xe67e22, // Orange
  0xff69b4, // Pink
];
