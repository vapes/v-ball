import { POINTS_PER_TILE, COMBO_MULTIPLIER } from "../constants";
import { TILE_TYPE_COUNT } from "../types";

const STARTING_COLORS = 4;
const POINTS_PER_NEW_COLOR = 3000;
const BEST_SCORE_KEY = "v-ball-best-score";

export class ScoreManager {
  private _score = 0;
  private _combo = 0;
  private _best: number;
  private el: HTMLElement;
  private bestEl: HTMLElement;

  constructor() {
    this.el = document.getElementById("score")!;
    this.bestEl = document.getElementById("best-score")!;
    this._best = parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10);
    this.render();
  }

  get score(): number {
    return this._score;
  }

  get activeColors(): number {
    return Math.min(TILE_TYPE_COUNT, STARTING_COLORS + Math.floor(this._score / POINTS_PER_NEW_COLOR));
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
    if (this._score > this._best) {
      this._best = this._score;
      localStorage.setItem(BEST_SCORE_KEY, String(this._best));
    }
    this.render();
  }

  private render(): void {
    this.el.textContent = `Score: ${this._score}`;
    this.bestEl.textContent = this._best > 0 ? `Best: ${this._best}` : "";
  }
}
