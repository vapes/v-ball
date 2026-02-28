import { Container, Graphics } from "pixi.js";
import {
  GRID_COLS,
  GRID_ROWS,
  CELL_SIZE,
  TILE_SIZE,
  BOARD_PADDING,
  BOARD_WIDTH,
  BOARD_HEIGHT,
  TILE_RADIUS,
  TILE_COLORS,
  SWAP_DURATION,
  FALL_DURATION,
  DESTROY_DURATION,
  SPAWN_DURATION,
  LINE_BOMB_MATCH,
  COLOR_BOMB_MATCH,
  LINE_BOMB_BONUS,
  COLOR_BOMB_BONUS,
  LASER_DURATION,
} from "../constants";
import { TileType } from "../types";
import type { GridPosition, MatchGroup, SwapRequest, BonusOrientation } from "../types";
import { Tile } from "./Tile";
import { Animator } from "./Animator";
import { InputHandler } from "./InputHandler";
import { ScoreManager } from "./ScoreManager";
import { findMatches, hasValidMoves } from "../utils/matching";
import { generateGrid, randomTileType } from "../utils/random";

export class Board {
  readonly container: Container;
  private tileContainer: Container;
  private tiles: (Tile | null)[][] = [];
  private grid: (TileType | null)[][] = [];
  private animator: Animator;
  private input: InputHandler;
  private score: ScoreManager;
  private busy = false;

  /** Tracks the position of the last player-initiated swap (tile B's destination). */
  private lastSwapPos: GridPosition | null = null;

  constructor(animator: Animator) {
    this.animator = animator;
    this.container = new Container();
    this.tileContainer = new Container();
    this.score = new ScoreManager();

    this.drawBackground();
    this.container.addChild(this.tileContainer);

    this.input = new InputHandler(this.container, (req) => this.onSwapRequest(req));

    this.initGrid();
  }

