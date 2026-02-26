export enum TileType {
  Red = 0,
  Blue = 1,
  Green = 2,
  Yellow = 3,
  Purple = 4,
  Orange = 5,
}

export const TILE_TYPE_COUNT = 6;

export interface GridPosition {
  row: number;
  col: number;
}

export interface MatchGroup {
  positions: GridPosition[];
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
