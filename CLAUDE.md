# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**v-ball** is a Match-3 puzzle game (Candy Crush style) built with PixiJS v8 and TypeScript, deployed via GitHub Pages.

### Common Commands

```bash
npm run dev      # Start Vite dev server (http://localhost:5173/v-ball/)
npm run build    # TypeScript compilation + Vite production build
npm run preview  # Preview the built dist/ locally
```

## Project Architecture

### Source Structure

```
src/
  main.ts              — Bootstrap: create PixiJS app, init game, center board
  constants.ts         — Grid size, tile size, colors, animation durations, scoring
  types.ts             — Interfaces (TileType, GridPosition, MatchGroup, SwapRequest)
  game/
    Board.ts           — Central game controller: grid state, match/cascade orchestration
    Tile.ts            — Single tile: PixiJS Graphics, grid position, animations
    InputHandler.ts    — Mouse/touch: click-to-select + click-adjacent or drag-to-swap
    Animator.ts        — Tween system using PixiJS Ticker (ease-out quad)
    ScoreManager.ts    — Score tracking with combo multiplier
  utils/
    matching.ts        — Pure functions: findMatches, hasValidMoves
    random.ts          — Tile generation ensuring no initial matches
```

### Core Systems

1. **Board** (`src/game/Board.ts`)
   - Holds 2D array of Tile references + parallel grid of TileType values
   - Orchestrates game flow: swap → validate → destroy → cascade → refill → chain check
   - Prevents input during animations via `busy` flag
   - Uses async/await for sequential animation phases
   - Reshuffles board when no valid moves remain

2. **Tile** (`src/game/Tile.ts`)
   - Wraps a PixiJS Container with Graphics drawn inside
   - Each TileType (Red/Blue/Green/Yellow/Purple/Orange) has a distinct color + shape icon
   - Methods: `animateSwap()`, `animateFall()`, `animateDestroy()`, `animateSpawn()`
   - Static helpers `pixelX()`/`pixelY()` convert grid coords to pixel positions

3. **InputHandler** (`src/game/InputHandler.ts`)
   - Listens to pointerdown/pointerup on the board container
   - Supports click-to-select then click-adjacent, or drag-to-swap
   - Shows a white highlight rectangle on the selected tile
   - Emits SwapRequests to Board callback

4. **Animator** (`src/game/Animator.ts`)
   - Lightweight tween manager running on PixiJS Ticker
   - `animate(target, to, duration)` returns a Promise
   - Uses ease-out quadratic interpolation

5. **ScoreManager** (`src/game/ScoreManager.ts`)
   - Tracks score and combo chain multiplier
   - Updates the `#score` DOM element

### Game Flow

1. **Init**: Generate 8×8 grid with no pre-existing matches
2. **Input**: Player selects tile A, then adjacent tile B (or drags)
3. **Swap**: Animate A↔B swap
4. **Validate**: Check if swap creates any match
   - No match → animate swap back (invalid move)
   - Match found → proceed
5. **Destroy**: Scale-down animation on matched tiles, then remove
6. **Cascade**: Tiles above fall down to fill gaps, new tiles spawn from top
7. **Chain check**: After cascade, check for new matches → repeat from step 5
8. **Score**: Award points per match, combo multiplier for chains
9. **Ready**: Re-enable input

### Matching Logic (`src/utils/matching.ts`)

- `findMatches(grid)`: Scans rows and columns for runs of 3+ consecutive same-type tiles
- `hasValidMoves(grid)`: Tries every adjacent swap to check if any produces a match

### Configuration

All tunable values are in `src/constants.ts`:
- Grid dimensions (8×8), tile size (64px), gap (4px)
- Animation durations (swap, fall, destroy, spawn)
- Scoring (points per tile, combo multiplier)
- Tile colors array

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`):

- Triggers on `push` to `main` or manual `workflow_dispatch`
- Builds with `npm run build`
- Deploys the `dist/` folder to GitHub Pages
- Published at `https://vapes.github.io/v-ball/`

## Key Patterns to Preserve

1. **Modular class design**: Each system (Board, Tile, Input, Animator, Score) is self-contained
2. **Configuration-first approach**: Behavior tuning via `constants.ts`, not magic numbers
3. **Async animation pipeline**: Board uses `await` to sequence animations — don't break the chain
4. **Pure matching logic**: `matching.ts` functions are pure and testable, separated from rendering
5. **Separation of concerns**: Grid data (TileType[][]) is separate from visual representation (Tile[][])

## Development Notes

- TypeScript strict mode is enabled; all code is strictly typed
- Path alias `@/*` resolves to `src/*` (configured in `tsconfig.json` and `vite.config.ts`)
- The game uses ESM (`"type": "module"` in package.json)
- PixiJS v8 — uses the new Graphics API (method chaining: `.roundRect().fill()`)
- Vite base path is `/v-ball/` for GitHub Pages subdirectory deployment
