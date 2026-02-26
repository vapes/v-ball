import type { InputState } from "@/types";

/**
 * Captures keyboard state and exposes it as a simple InputState snapshot.
 *
 * Uses `keydown` / `keyup` with `code` (layout-independent) so the controls
 * work regardless of keyboard language.
 */
export class InputManager {
  readonly state: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  };

  constructor() {
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKey);
  }

  private onKey = (e: KeyboardEvent): void => {
    const pressed = e.type === "keydown";

    switch (e.code) {
      case "KeyW":
      case "ArrowUp":
        this.state.forward = pressed;
        break;
      case "KeyS":
      case "ArrowDown":
        this.state.backward = pressed;
        break;
      case "KeyA":
      case "ArrowLeft":
        this.state.left = pressed;
        break;
      case "KeyD":
      case "ArrowRight":
        this.state.right = pressed;
        break;
      case "Space":
        this.state.jump = pressed;
        break;
    }
  };

  dispose(): void {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKey);
  }
}
