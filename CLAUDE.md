# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server → http://localhost:5173/v-ball/
npm run build    # tsc (type-check) + vite build → dist/
npm run preview  # Serve dist/ locally
```

There are no tests and no linter configured.

## Architecture

**Match-3 puzzle game** (Candy Crush style) built with PixiJS v8 + TypeScript, deployed to GitHub Pages at `https://vapes.github.io/v-ball/`.

### Source layout

```
src/
  main.ts           Bootstrap: init PixiJS app, scale board to fit viewport
  constants.ts      All tunable values (grid size, tile size, durations, colors, scoring)
  types.ts          TileType enum, GridPosition, MatchGroup, SwapRequest
  game/
    Board.ts        Central controller — owns both data grid and tile grid, orchestrates all phases
    Tile.ts         One tile: PixiJS Container + Graphics, handles its own animations
    InputHandler.ts Pointer events → SwapRequest (click-select or drag)
    Animator.ts     Promise-based tweens on PixiJS Ticker (ease-out quad)
    ScoreManager.ts Score + combo multiplier, writes to #score DOM element
  utils/
    matching.ts     Pure functions: findMatches, hasValidMoves (no side effects)
    random.ts       generateGrid (no initial matches), randomTileType
```

### Two parallel data structures

`Board` maintains two mirrored 8×8 arrays that must always be in sync:
- `grid: (TileType | null)[][]` — the logical game state used by pure matching functions
- `tiles: (Tile | null)[][]` — the visual/PixiJS objects

Any operation that moves or removes a tile must update **both** arrays.

### Game flow (async, sequential)

`Board.onSwapRequest` is the main state machine. It sequences animation phases with `await`:

1. Animate swap → update both arrays → `findMatches`
2. No match → animate swap back (early return)
3. Match → `score.addMatch` → `animateDestroy` on matched tiles → remove from both arrays
4. `cascade()` — shift tiles down in both arrays, animate falls
5. `fillEmpty()` — spawn new tiles from above the board
6. `findMatches` again → if matches, recurse (combo chains)
7. `hasValidMoves` → if false, reshuffle entire board

`busy = true` blocks new input during all of the above.

### Responsive / mobile

`main.ts` computes `scale = min(availW / BOARD_WIDTH, availH / BOARD_HEIGHT, 1)` on every resize and applies it to `board.container.scale`. The board's internal pixel dimensions (580×580 at 1×) never change — only the container scale changes. Portrait lock is attempted via `screen.orientation.lock("portrait")`; a CSS overlay covers landscape on small screens.

### Tile types & bonus system

```typescript
enum TileType {
  Red=0, Blue=1, Green=2, Yellow=3, Purple=4, Orange=5, Pink=6,
  LineBomb=7,   // 4+ match → clears row or column (orientation from match direction)
  ColorBomb=8   // 5+ match → destroys all tiles of matched color
}
```

**LineBomb behavior:**
- Created when 4+ tiles match in a line
- Has `baseType` (original color) and `bonusOrientation` (horizontal/vertical)
- Matches with regular tiles of its `baseType` color
- Matches with other LineBombs **regardless of color** (bomb-bomb rule)
- Detonation plays explosion animation, then clears entire row/column

**ColorBomb behavior:**
- Created when 5+ tiles match
- Only activates on direct swap (not by matching in a cascade)
- Destroys all tiles of the swapped color globally

### Match detection subtlety

`findMatches()` uses `MatchableGrid` which has:
- `grid` — LineBombs replaced by their `baseType` (for color-matching logic)
- `bombMask` — tracks which cells have bombs (for bomb-bomb matching rules)

This lets LineBombs participate in run matching by color while also being able to chain with other bombs.

### Animation & async patterns

- All animations return `Promise<void>` (tweens use PixiJS Ticker)
- Chain animations with `await` in `onSwapRequest` state machine
- Multiple animations run in parallel via `Promise.all()`
- Input is blocked via `busy = true` during any animation phase
- Tile position/scale changes go through `Animator.animate()` for smooth tweening

### PixiJS v8 API notes

- Graphics uses method chaining: `.roundRect(...).fill({color})` / `.stroke({width, color})`
- `Container.position` is a `Point`, not a plain object — cast to `Record<string, number>` when passing to `Animator.animate()`
- `eventMode = "static"` must be set on containers that need pointer events

### Keeping arrays in sync

**Critical pattern** — any tile movement or removal must update both `grid` and `tiles`:

```typescript
// Remove a tile
grid[r][c] = null;
tiles[r][c] = null;
tileContainer.removeChild(tile.container);

// Move a tile (used in cascade)
tiles[newR][c] = tile;
grid[newR][c] = tile.tileType;
tiles[oldR][c] = null;
grid[oldR][c] = null;
```

The `grid` is the source of truth for matching logic; `tiles` is the visual representation. If they diverge, matches become incorrect.

### Deployment

Push to `main` → GitHub Actions runs `npm ci && npm run build` → uploads `dist/` to GitHub Pages. No manual steps needed.

### Stale file

`public/index.html` is an unused leftover from the original Three.js/webpack setup (references `../dist/bundle.js`). It has no effect on the Vite build and can be deleted.
