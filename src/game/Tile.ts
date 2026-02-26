import { Container, Graphics } from "pixi.js";
import { TILE_SIZE, TILE_RADIUS, TILE_COLORS, CELL_SIZE, BOARD_PADDING } from "../constants";
import { TileType } from "../types";
import type { Animator } from "./Animator";

export class Tile {
  readonly container: Container;
  tileType: TileType;
  gridRow: number;
  gridCol: number;

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

  private draw(): void {
    const color = TILE_COLORS[this.tileType];
    const half = TILE_SIZE / 2;

    this.gfx.clear();

    // Background rounded rect
    this.gfx
      .roundRect(-half, -half, TILE_SIZE, TILE_SIZE, TILE_RADIUS)
      .fill({ color });

    // Draw a distinct shape per type
    this.gfx.setStrokeStyle({ width: 2.5, color: 0xffffff, alpha: 0.85 });

    const s = half * 0.5; // shape half-size
    switch (this.tileType) {
      case TileType.Red: // Circle
        this.gfx.circle(0, 0, s).stroke();
        break;
      case TileType.Blue: // Diamond
        this.gfx
          .moveTo(0, -s)
          .lineTo(s, 0)
          .lineTo(0, s)
          .lineTo(-s, 0)
          .closePath()
          .stroke();
        break;
      case TileType.Green: // Star (6-point simple)
        this.drawStar(6, s, s * 0.5);
        break;
      case TileType.Yellow: // Heart (simplified)
        this.drawHeart(s);
        break;
      case TileType.Purple: // Triangle
        this.gfx
          .moveTo(0, -s)
          .lineTo(s, s * 0.8)
          .lineTo(-s, s * 0.8)
          .closePath()
          .stroke();
        break;
      case TileType.Orange: // Square
        this.gfx
          .rect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4)
          .stroke();
        break;
      case TileType.Pink: // Cross / plus
        this.gfx
          .rect(-s * 0.3, -s, s * 0.6, s * 2)
          .rect(-s, -s * 0.3, s * 2, s * 0.6)
          .stroke();
        break;
    }
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
    // Simple heart approximation
    this.gfx
      .moveTo(0, s * 0.6)
      .bezierCurveTo(-s, -s * 0.2, -s * 0.5, -s, 0, -s * 0.4)
      .bezierCurveTo(s * 0.5, -s, s, -s * 0.2, 0, s * 0.6)
      .stroke();
  }
}
