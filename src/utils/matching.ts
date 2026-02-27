import { GRID_COLS, GRID_ROWS, MIN_MATCH } from "../constants";
import type { GridPosition, MatchGroup } from "../types";
import { TileType } from "../types";

/** Returns true for regular (color) tiles that participate in matching. */
function isMatchable(t: TileType | null): boolean {
  return t !== null && t !== TileType.LineBomb && t !== TileType.ColorBomb;
}

/**
 * Scan the grid for all horizontal and vertical matches of MIN_MATCH or more.
 * Each contiguous run is returned as its own MatchGroup with length and direction,
 * so the caller can differentiate 3-, 4-, and 5-in-a-row.
 */
export function findMatches(grid: (TileType | null)[][]): MatchGroup[] {
  const groups: MatchGroup[] = [];
  const matched = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;

  // Horizontal runs
  for (let r = 0; r < GRID_ROWS; r++) {
    let runStart = 0;
    for (let c = 1; c <= GRID_COLS; c++) {
      if (
        c < GRID_COLS &&
        isMatchable(grid[r][c]) &&
        grid[r][c] === grid[r][runStart]
      ) {
        continue;
      }
      const runLen = c - runStart;
      if (runLen >= MIN_MATCH && isMatchable(grid[r][runStart])) {
        const positions: GridPosition[] = [];
        for (let k = runStart; k < c; k++) {
          positions.push({ row: r, col: k });
          matched.add(key(r, k));
        }
        groups.push({ positions, length: runLen, direction: "horizontal" });
      }
      runStart = c;
    }
  }

  // Vertical runs
  for (let c = 0; c < GRID_COLS; c++) {
    let runStart = 0;
    for (let r = 1; r <= GRID_ROWS; r++) {
      if (
        r < GRID_ROWS &&
        isMatchable(grid[r][c]) &&
        grid[r][c] === grid[runStart][c]
      ) {
        continue;
      }
      const runLen = r - runStart;
      if (runLen >= MIN_MATCH && isMatchable(grid[runStart][c])) {
        const positions: GridPosition[] = [];
        for (let k = runStart; k < r; k++) {
          positions.push({ row: k, col: c });
          matched.add(key(k, c));
        }
        groups.push({ positions, length: runLen, direction: "vertical" });
      }
      runStart = r;
    }
  }

  return groups;
}

/**
 * Check whether any single adjacent swap on the grid would produce a match.
 */
export function hasValidMoves(grid: (TileType | null)[][]): boolean {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      // Color bomb can always be swapped with a neighbor
      if (grid[r][c] === TileType.ColorBomb) {
        if (c + 1 < GRID_COLS && grid[r][c + 1] !== null) return true;
        if (r + 1 < GRID_ROWS && grid[r + 1][c] !== null) return true;
        if (c - 1 >= 0 && grid[r][c - 1] !== null) return true;
        if (r - 1 >= 0 && grid[r - 1][c] !== null) return true;
        continue;
      }
      // Try swap right
      if (c + 1 < GRID_COLS) {
        if (grid[r][c + 1] === TileType.ColorBomb) continue; // handled above
        swap(grid, r, c, r, c + 1);
        if (findMatches(grid).length > 0) {
          swap(grid, r, c, r, c + 1);
          return true;
        }
        swap(grid, r, c, r, c + 1);
      }
      // Try swap down
      if (r + 1 < GRID_ROWS) {
        if (grid[r + 1][c] === TileType.ColorBomb) continue; // handled above
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
