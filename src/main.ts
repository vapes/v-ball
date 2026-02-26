import { Application } from "pixi.js";
import { BOARD_WIDTH, BOARD_HEIGHT } from "./constants";
import { Animator } from "./game/Animator";
import { Board } from "./game/Board";

/** Height reserved at the top for the score bar (px, before scaling). */
const SCORE_BAR_HEIGHT = 60;
/** Horizontal and vertical margin around the board (px). */
const MARGIN = 10;

async function main(): Promise<void> {
  // Try to lock the screen to portrait (supported on Android Chrome, PWAs)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (screen.orientation as any).lock("portrait");
  } catch {
    // Not supported on all browsers — the CSS overlay handles the UX
  }

  const app = new Application();

  await app.init({
    background: 0x1a1a2e,
    resizeTo: window,
    antialias: true,
  });

  const appEl = document.getElementById("app")!;
  appEl.appendChild(app.canvas as HTMLCanvasElement);

  const animator = new Animator(app.ticker);
  const board = new Board(animator);
  app.stage.addChild(board.container);

  const fitBoard = (): void => {
    const availW = app.screen.width - MARGIN * 2;
    const availH = app.screen.height - SCORE_BAR_HEIGHT - MARGIN;

    const scale = Math.min(availW / BOARD_WIDTH, availH / BOARD_HEIGHT, 1);

    board.container.scale.set(scale);

    // Center horizontally; place below score bar
    board.container.x = Math.round((app.screen.width - BOARD_WIDTH * scale) / 2);
    board.container.y = Math.round(
      SCORE_BAR_HEIGHT + (availH - BOARD_HEIGHT * scale) / 2,
    );
  };

  fitBoard();
  window.addEventListener("resize", fitBoard);
}

main().catch(console.error);
