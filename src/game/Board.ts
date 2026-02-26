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
  SWAP_DURATION,
  FALL_DURATION,
  DESTROY_DURATION,
  SPAWN_DURATION,
} from "../constants";
import { TileType } from "../types";
import type { GridPosition, SwapRequest } from "../types";
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

    // Grid lines / cell backgrounds
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

    // Animate swap
    await Promise.all([
      tileA.animateSwap(b.row, b.col, this.animator, SWAP_DURATION),
      tileB.animateSwap(a.row, a.col, this.animator, SWAP_DURATION),
    ]);

    // Apply swap in data
    this.swapInGrid(a, b);
    this.tiles[a.row][a.col] = tileB;
    this.tiles[b.row][b.col] = tileA;

    // Check matches
    const matches = findMatches(this.grid);
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
      await this.processMatches(matches);
    }

    // Check for valid moves remaining
    if (!hasValidMoves(this.grid)) {
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

  private async processMatches(matches: ReturnType<typeof findMatches>): Promise<void> {
    // Destroy matched tiles
    const positions = matches.flatMap((m) => m.positions);
    this.score.addMatch(positions.length);

    const destroyPromises: Promise<void>[] = [];
    for (const pos of positions) {
      const tile = this.tiles[pos.row][pos.col];
      if (tile) {
        destroyPromises.push(tile.animateDestroy(this.animator, DESTROY_DURATION));
      }
    }
    await Promise.all(destroyPromises);

    // Remove destroyed tiles
    for (const pos of positions) {
      const tile = this.tiles[pos.row][pos.col];
      if (tile) {
        this.tileContainer.removeChild(tile.container);
      }
      this.tiles[pos.row][pos.col] = null;
      this.grid[pos.row][pos.col] = null;
    }

    // Cascade: move tiles down to fill gaps
    await this.cascade();

    // Fill empty cells from top
    await this.fillEmpty();

    // Check for chain matches
    const newMatches = findMatches(this.grid);
    if (newMatches.length > 0) {
      await this.processMatches(newMatches);
    }
  }

  private async cascade(): Promise<void> {
    const fallPromises: Promise<void>[] = [];

    for (let c = 0; c < GRID_COLS; c++) {
      let emptyRow = GRID_ROWS - 1;

      for (let r = GRID_ROWS - 1; r >= 0; r--) {
        if (this.tiles[r][c] !== null) {
          if (r !== emptyRow) {
            const tile = this.tiles[r][c]!;
            const distance = emptyRow - r;

            // Move in arrays
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
          // Start above the board
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
    // Remove all tiles
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r][c];
        if (tile) {
          this.tileContainer.removeChild(tile.container);
        }
      }
    }

    // Re-generate
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
