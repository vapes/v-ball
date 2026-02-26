import { Container, FederatedPointerEvent } from "pixi.js";
import { CELL_SIZE, BOARD_PADDING, TILE_SIZE, GRID_COLS, GRID_ROWS } from "../constants";
import type { GridPosition, SwapRequest } from "../types";

export type SwapCallback = (req: SwapRequest) => void;

const SWIPE_THRESHOLD = TILE_SIZE * 0.3;

/**
 * Handles pointer input on the board.
 * Swipe-only: drag any tile in a cardinal direction to swap with its neighbor.
 */
export class InputHandler {
  private enabled = true;
  private onSwap: SwapCallback;
  private boardContainer: Container;
  private pointerDown = false;
  private downPos: GridPosition | null = null;
  private downPixel: { x: number; y: number } | null = null;
  private swiped = false;

  constructor(boardContainer: Container, onSwap: SwapCallback) {
    this.boardContainer = boardContainer;
    this.onSwap = onSwap;

    boardContainer.eventMode = "static";
    boardContainer.on("pointerdown", this.onPointerDown, this);
    boardContainer.on("pointermove", this.onPointerMove, this);
    boardContainer.on("pointerup", this.onPointerUp, this);
    boardContainer.on("pointerupoutside", this.onPointerUp, this);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.reset();
  }

  private reset(): void {
    this.pointerDown = false;
    this.downPos = null;
    this.downPixel = null;
    this.swiped = false;
  }

  private hitTest(e: FederatedPointerEvent): GridPosition | null {
    const local = this.boardContainer.toLocal(e.global);
    const col = Math.floor((local.x - BOARD_PADDING) / CELL_SIZE);
    const row = Math.floor((local.y - BOARD_PADDING) / CELL_SIZE);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
    const inCellX = (local.x - BOARD_PADDING) - col * CELL_SIZE;
    const inCellY = (local.y - BOARD_PADDING) - row * CELL_SIZE;
    if (inCellX > TILE_SIZE || inCellY > TILE_SIZE) return null;
    return { row, col };
  }

  private trySwipeFrom(pixel: { x: number; y: number }): void {
    if (!this.downPos || !this.downPixel || this.swiped) return;
    const dx = pixel.x - this.downPixel.x;
    const dy = pixel.y - this.downPixel.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < SWIPE_THRESHOLD && ady < SWIPE_THRESHOLD) return;

    this.swiped = true;
    const a = this.downPos;
    let b: GridPosition;
    if (adx > ady) {
      b = { row: a.row, col: a.col + (dx > 0 ? 1 : -1) };
    } else {
      b = { row: a.row + (dy > 0 ? 1 : -1), col: a.col };
    }
    if (b.row >= 0 && b.row < GRID_ROWS && b.col >= 0 && b.col < GRID_COLS) {
      this.onSwap({ a, b });
    }
  }

  private onPointerDown = (e: FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const pos = this.hitTest(e);
    if (!pos) return;
    const local = this.boardContainer.toLocal(e.global);
    this.pointerDown = true;
    this.downPos = pos;
    this.downPixel = { x: local.x, y: local.y };
    this.swiped = false;
  };

  private onPointerMove = (e: FederatedPointerEvent): void => {
    if (!this.enabled || !this.pointerDown) return;
    const local = this.boardContainer.toLocal(e.global);
    this.trySwipeFrom(local);
  };

  private onPointerUp = (e: FederatedPointerEvent): void => {
    if (!this.enabled || !this.pointerDown) {
      this.reset();
      return;
    }
    const local = this.boardContainer.toLocal(e.global);
    this.trySwipeFrom(local);
    this.reset();
  };
}
