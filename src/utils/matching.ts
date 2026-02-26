import { GRID_COLS, GRID_ROWS, MIN_MATCH } from "../constants";
import type { GridPosition, MatchGroup } from "../types";
import { TileType } from "../types";

/**
 * Scan the grid for all horizontal and vertical matches of MIN_MATCH or more.
 * Returns an array of MatchGroups (each is a set of positions to remove).
 */
export function findMatches(grid: (TileType | null)[][]): MatchGroup[] {
  const matched = new Set<string>();

  const key = (r: number, c: number) => `${r},${c}`;

  // Horizontal
  for (let r = 0; r < GRID_ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= GRID_COLS; c++) {
      if (c < GRID_COLS && grid[r][c] !== null && grid[r][c] === grid[r][runStart]) {
        continue;
      }
      const runLen = c - runStart;
      if (runLen >= MIN_MATCH && grid[r][runStart] !== null) {
        for (let k = runStart; k < c; k++) {
          matched.add(key(r, k));
        }
      }
      runStart = c;
    }
  }

  // Vertical
  for (let c = 0; c < GRID_COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= GRID_ROWS; r++) {
      if (r < GRID_ROWS && grid[r][c] !== null && grid[r][c] === grid[runStart][c]) {
        continue;
      }
      const runLen = r - runStart;
      if (runLen >= MIN_MATCH && grid[runStart][c] !== null) {
        for (let k = runStart; k < r; k++) {
          matched.add(key(k, c));
        }
      }
      runStart = r;
    }
  }

  if (matched.size === 0) return [];

  // Convert to a single MatchGroup (positions are unique thanks to Set)
  const positions: GridPosition[] = [];
  for (const k of matched) {
    const [r, c] = k.split(",").map(Number);
    positions.push({ row: r, col: c });
  }

  return [{ positions }];
}

/**
 * Check whether any single adjacent swap on the grid would produce a match.
 */
export function hasValidMoves(grid: (TileType | null)[][]): boolean {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      // Try swap right
      if (c + 1 < GRID_COLS) {
        swap(grid, r, c, r, c + 1);
        if (findMatches(grid).length > 0) {
          swap(grid, r, c, r, c + 1);
          return true;
        }
        swap(grid, r, c, r, c + 1);
      }
      // Try swap down
      if (r + 1 < GRID_ROWS) {
        swap(grid, r, c, r + 1, c);
        if (findMatches(grid).length > 0) {
          swap(grid, r, c, r + 1, c);
          return true;
        }
        swap(grid, r, c, r + 1, c);
      }
    }
  }
  return false;
}

function swap(
  grid: (TileType | null)[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): void {
  const tmp = grid[r1][c1];
  grid[r1][c1] = grid[r2][c2];
  grid[r2][c2] = tmp;
}
