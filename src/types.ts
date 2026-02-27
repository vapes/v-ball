export enum TileType {
  Red = 0,
  Blue = 1,
  Green = 2,
  Yellow = 3,
  Purple = 4,
  Orange = 5,
  Pink = 6,
  LineBomb = 7,
  ColorBomb = 8,
}

/** Number of regular (matchable) tile colors. */
export const TILE_TYPE_COUNT = 7;

export type BonusOrientation = "horizontal" | "vertical";

export interface GridPosition {
  row: number;
  col: number;
}

export interface MatchGroup {
  positions: GridPosition[];
  /** Length of the longest straight run that formed this match. */
  length: number;
  /** Direction of the longest run (for line bomb orientation). */
  direction: "horizontal" | "vertical";
}

export interface FallMove {
  fromRow: number;
  toRow: number;
  col: number;
}

export interface SwapRequest {
  a: GridPosition;
  b: GridPosition;
}
