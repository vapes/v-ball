import { Ticker } from "pixi.js";

interface Tween {
  target: Record<string, number>;
  props: Record<string, { from: number; to: number }>;
  elapsed: number;
  duration: number;
  resolve: () => void;
}

/**
 * Lightweight tween system that runs off a PixiJS Ticker.
 * Each tween linearly interpolates numeric properties on a target object.
 * Returns a Promise that resolves when the animation completes.
 */
export class Animator {
  private tweens: Tween[] = [];

  constructor(ticker: Ticker) {
    ticker.add(() => this.update(ticker.deltaMS / 1000));
  }

  /** Animate numeric properties on `target` over `duration` seconds. */
  animate(
    target: Record<string, number>,
    to: Record<string, number>,
    duration: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const props: Record<string, { from: number; to: number }> = {};
      for (const key of Object.keys(to)) {
        props[key] = { from: target[key], to: to[key] };
      }
      this.tweens.push({ target, props, elapsed: 0, duration, resolve });
    });
  }

  private update(dt: number): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.elapsed += dt;
      const t = Math.min(tw.elapsed / tw.duration, 1);
      // Ease-out quad
      const ease = 1 - (1 - t) * (1 - t);
      for (const key of Object.keys(tw.props)) {
        const p = tw.props[key];
        tw.target[key] = p.from + (p.to - p.from) * ease;
      }
      if (t >= 1) {
        this.tweens.splice(i, 1);
        tw.resolve();
      }
    }
  }
}
