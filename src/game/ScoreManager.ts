import { POINTS_PER_TILE, COMBO_MULTIPLIER } from "../constants";

export class ScoreManager {
  private _score = 0;
  private _combo = 0;
  private el: HTMLElement;

  constructor() {
    this.el = document.getElementById("score")!;
    this.render();
  }

  get score(): number {
    return this._score;
  }

  /** Call at the start of each player-initiated swap. */
  resetCombo(): void {
    this._combo = 0;
  }

  /** Award points for a set of matched tiles. Increments combo. */
  addMatch(tileCount: number): void {
    const multiplier = Math.pow(COMBO_MULTIPLIER, this._combo);
    this._score += Math.round(tileCount * POINTS_PER_TILE * multiplier);
    this._combo++;
    this.render();
  }

  private render(): void {
    this.el.textContent = `Score: ${this._score}`;
  }
}
