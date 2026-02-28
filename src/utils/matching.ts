import { GRID_COLS, GRID_ROWS, MIN_MATCH } from "../constants";
import type { GridPosition, MatchGroup } from "../types";
import { TileType } from "../types";

/** Returns true for tiles that participate in matching (regular colors + LineBombs). */
function isMatchable(t: TileType | null): boolean {
  return t !== null && t !== TileType.ColorBomb;
}

/**
 * Grid prepared for match detection.
 *
 * - grid:     effective-color grid — LineBombs are replaced by their base color
 *             (TileType.Red, etc.), or kept as TileType.LineBomb when colorless.
 * - bombMask: true at every cell that is a LineBomb.
 *
 * Matching rules:
 *   1. Two adjacent LineBombs → always continue (bomb-bomb, color-independent).
 *   2. LineBomb next to a run → continues only if its effective color matches runColor.
 *   3. Regular tile → continues only if its color matches runColor.
 *   4. A run made entirely of LineBombs is valid at length ≥ 2.
 *   5. All other runs need length ≥ MIN_MATCH (3).
 */
export interface MatchableGrid {
  grid: (TileType | null)[][];
  bombMask: boolean[][];
}

export function findMatches(mg: MatchableGrid): MatchGroup[] {
  const { grid, bombMask } = mg;
  const groups: MatchGroup[] = [];

  /**
   * Scan one row/column and push any runs that qualify as matches.
   * @param getCell  returns the effective TileType at index i
   * @param getBomb  returns whether cell i is a LineBomb
   * @param makePos  converts index i to a GridPosition
   * @param len      total length of the row/column
   */
  function scanRun(
    getCell: (i: number) => TileType | null,
    getBomb: (i: number) => boolean,
    makePos: (i: number) => GridPosition,
    len: number,
    direction: "horizontal" | "vertical",
  ): void {
    let runStart = 0;
    // Effective color of the run; null means all wildcards so far.
    let runColor: TileType | null = null;
    // True once a non-bomb tile has joined the run.
    let runHasNonBomb = false;
    // Whether the most recently added cell is a bomb (for bomb-bomb rule).
    let lastIsBomb = false;

    // Initialise state for the first cell.
    const first = getCell(0);
    if (isMatchable(first)) {
      lastIsBomb = getBomb(0);
      runHasNonBomb = !lastIsBomb;
      // A regular tile or a colored LineBomb sets the run color immediately.
      if (!lastIsBomb) {
        runColor = first;
      } else if (first !== TileType.LineBomb) {
        runColor = first; // colored LineBomb's effective color
      }
    }

    const emitRun = (end: number) => {
      const runLen = end - runStart;
      // Pure bomb runs qualify at ≥ 2; all others need MIN_MATCH.
      const qualifies = runLen >= MIN_MATCH || (runLen >= 2 && !runHasNonBomb);
      if (qualifies && isMatchable(getCell(runStart))) {
        const positions: GridPosition[] = [];
        for (let k = runStart; k < end; k++) positions.push(makePos(k));
        groups.push({ positions, length: runLen, direction });
      }
    };

    for (let i = 1; i <= len; i++) {
      const cell = i < len ? getCell(i) : null;
      const cellIsBomb = i < len ? getBomb(i) : false;

      let continues = false;
      if (isMatchable(cell) && isMatchable(getCell(runStart))) {
        if (cellIsBomb && lastIsBomb) {
          // Rule 1: adjacent bombs always continue.
          continues = true;
        } else if (cellIsBomb) {
          // Rule 2: LineBomb continues run only by its effective color.
          const effectiveColor = cell !== TileType.LineBomb ? cell : null;
          if (effectiveColor === null) {
            // Colorless LineBomb acts as wildcard.
            continues = true;
          } else if (runColor === null) {
            runColor = effectiveColor;
            continues = true;
          } else {
            continues = effectiveColor === runColor;
          }
        } else {
          // Rule 3: regular tile.
          if (runColor === null) {
            runColor = cell;
            continues = true;
          } else {
            continues = cell === runColor;
          }
        }
      }

      if (!continues) {
        emitRun(i);
        // Start a new run at cell i.
        runStart = i;
        runColor = null;
        runHasNonBomb = false;
        lastIsBomb = false;
        if (i < len && isMatchable(cell)) {
          lastIsBomb = cellIsBomb;
          runHasNonBomb = !cellIsBomb;
          if (!cellIsBomb) {
            runColor = cell;
          } else if (cell !== TileType.LineBomb) {
            runColor = cell; // colored LineBomb
          }
        }
      } else {
        lastIsBomb = cellIsBomb;
        if (!cellIsBomb) runHasNonBomb = true;
      }
    }
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    scanRun(
      (c) => grid[r][c],
      (c) => bombMask[r][c],
      (c) => ({ row: r, col: c }),
      GRID_COLS,
      "horizontal",
    );
  }

  for (let c = 0; c < GRID_COLS; c++) {
    scanRun(
      (r) => grid[r][c],
      (r) => bombMask[r][c],
      (r) => ({ row: r, col: c }),
      GRID_ROWS,
      "vertical",
    );
  }

  return groups;
}

