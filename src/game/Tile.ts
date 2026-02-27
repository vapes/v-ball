import { Container, Graphics } from "pixi.js";
import { TILE_SIZE, TILE_RADIUS, TILE_COLORS, CELL_SIZE, BOARD_PADDING } from "../constants";
import { TileType } from "../types";
import type { BonusOrientation } from "../types";
import type { Animator } from "./Animator";

/** Rainbow colors used for the Color Bomb visual. */
const RAINBOW = [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6];

export class Tile {
  readonly container: Container;
  tileType: TileType;
  gridRow: number;
  gridCol: number;

  /**
   * For LineBomb tiles: which axis to clear when detonated.
   * For regular / ColorBomb tiles this is undefined.
   */
  bonusOrientation?: BonusOrientation;

  /**
   * For LineBomb tiles: the underlying color of the tile that created this bomb.
   * Used so the line bomb visually retains a color hint.
   */
  baseColor?: number;

  private gfx: Graphics;

  constructor(type: TileType, row: number, col: number) {
    this.tileType = type;
    this.gridRow = row;
    this.gridCol = col;

    this.container = new Container();
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    this.draw();
    this.setPositionFromGrid();
  }

  /** Pixel position for a given grid cell. */
  static pixelX(col: number): number {
    return BOARD_PADDING + col * CELL_SIZE + TILE_SIZE / 2;
  }

  static pixelY(row: number): number {
    return BOARD_PADDING + row * CELL_SIZE + TILE_SIZE / 2;
  }

  setPositionFromGrid(): void {
    this.container.x = Tile.pixelX(this.gridCol);
    this.container.y = Tile.pixelY(this.gridRow);
  }

  /** Animate swap to another grid position. */
  async animateSwap(toRow: number, toCol: number, animator: Animator, duration: number): Promise<void> {
    const tx = Tile.pixelX(toCol);
    const ty = Tile.pixelY(toRow);
    await animator.animate(
      this.container.position as unknown as Record<string, number>,
      { x: tx, y: ty },
      duration,
    );
    this.gridRow = toRow;
    this.gridCol = toCol;
  }

  /** Animate falling to a new row. */
  async animateFall(toRow: number, animator: Animator, duration: number): Promise<void> {
    const ty = Tile.pixelY(toRow);
    await animator.animate(
      this.container.position as unknown as Record<string, number>,
      { y: ty },
      duration,
    );
    this.gridRow = toRow;
  }

  /** Scale down + fade to destroy. */
  async animateDestroy(animator: Animator, duration: number): Promise<void> {
    await animator.animate(
      this.container.scale as unknown as Record<string, number>,
      { x: 0, y: 0 },
      duration,
    );
  }

  /** Scale up from 0 when spawning. */
  async animateSpawn(animator: Animator, duration: number): Promise<void> {
    this.container.scale.set(0);
    await animator.animate(
      this.container.scale as unknown as Record<string, number>,
      { x: 1, y: 1 },
      duration,
    );
  }

  /** Redraw the tile (called after changing type, e.g. when converting to bonus). */
  redraw(): void {
    this.draw();
  }

  private draw(): void {
    const half = TILE_SIZE / 2;
    this.gfx.clear();

    if (this.tileType === TileType.ColorBomb) {
      this.drawColorBomb(half);
      return;
    }

    if (this.tileType === TileType.LineBomb) {
      this.drawLineBomb(half);
      return;
    }

    // Regular tile
    const color = TILE_COLORS[this.tileType];
    this.gfx
      .roundRect(-half, -half, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
      .fill({ color });

    this.gfx.setStrokeStyle({ width: 2.5, color: 0xffffff, alpha: 0.85 });

    const s = half * 0.5;
    switch (this.tileType) {
      case TileType.Red:
        this.gfx.circle(0, 0, s).stroke();
        break;
      case TileType.Blue:
        this.gfx
          .moveTo(0, -s)
          .lineTo(s, 0)
          .lineTo(0, s)
          .lineTo(-s, 0)
          .closePath()
          .stroke();
        break;
      case TileType.Green:
        this.drawStar(6, s, s * 0.5);
        break;
      case TileType.Yellow:
        this.drawHeart(s);
        break;
      case TileType.Purple:
        this.gfx
          .moveTo(0, -s)
          .lineTo(s, s * 0.8)
          .lineTo(-s, s * 0.8)
          .closePath()
          .stroke();
        break;
      case TileType.Orange:
        this.gfx
          .rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4)
          .stroke();
        break;
      case TileType.Pink:
        this.gfx
          .rect(-s * 0.3, -s, s * 0.6, s * 2)
          .rect(-s, -s * 0.3, s * 2, s * 0.6)
          .stroke();
        break;
    }
  }

