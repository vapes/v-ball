import { GRID_COLS, GRID_ROWS, MIN_MATCH } from "../constants";
import { TileType, TILE_TYPE_COUNT } from "../types";

/**
 * Generate an initial grid with no pre-existing matches.
 * Uses a simple constraint: when placing a tile, avoid creating a run of
 * MIN_MATCH in the row or column by excluding types that would do so.
 */
export function generateGrid(): TileType[][] {
  const grid: TileType[][] = [];

  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      const forbidden = new Set<TileType>();

      // Check horizontal: if the two tiles to the left are the same type, forbid it
      if (c >= MIN_MATCH - 1) {
        const t = grid[r][c - 1];
        if (t === grid[r][c - 2]) {
          forbidden.add(t);
        }
      }

      // Check vertical: if the two tiles above are the same type, forbid it
      if (r >= MIN_MATCH - 1) {
        const t = grid[r - 1][c];
        if (t === grid[r - 2][c]) {
          forbidden.add(t);
        }
      }

      const allowed: TileType[] = [];
      for (let t = 0; t < TILE_TYPE_COUNT; t++) {
        if (!forbidden.has(t as TileType)) {
          allowed.push(t as TileType);
        }
      }

      grid[r][c] = allowed[Math.floor(Math.random() * allowed.length)];
    }
  }

  return grid;
}

/** Pick a random tile type, optionally excluding certain types. */
export function randomTileType(exclude?: Set<TileType>): TileType {
  const allowed: TileType[] = [];
  for (let t = 0; t < TILE_TYPE_COUNT; t++) {
    if (!exclude || !exclude.has(t as TileType)) {
      allowed.push(t as TileType);
    }
  }
  return allowed[Math.floor(Math.random() * allowed.length)];
}
