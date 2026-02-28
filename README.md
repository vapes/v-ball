# 🎮 V-Ball

A vibrant **Match-3 puzzle game** built with **PixiJS v8** and **TypeScript**, deployed at [vapes.github.io/v-ball](https://vapes.github.io/v-ball/)

## 🎯 Play Now

**[Click here to play!](https://vapes.github.io/v-ball/)**

## ✨ Features

- **Smooth animations** with responsive scaling for mobile and desktop
- **Chain combos** for massive scores as cascades trigger new matches
- **Bonus tiles** that unlock special powers:
  - 🔴 **Line Bombs** (4-match) — clear an entire row or column
  - ⭐ **Color Bombs** (5-match) — destroy all tiles of one color
  - 🎯 **Bomb interactions** — swap bombs together for massive chain reactions
- **Responsive design** with portrait lock hint for mobile
- **Hint system** — auto-suggest the best move after 5 seconds of idle time
- **Replay feature** — revisit any move at 0.25x speed (dev tool)
- **Fair shuffles** — board reshuffle if no valid moves exist

## 🕹️ How to Play

1. **Swap adjacent tiles** by clicking and dragging, or tap two tiles
2. **Match 3 or more** tiles of the same color in a row or column to clear them
3. **Create combos** by clearing tiles that cause others to fall and match again
4. **Earn bonuses**:
   - 4 matching tiles → **Line Bomb** (clears row/column)
   - 5+ matching tiles → **Color Bomb** (clears all of one color)
5. **Trigger bomb chains** by swapping two bombs together
6. **Score points** based on tiles cleared and bonus multipliers

## 🛠️ Build & Deploy

### Commands

```bash
npm run dev      # Start Vite dev server → http://localhost:5173/v-ball/
npm run build    # Type-check + build → dist/
npm run preview  # Serve dist/ locally
```

### Deployment

Push to `main` → **GitHub Actions** builds and deploys to [GitHub Pages](https://vapes.github.io/v-ball/) automatically. No manual steps needed.

## 🏗️ Architecture

- **8×8 grid** of color-matched tiles
- **Two parallel data structures** kept in sync:
  - `grid[][]` — logical game state (used by pure matching logic)
  - `tiles[][]` — visual PixiJS objects
- **Sequential async state machine** in `Board.onSwapRequest()` — handles swap → match → destroy → cascade → fill → check cycle
- **Pure functional matching** — `findMatches()` and `hasValidMoves()` have no side effects
- **Responsive scaling** — automatically adjusts board size to fit viewport (scales container, not internals)

## 📂 Project Structure

```
src/
  main.ts           Bootstrap: init PixiJS + scale to viewport
  constants.ts      All tunable values (grid, colors, timing, scoring)
  types.ts          TileType enum, GridPosition, MatchGroup
  game/
    Board.ts        Central controller — owns both data + visual, orchestrates phases
    Tile.ts         PixiJS Container, handles animations + rendering
    InputHandler.ts Pointer events → SwapRequest (click/drag)
    Animator.ts     Promise-based tweens on PixiJS Ticker
    ScoreManager.ts Score tracking + combo multiplier
  utils/
    matching.ts     Pure functions: findMatches, hasValidMoves, etc.
    random.ts       Grid generation, random tile selection
```

## 🎨 Tech Stack

- **PixiJS v8** — fast 2D WebGL renderer
- **TypeScript** — strict mode, path aliases (`@/`)
- **Vite** — ultra-fast dev server & build
- **ES2020** — modern JavaScript features
- **GitHub Pages** — free static hosting

## 📝 Notes

- **Strict TypeScript** enabled
- **No tests or linter** configured
- **Portrait-lock UI hint** on mobile to encourage vertical orientation
- **Stale file**: `public/index.html` is leftover from old Three.js setup and has no effect

## 🚀 Future Ideas

- Sound effects and music
- Difficulty levels and progression
- Leaderboard with localStorage
- Power-up items (frozen tiles, wild cards)
- Time attack mode

---

**Built with ❤️ using PixiJS and TypeScript**