  private drawBackground(): void {
    const bg = new Graphics();
    bg.roundRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT, 16)
      .fill({ color: 0x16213e, alpha: 0.8 });

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = BOARD_PADDING + c * CELL_SIZE;
        const y = BOARD_PADDING + r * CELL_SIZE;
        bg.roundRect(x, y, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
          .fill({ color: 0x0f3460, alpha: 0.5 });
      }
    }

    this.container.addChild(bg);
  }

  private initGrid(): void {
    const data = generateGrid(this.score.activeColors);
    this.grid = data;
    this.tiles = [];

    for (let r = 0; r < GRID_ROWS; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = new Tile(data[r][c], r, c);
        this.tiles[r][c] = tile;
        this.tileContainer.addChild(tile.container);
      }
    }
  }

  /**
   * Build a grid where line bomb positions use their base color for matching.
   * This lets findMatches/hasValidMoves treat line bombs as their original color.
   */
  private buildMatchableGrid(): (TileType | null)[][] {
    const matchGrid: (TileType | null)[][] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      matchGrid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        if (tile?.tileType === TileType.LineBomb && tile.baseType !== undefined) {
          matchGrid[r][c] = tile.baseType;
        } else {
          matchGrid[r][c] = this.grid[r][c];
        }
      }
    }
    return matchGrid;
  }

  // ─── Main swap handler ─────────────────────────────────────────────

  private async onSwapRequest(req: SwapRequest): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.input.setEnabled(false);

    const { a, b } = req;
    const tileA = this.tiles[a.row][a.col];
    const tileB = this.tiles[b.row][b.col];
    if (!tileA || !tileB) {
      this.busy = false;
      this.input.setEnabled(true);
      return;
    }

    // ── Color Bomb swap ──────────────────────────────────────────────
    const aIsColorBomb = tileA.tileType === TileType.ColorBomb;
    const bIsColorBomb = tileB.tileType === TileType.ColorBomb;

    if (aIsColorBomb || bIsColorBomb) {
      // Animate the swap visually
      await Promise.all([
        tileA.animateSwap(b.row, b.col, this.animator, SWAP_DURATION),
        tileB.animateSwap(a.row, a.col, this.animator, SWAP_DURATION),
      ]);
      this.swapInGrid(a, b);
      this.tiles[a.row][a.col] = tileB;
      this.tiles[b.row][b.col] = tileA;

      this.score.resetCombo();

      if (aIsColorBomb && bIsColorBomb) {
        // Two color bombs: clear entire board
        await this.detonateEntireBoard();
      } else {
        // One color bomb + one regular/line bomb tile
        const bombPos = aIsColorBomb ? b : a;
        const otherPos = aIsColorBomb ? a : b;
        const otherTile = this.tiles[otherPos.row][otherPos.col]!;
        const targetType = otherTile.tileType;

        if (targetType === TileType.LineBomb) {
          // Color bomb + line bomb: destroy both
          await this.destroySingleTile(bombPos);
          await this.destroySingleTile(otherPos);
        } else {
          // Fire laser from bomb position and destroy all tiles of the target color
          await this.detonateColorBomb(targetType, bombPos);
          // Then destroy the color bomb itself
          await this.destroySingleTile(bombPos);
        }
      }

      await this.cascade();
      await this.fillEmpty();

      // Chain matches after color bomb
      const newMatches = findMatches(this.buildMatchableGrid());
      if (newMatches.length > 0) {
        await this.processMatches(newMatches, null);
      }

      if (!hasValidMoves(this.buildMatchableGrid())) {
        this.showGameOver();
        return;
      }

      this.busy = false;
      this.input.setEnabled(true);
      return;
    }

    // ── Normal swap ──────────────────────────────────────────────────
    await Promise.all([
      tileA.animateSwap(b.row, b.col, this.animator, SWAP_DURATION),
      tileB.animateSwap(a.row, a.col, this.animator, SWAP_DURATION),
    ]);

    this.swapInGrid(a, b);
    this.tiles[a.row][a.col] = tileB;
    this.tiles[b.row][b.col] = tileA;

    const matches = findMatches(this.buildMatchableGrid());
    if (matches.length === 0) {
      // Invalid move — swap back
      await Promise.all([
        tileA.animateSwap(a.row, a.col, this.animator, SWAP_DURATION),
        tileB.animateSwap(b.row, b.col, this.animator, SWAP_DURATION),
      ]);
      this.swapInGrid(a, b);
      this.tiles[a.row][a.col] = tileA;
      this.tiles[b.row][b.col] = tileB;
    } else {
      this.score.resetCombo();
      // Pass both swap positions so bonus tiles spawn at the player's swap position
      this.lastSwapPos = b; // "b" is where the player dragged to
      await this.processMatches(matches, { a, b });
      this.lastSwapPos = null;
    }

    if (!hasValidMoves(this.buildMatchableGrid())) {
      this.showGameOver();
      return;
    }

    this.busy = false;
    this.input.setEnabled(true);
  }

  private swapInGrid(a: GridPosition, b: GridPosition): void {
    const tmp = this.grid[a.row][a.col];
    this.grid[a.row][a.col] = this.grid[b.row][b.col];
    this.grid[b.row][b.col] = tmp;
  }

  // ─── Process matches (with bonus spawning) ─────────────────────────

  private async processMatches(
    matches: MatchGroup[],
    swapPositions: { a: GridPosition; b: GridPosition } | null,
  ): Promise<void> {
    // Collect all positions to destroy (de-duped)
    const destroySet = new Set<string>();
    const allPositions: GridPosition[] = [];
    for (const m of matches) {
      for (const p of m.positions) {
        const k = `${p.row},${p.col}`;
        if (!destroySet.has(k)) {
          destroySet.add(k);
          allPositions.push(p);
        }
      }
    }

    // Determine bonus tiles to spawn BEFORE destroying
    const bonuses = this.determineBonuses(matches, swapPositions);

    // Award score
    this.score.addMatch(allPositions.length);

    // Animate destruction (skip bonus positions and line bombs — bombs detonate separately)
    const bonusPosKeys = new Set(bonuses.map((b) => `${b.row},${b.col}`));

    const destroyPromises: Promise<void>[] = [];
    const triggeredBombs: GridPosition[] = [];

    for (const pos of allPositions) {
      const tile = this.tiles[pos.row][pos.col];
      if (!tile) continue;

      // Line bombs in a match are detonated separately — skip destruction
      if (tile.tileType === TileType.LineBomb) {
        triggeredBombs.push({ row: pos.row, col: pos.col });
        continue;
      }

      // Skip destruction animation if a bonus tile will replace this cell
      if (bonusPosKeys.has(`${pos.row},${pos.col}`)) continue;

      destroyPromises.push(tile.animateDestroy(this.animator, DESTROY_DURATION));
    }
    await Promise.all(destroyPromises);

    // Remove destroyed tiles from both arrays (except bonus positions and line bombs)
    for (const pos of allPositions) {
      if (bonusPosKeys.has(`${pos.row},${pos.col}`)) continue;
      const tile = this.tiles[pos.row][pos.col];
      if (tile?.tileType === TileType.LineBomb) continue; // kept for detonation
      if (tile) {
        this.tileContainer.removeChild(tile.container);
      }
      this.tiles[pos.row][pos.col] = null;
      this.grid[pos.row][pos.col] = null;
    }

    // Detonate line bombs that were caught in the match (before spawning bonuses)
    for (const bp of triggeredBombs) {
      if (!this.tiles[bp.row][bp.col]) continue; // already detonated via chain
      await this.detonateLineBomb(bp);
    }

    // Spawn bonus tiles in-place
    for (const bonus of bonuses) {
      const existing = this.tiles[bonus.row][bonus.col];
      if (existing) {
        this.tileContainer.removeChild(existing.container);
      }
      const tile = new Tile(bonus.type, bonus.row, bonus.col);
      if (bonus.type === TileType.LineBomb) {
        tile.bonusOrientation = bonus.orientation;
        tile.baseColor = bonus.baseColor;
        tile.baseType = bonus.baseType;
        tile.redraw();
      }
      this.tiles[bonus.row][bonus.col] = tile;
      this.grid[bonus.row][bonus.col] = bonus.type;
      this.tileContainer.addChild(tile.container);
      await tile.animateSpawn(this.animator, SPAWN_DURATION);
    }

    // Cascade and fill
    await this.cascade();
    await this.fillEmpty();

    // Chain matches (no swap positions for cascaded matches)
    const newMatches = findMatches(this.buildMatchableGrid());
    if (newMatches.length > 0) {
      await this.processMatches(newMatches, null);
    }
  }

  // ─── Determine which bonuses to spawn ──────────────────────────────

  private determineBonuses(
    matches: MatchGroup[],
    swapPositions: { a: GridPosition; b: GridPosition } | null,
  ): { row: number; col: number; type: TileType; orientation?: BonusOrientation; baseColor?: number; baseType?: TileType }[] {
    const bonuses: { row: number; col: number; type: TileType; orientation?: BonusOrientation; baseColor?: number; baseType?: TileType }[] = [];
    const usedPositions = new Set<string>();

    for (const match of matches) {
      if (match.length < LINE_BOMB_MATCH) continue;

      const spawnPos = this.pickBonusPosition(match, swapPositions, usedPositions);
      if (!spawnPos) continue;
      usedPositions.add(`${spawnPos.row},${spawnPos.col}`);

      // Determine the base color from the match (line bombs use their baseType)
      const samplePos = match.positions[0];
      const sampleTile = this.tiles[samplePos.row][samplePos.col];
      const sampleType: TileType = (sampleTile?.tileType === TileType.LineBomb && sampleTile.baseType !== undefined)
        ? sampleTile.baseType
        : this.grid[samplePos.row][samplePos.col] as TileType;
      const baseColor = TILE_COLORS[sampleType] ?? 0x888888;

      if (match.length >= COLOR_BOMB_MATCH) {
        bonuses.push({ row: spawnPos.row, col: spawnPos.col, type: TileType.ColorBomb });
      } else {
        // match.length === 4 → Line Bomb
        bonuses.push({
          row: spawnPos.row,
          col: spawnPos.col,
          type: TileType.LineBomb,
          orientation: match.direction,
          baseColor,
          baseType: sampleType,
        });
      }
    }

    return bonuses;
  }

  /**
   * Pick the grid position where a bonus tile should appear.
   * Prefers the player's swap destination if it's part of this match;
   * otherwise falls back to the swap origin, then the middle of the run.
   */
  private pickBonusPosition(
    match: MatchGroup,
    swapPositions: { a: GridPosition; b: GridPosition } | null,
    usedPositions: Set<string>,
  ): GridPosition | null {
    const inMatch = (p: GridPosition) =>
      match.positions.some((mp) => mp.row === p.row && mp.col === p.col);
    const notUsed = (p: GridPosition) => !usedPositions.has(`${p.row},${p.col}`);

    if (swapPositions) {
      // Prefer swap destination (b)
      if (inMatch(swapPositions.b) && notUsed(swapPositions.b)) return swapPositions.b;
      // Then swap origin (a)
      if (inMatch(swapPositions.a) && notUsed(swapPositions.a)) return swapPositions.a;
    }

    // Fallback: middle of the run
    const mid = Math.floor(match.positions.length / 2);
    for (let offset = 0; offset < match.positions.length; offset++) {
      const idx = (mid + offset) % match.positions.length;
      if (notUsed(match.positions[idx])) return match.positions[idx];
    }

    return null;
  }

  // ─── Bomb detonation ───────────────────────────────────────────────

  /**
   * Detonate a Line Bomb at `pos`, clearing its entire row or column.
   * If other bombs are hit, they chain-detonate.
   */
  private async detonateLineBomb(pos: GridPosition): Promise<void> {
    const tile = this.tiles[pos.row][pos.col];
    if (!tile) return;

    const orientation = tile.bonusOrientation ?? "horizontal";

    // Destroy the bomb tile itself
    await tile.animateDestroy(this.animator, DESTROY_DURATION);
    this.tileContainer.removeChild(tile.container);
    this.tiles[pos.row][pos.col] = null;
    this.grid[pos.row][pos.col] = null;

    this.score.addMatch(LINE_BOMB_BONUS);

    // Collect tiles in the line
    const targets: GridPosition[] = [];
    if (orientation === "horizontal") {
      for (let c = 0; c < GRID_COLS; c++) {
        if (c === pos.col) continue; // already removed
        if (this.tiles[pos.row][c]) targets.push({ row: pos.row, col: c });
      }
    } else {
      for (let r = 0; r < GRID_ROWS; r++) {
        if (r === pos.row) continue;
        if (this.tiles[r][pos.col]) targets.push({ row: r, col: pos.col });
      }
    }

    // Find chained bombs before destroying
    const chainedBombs: GridPosition[] = [];
    for (const t of targets) {
      const tt = this.tiles[t.row][t.col];
      if (tt && (tt.tileType === TileType.LineBomb || tt.tileType === TileType.ColorBomb)) {
        chainedBombs.push({ row: t.row, col: t.col });
      }
    }

    // Animate destruction of all targets
    const promises: Promise<void>[] = [];
    for (const t of targets) {
      const tt = this.tiles[t.row][t.col];
      if (tt && tt.tileType !== TileType.LineBomb && tt.tileType !== TileType.ColorBomb) {
        promises.push(tt.animateDestroy(this.animator, DESTROY_DURATION));
      }
    }
    await Promise.all(promises);

    // Remove non-bomb targets
    for (const t of targets) {
      const tt = this.tiles[t.row][t.col];
      if (tt && tt.tileType !== TileType.LineBomb && tt.tileType !== TileType.ColorBomb) {
        this.tileContainer.removeChild(tt.container);
        this.tiles[t.row][t.col] = null;
        this.grid[t.row][t.col] = null;
      }
    }

    // Chain-detonate any bombs hit
    for (const bp of chainedBombs) {
      if (!this.tiles[bp.row][bp.col]) continue;
      if (this.tiles[bp.row][bp.col]!.tileType === TileType.LineBomb) {
        await this.detonateLineBomb(bp);
      } else if (this.tiles[bp.row][bp.col]!.tileType === TileType.ColorBomb) {
        // Pick a random color to clear
        const randomColor = this.pickRandomColorOnBoard();
        if (randomColor !== null) {
          await this.detonateColorBomb(randomColor, bp);
        }
        await this.destroySingleTile(bp);
      }
    }
  }

  /** Create laser beam graphics from a source position to all targets. */
  private createLaserBeams(
    sourcePos: GridPosition,
    targets: GridPosition[],
    color: number,
  ): Graphics {
    const gfx = new Graphics();
    const sx = Tile.pixelX(sourcePos.col);
    const sy = Tile.pixelY(sourcePos.row);

    for (const t of targets) {
      const tx = Tile.pixelX(t.col);
      const ty = Tile.pixelY(t.row);

      // Outer glow
      gfx.moveTo(sx, sy).lineTo(tx, ty)
        .stroke({ width: 8, color, alpha: 0.3 });
      // Core beam
      gfx.moveTo(sx, sy).lineTo(tx, ty)
        .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
      // Impact dot at target
      gfx.circle(tx, ty, 6)
        .fill({ color, alpha: 0.5 });
    }

    // Source flash
    gfx.circle(sx, sy, 10)
      .fill({ color: 0xffffff, alpha: 0.7 });

    return gfx;
  }

  /**
   * Detonate a Color Bomb: destroy all tiles of `targetType` on the board.
   * If any of those tiles are bombs, chain-detonate them.
   */
  private async detonateColorBomb(targetType: TileType, sourcePos?: GridPosition): Promise<void> {
    const targets: GridPosition[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === targetType && this.tiles[r][c]) {
          targets.push({ row: r, col: c });
        }
      }
    }

    if (targets.length === 0) return;

    // Fire laser beams from source to all targets
    let laserGfx: Graphics | null = null;
    if (sourcePos) {
      laserGfx = this.createLaserBeams(sourcePos, targets, TILE_COLORS[targetType]);
      laserGfx.alpha = 0;
      this.tileContainer.addChild(laserGfx);
      await this.animator.animate(
        laserGfx as unknown as Record<string, number>,
        { alpha: 1 },
        LASER_DURATION,
      );
    }

    this.score.addMatch(targets.length + COLOR_BOMB_BONUS);

    // Find chained bombs
    const chainedBombs: GridPosition[] = [];
    for (const t of targets) {
      const tile = this.tiles[t.row][t.col];
      if (tile && (tile.tileType === TileType.LineBomb || tile.tileType === TileType.ColorBomb)) {
        chainedBombs.push({ row: t.row, col: t.col });
      }
    }

    // Destroy non-bomb targets
    const promises: Promise<void>[] = [];
    for (const t of targets) {
      const tile = this.tiles[t.row][t.col];
      if (tile && tile.tileType !== TileType.LineBomb && tile.tileType !== TileType.ColorBomb) {
        promises.push(tile.animateDestroy(this.animator, DESTROY_DURATION));
      }
    }
    await Promise.all(promises);

    for (const t of targets) {
      const tile = this.tiles[t.row][t.col];
      if (tile && tile.tileType !== TileType.LineBomb && tile.tileType !== TileType.ColorBomb) {
        this.tileContainer.removeChild(tile.container);
        this.tiles[t.row][t.col] = null;
        this.grid[t.row][t.col] = null;
      }
    }

    // Fade and remove laser beams
    if (laserGfx) {
      await this.animator.animate(
        laserGfx as unknown as Record<string, number>,
        { alpha: 0 },
        LASER_DURATION,
      );
      this.tileContainer.removeChild(laserGfx);
    }

    // Chain detonate
    for (const bp of chainedBombs) {
      if (!this.tiles[bp.row][bp.col]) continue;
      if (this.tiles[bp.row][bp.col]!.tileType === TileType.LineBomb) {
        await this.detonateLineBomb(bp);
      } else if (this.tiles[bp.row][bp.col]!.tileType === TileType.ColorBomb) {
        const randomColor = this.pickRandomColorOnBoard();
        if (randomColor !== null) {
          await this.detonateColorBomb(randomColor, bp);
        }
        await this.destroySingleTile(bp);
      }
    }
  }

  /** Destroy every tile on the board (two Color Bombs swapped together). */
  private async detonateEntireBoard(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        if (tile) {
          promises.push(tile.animateDestroy(this.animator, DESTROY_DURATION));
        }
      }
    }
    await Promise.all(promises);

    let count = 0;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        if (tile) {
          this.tileContainer.removeChild(tile.container);
          count++;
        }
        this.tiles[r][c] = null;
        this.grid[r][c] = null;
      }
    }
    this.score.addMatch(count);
  }

  /** Destroy a single tile at a given position. */
  private async destroySingleTile(pos: GridPosition): Promise<void> {
    const tile = this.tiles[pos.row][pos.col];
    if (!tile) return;
    await tile.animateDestroy(this.animator, DESTROY_DURATION);
    this.tileContainer.removeChild(tile.container);
    this.tiles[pos.row][pos.col] = null;
    this.grid[pos.row][pos.col] = null;
  }

  /** Pick a random regular color that currently exists on the board. */
  private pickRandomColorOnBoard(): TileType | null {
    const colors = new Set<TileType>();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const t = this.grid[r][c];
        if (t !== null && t !== TileType.LineBomb && t !== TileType.ColorBomb) {
          colors.add(t);
        }
      }
    }
    if (colors.size === 0) return null;
    const arr = Array.from(colors);
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Cascade & fill (unchanged logic) ──────────────────────────────

  private async cascade(): Promise<void> {
    const fallPromises: Promise<void>[] = [];

    for (let c = 0; c < GRID_COLS; c++) {
      let emptyRow = GRID_ROWS - 1;

      for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (this.tiles[r][c] !== null) {
          if (r !== emptyRow) {
            const tile = this.tiles[r][c]!;
            const distance = emptyRow - r;

            this.tiles[emptyRow][c] = tile;
            this.grid[emptyRow][c] = tile.tileType;
            this.tiles[r][c] = null;
            this.grid[r][c] = null;

            tile.gridRow = emptyRow;
            tile.gridCol = c;
            fallPromises.push(
              tile.animateFall(emptyRow, this.animator, FALL_DURATION * distance),
            );
          }
          emptyRow--;
        }
      }
    }

    await Promise.all(fallPromises);
  }

  private async fillEmpty(): Promise<void> {
    const spawnPromises: Promise<void>[] = [];

    for (let c = 0; c < GRID_COLS; c++) {
      let spawned = 0;
      for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (this.tiles[r][c] === null) {
          const type = randomTileType(this.score.activeColors);
          this.grid[r][c] = type;

          const tile = new Tile(type, r, c);
          tile.container.y = Tile.pixelY(-1 - spawned);
          tile.container.x = Tile.pixelX(c);
          this.tiles[r][c] = tile;
          this.tileContainer.addChild(tile.container);

          const distance = r + 1 + spawned;
          spawnPromises.push(
            tile.animateFall(r, this.animator, FALL_DURATION * distance),
          );
          spawned++;
        }
      }
    }

    await Promise.all(spawnPromises);
  }

  private showGameOver(): void {
    const overlay = document.getElementById("game-over")!;
    overlay.classList.add("show");
  }

  private async reshuffleBoard(): Promise<void> {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        if (tile) {
          this.tileContainer.removeChild(tile.container);
        }
      }
    }

    const data = generateGrid(this.score.activeColors);
    this.grid = data;
    this.tiles = [];

    const spawnPromises: Promise<void>[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      this.tiles[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = new Tile(data[r][c], r, c);
        tile.container.scale.set(0);
        this.tiles[r][c] = tile;
        this.tileContainer.addChild(tile.container);
        spawnPromises.push(tile.animateSpawn(this.animator, SPAWN_DURATION));
      }
    }
    await Promise.all(spawnPromises);
  }
}
