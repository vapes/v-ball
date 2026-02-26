import { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { CELL_SIZE, BOARD_PADDING, TILE_SIZE, GRID_COLS, GRID_ROWS } from "../constants";
import type { GridPosition, SwapRequest } from "../types";

export type SwapCallback = (req: SwapRequest) => void;

/**
 * Handles pointer input on the board.
 * Supports two interaction modes:
 * 1. Click tile A, then click adjacent tile B
 * 2. Click and drag/swipe to an adjacent tile
 */
export class InputHandler {
  private selected: GridPosition | null = null;
  private enabled = true;
  private onSwap: SwapCallback;
  private boardContainer: Container;
  private highlight: Container;
  private pointerDown = false;
  private downPos: GridPosition | null = null;

  constructor(boardContainer: Container, onSwap: SwapCallback) {
    this.boardContainer = boardContainer;
    this.onSwap = onSwap;

    // Selection highlight
    this.highlight = new Container();
    this.highlight.visible = false;
    boardContainer.addChild(this.highlight);

    const g = new Graphics();
    const half = TILE_SIZE / 2 + 3;
    g.roundRect(-half, -half, half * 2, half * 2, 12)
      .stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
    this.highlight.addChild(g);

    boardContainer.eventMode = "static";
    boardContainer.on("pointerdown", this.onPointerDown, this);
    boardContainer.on("pointerup", this.onPointerUp, this);
    boardContainer.on("pointerupoutside", this.onPointerUp, this);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.clearSelection();
    }
  }

  clearSelection(): void {
    this.selected = null;
    this.highlight.visible = false;
  }

  private hitTest(e: FederatedPointerEvent): GridPosition | null {
    const local = this.boardContainer.toLocal(e.global);
    const col = Math.floor((local.x - BOARD_PADDING) / CELL_SIZE);
    const row = Math.floor((local.y - BOARD_PADDING) / CELL_SIZE);
    if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;

    // Check within tile bounds (not in gap)
    const inCellX = (local.x - BOARD_PADDING) - col * CELL_SIZE;
    const inCellY = (local.y - BOARD_PADDING) - row * CELL_SIZE;
    if (inCellX > TILE_SIZE || inCellY > TILE_SIZE) return null;

    return { row, col };
  }

  private onPointerDown = (e: FederatedPointerEvent): void => {
    if (!this.enabled) return;
    const pos = this.hitTest(e);
    if (!pos) return;

    this.pointerDown = true;
    this.downPos = pos;

    if (this.selected) {
      if (this.isAdjacent(this.selected, pos)) {
        this.onSwap({ a: this.selected, b: pos });
        this.clearSelection();
        return;
      }
    }

    this.select(pos);
  };

  private onPointerUp = (e: FederatedPointerEvent): void => {
    if (!this.enabled || !this.pointerDown || !this.downPos) {
      this.pointerDown = false;
      this.downPos = null;
      return;
    }

    const pos = this.hitTest(e);
    this.pointerDown = false;

    if (pos && this.downPos && this.isAdjacent(this.downPos, pos)) {
      this.onSwap({ a: this.downPos, b: pos });
      this.clearSelection();
    }

    this.downPos = null;
  };

  private select(pos: GridPosition): void {
    this.selected = pos;
    this.highlight.visible = true;
    this.highlight.x = BOARD_PADDING + pos.col * CELL_SIZE + TILE_SIZE / 2;
    this.highlight.y = BOARD_PADDING + pos.row * CELL_SIZE + TILE_SIZE / 2;
  }

  private isAdjacent(a: GridPosition, b: GridPosition): boolean {
    const dr = Math.abs(a.row - b.row);
    const dc = Math.abs(a.col - b.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  }
}