  /** Draw a Line Bomb tile: colored background with a directional arrow. */
  private drawLineBomb(half: number): void {
    const bg = this.baseColor ?? 0x888888;

    // Background
    this.gfx
      .roundRect(-half, -half, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
      .fill({ color: bg });

    // Bright border to signal "special"
    this.gfx
      .roundRect(-half, -half, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
      .stroke({ width: 3, color: 0xffffff });

    const s = half * 0.55;

    if (this.bonusOrientation === "horizontal") {
      // Horizontal arrows: ← →
      this.gfx.setStrokeStyle({ width: 3, color: 0xffffff });
      // Left arrow
      this.gfx.moveTo(-s, 0).lineTo(s, 0).stroke();
      this.gfx.moveTo(-s, 0).lineTo(-s * 0.5, -s * 0.4).stroke();
      this.gfx.moveTo(-s, 0).lineTo(-s * 0.5, s * 0.4).stroke();
      // Right arrow
      this.gfx.moveTo(s, 0).lineTo(s * 0.5, -s * 0.4).stroke();
      this.gfx.moveTo(s, 0).lineTo(s * 0.5, s * 0.4).stroke();
    } else {
      // Vertical arrows: ↑ ↓
      this.gfx.setStrokeStyle({ width: 3, color: 0xffffff });
      this.gfx.moveTo(0, -s).lineTo(0, s).stroke();
      this.gfx.moveTo(0, -s).lineTo(-s * 0.4, -s * 0.5).stroke();
      this.gfx.moveTo(0, -s).lineTo(s * 0.4, -s * 0.5).stroke();
      this.gfx.moveTo(0, s).lineTo(-s * 0.4, s * 0.5).stroke();
      this.gfx.moveTo(0, s).lineTo(s * 0.4, s * 0.5).stroke();
    }
  }

  /** Draw a Color Bomb tile: rainbow background with a star. */
  private drawColorBomb(half: number): void {
    // Dark background
    this.gfx
      .roundRect(-half, -half, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
      .fill({ color: 0x222222 });

    // Rainbow ring segments
    const segAngle = (Math.PI * 2) / RAINBOW.length;
    const outer = half * 0.85;
    const inner = half * 0.55;
    for (let i = 0; i < RAINBOW.length; i++) {
      const a1 = segAngle * i - Math.PI / 2;
      const a2 = a1 + segAngle;
      this.gfx
        .moveTo(Math.cos(a1) * inner, Math.sin(a1) * inner)
        .lineTo(Math.cos(a1) * outer, Math.sin(a1) * outer)
        .lineTo(Math.cos(a2) * outer, Math.sin(a2) * outer)
        .lineTo(Math.cos(a2) * inner, Math.sin(a2) * inner)
        .closePath()
        .fill({ color: RAINBOW[i] });
    }

    // White star in center
    this.gfx.setStrokeStyle({ width: 2, color: 0xffffff });
    this.drawStar(5, half * 0.35, half * 0.15);
  }

  private drawStar(points: number, outer: number, inner: number): void {
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI * i) / points - Math.PI / 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) this.gfx.moveTo(x, y);
      else this.gfx.lineTo(x, y);
    }
    this.gfx.closePath().stroke();
  }

  private drawHeart(s: number): void {
    this.gfx
      .moveTo(0, s * 0.6)
      .bezierCurveTo(-s, -s * 0.2, -s * 0.5, -s, 0, -s * 0.4)
      .bezierCurveTo(s * 0.5, -s, s, -s * 0.2, 0, s * 0.6)
      .stroke();
  }
}