/**
 * Check whether any single adjacent swap on the grid would produce a match.
 */
export function hasValidMoves(mg: MatchableGrid): boolean {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      // ColorBomb can always be swapped with a non-null neighbor.
      if (mg.grid[r][c] === TileType.ColorBomb) {
        if (c + 1 < GRID_COLS && mg.grid[r][c + 1] !== null) return true;
        if (r + 1 < GRID_ROWS && mg.grid[r + 1][c] !== null) return true;
        if (c - 1 >= 0 && mg.grid[r][c - 1] !== null) return true;
        if (r - 1 >= 0 && mg.grid[r - 1][c] !== null) return true;
        continue;
      }
      if (c + 1 < GRID_COLS) {
        if (mg.grid[r][c + 1] === TileType.ColorBomb) continue;
        swapMG(mg, r, c, r, c + 1);
        if (findMatches(mg).length > 0) { swapMG(mg, r, c, r, c + 1); return true; }
        swapMG(mg, r, c, r, c + 1);
      }
      if (r + 1 < GRID_ROWS) {
        if (mg.grid[r + 1][c] === TileType.ColorBomb) continue;
        swapMG(mg, r, c, r + 1, c);
        if (findMatches(mg).length > 0) { swapMG(mg, r, c, r + 1, c); return true; }
        swapMG(mg, r, c, r + 1, c);
      }
    }
  }
  return false;
}

/**
 * Find the valid move that produces the longest total match.
 */
export function findValidMove(
  mg: MatchableGrid,
): { a: GridPosition; b: GridPosition } | null {
  let best: { a: GridPosition; b: GridPosition } | null = null;
  let bestLen = 0;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (mg.grid[r][c] === TileType.ColorBomb) continue;

      if (c + 1 < GRID_COLS && mg.grid[r][c + 1] !== TileType.ColorBomb) {
        swapMG(mg, r, c, r, c + 1);
        const matches = findMatches(mg);
        if (matches.length > 0) {
          const totalLen = matches.reduce((s, m) => s + m.length, 0);
          if (totalLen > bestLen) {
            bestLen = totalLen;
            best = { a: { row: r, col: c }, b: { row: r, col: c + 1 } };
          }
        }
        swapMG(mg, r, c, r, c + 1);
      }

      if (r + 1 < GRID_ROWS && mg.grid[r + 1][c] !== TileType.ColorBomb) {
        swapMG(mg, r, c, r + 1, c);
        const matches = findMatches(mg);
        if (matches.length > 0) {
          const totalLen = matches.reduce((s, m) => s + m.length, 0);
          if (totalLen > bestLen) {
            bestLen = totalLen;
            best = { a: { row: r, col: c }, b: { row: r + 1, col: c } };
          }
        }
        swapMG(mg, r, c, r + 1, c);
      }
    }
  }

  return best;
}

function swapMG(
  mg: MatchableGrid,
  r1: number, c1: number,
  r2: number, c2: number,
): void {
  const tmpGrid = mg.grid[r1][c1];
  mg.grid[r1][c1] = mg.grid[r2][c2];
  mg.grid[r2][c2] = tmpGrid;

  const tmpBomb = mg.bombMask[r1][c1];
  mg.bombMask[r1][c1] = mg.bombMask[r2][c2];
  mg.bombMask[r2][c2] = tmpBomb;
}
