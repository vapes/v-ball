import { GRID_COLS, GRID_ROWS, MIN_MATCH } from "../constants";
import type { GridPosition, MatchGroup } from "../types";
import { TileType } from "../types";

/** Returns true for tiles that participate in matching (regular colors + line bombs). */
function isMatchable(t: TileType | null): boolean {
  return t !== null && t !== TileType.ColorBomb;
}

/**
 * Scan the grid for all horizontal and vertical matches of MIN_MATCH or more.
 * LineBombs act as wildcards — they extend any color run and also match
 * each other (a row of 3+ LineBombs counts as a match).
 */
export function findMatches(grid: (TileType | null)[][]): MatchGroup[] {
  const groups: MatchGroup[] = [];

  // Horizontal runs
  for (let r = 0; r < GRID_ROWS; r++) {
    let runStart = 0;
    // Effective non-wild color of the current run (null = all wilds so far)
    let runColor: TileType | null =
      isMatchable(grid[r][0]) && grid[r][0] !== TileType.LineBomb
        ? grid[r][0]
        : null;

    for (let c = 1; c <= GRID_COLS; c++) {
      const cell = c < GRID_COLS ? grid[r][c] : null;

      let continues = false;
      if (isMatchable(cell) && isMatchable(grid[r][runStart])) {
        if (cell === TileType.LineBomb) {
          continues = true;
        } else if (runColor === null) {
          runColor = cell;
          continues = true;
        } else if (cell === runColor) {
          continues = true;
        }
      }

      if (!continues) {
        const runLen = c - runStart;
        if (runLen >= MIN_MATCH && isMatchable(grid[r][runStart])) {
          const positions: GridPosition[] = [];
          for (let k = runStart; k < c; k++) {
            positions.push({ row: r, col: k });
          }
          groups.push({ positions, length: runLen, direction: "horizontal" });
        }
        runStart = c;
        runColor =
          c < GRID_COLS && isMatchable(cell) && cell !== TileType.LineBomb
            ? cell
            : null;
      }
    }
  }

  // Vertical runs
  for (let c = 0; c < GRID_COLS; c++) {
    let runStart = 0;
    let runColor: TileType | null =
      isMatchable(grid[0][c]) && grid[0][c] !== TileType.LineBomb
        ? grid[0][c]
        : null;

    for (let r = 1; r <= GRID_ROWS; r++) {
      const cell = r < GRID_ROWS ? grid[r][c] : null;

      let continues = false;
      if (isMatchable(cell) && isMatchable(grid[runStart][c])) {
        if (cell === TileType.LineBomb) {
          continues = true;
        } else if (runColor === null) {
          runColor = cell;
          continues = true;
        } else if (cell === runColor) {
          continues = true;
        }
      }

      if (!continues) {
        const runLen = r - runStart;
        if (runLen >= MIN_MATCH && isMatchable(grid[runStart][c])) {
          const positions: GridPosition[] = [];
          for (let k = runStart; k < r; k++) {
            positions.push({ row: k, col: c });
          }
          groups.push({ positions, length: runLen, direction: "vertical" });
        }
        runStart = r;
        runColor =
          r < GRID_ROWS && isMatchable(cell) && cell !== TileType.LineBomb
            ? cell
            : null;
      }
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

/**
 * Find a valid move that produces a match, returning the two swap positions.
 * Prefers moves that produce longer matches (best hint).
 */
export function findValidMove(
  grid: (TileType | null)[][],
): { a: GridPosition; b: GridPosition } | null {
  let best: { a: GridPosition; b: GridPosition } | null = null;
  let bestLen = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c] === TileType.ColorBomb) continue;

      // Try swap right
      if (c + 1 < GRID_COLS && grid[r][c + 1] !== TileType.ColorBomb) {
        swap(grid, r, c, r, c + 1);
        const matches = findMatches(grid);
        if (matches.length > 0) {
          const totalLen = matches.reduce((sum, m) => sum + m.length, 0);
          if (totalLen > bestLen) {
            bestLen = totalLen;
            best = { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
          }
        }
        swap(grid, r, c, r, c + 1);
      }
      // Try swap down
      if (r + 1 < GRID_ROWS && grid[r + 1][c] !== TileType.ColorBomb) {
        swap(grid, r, c, r + 1, c);
        const matches = findMatches(grid);
        if (matches.length > 0) {
          const totalLen = matches.reduce((sum, m) => sum + m.length, 0);
          if (totalLen > bestLen) {
            bestLen = totalLen;
            best = { a: { row: r, col: c }, b: { row: r + 1, col: c } };
          }
        }
        swap(grid, r, c, r + 1, c);
      }
    }
  }

  return best;
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
