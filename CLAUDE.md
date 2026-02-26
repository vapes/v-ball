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

### PixiJS v8 API notes

- Graphics uses method chaining: `.roundRect(...).fill({color})` / `.stroke({width, color})`
- `Container.position` is a `Point`, not a plain object — cast to `Record<string, number>` when passing to `Animator.animate()`
- `eventMode = "static"` must be set on containers that need pointer events

### Deployment

Push to `main` → GitHub Actions runs `npm ci && npm run build` → uploads `dist/` to GitHub Pages. No manual steps needed.

### Stale file

`public/index.html` is an unused leftover from the original Three.js/webpack setup (references `../dist/bundle.js`). It has no effect on the Vite build and can be deleted.
