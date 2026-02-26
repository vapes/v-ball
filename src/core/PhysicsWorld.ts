import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsConfig } from "@/types";

/**
 * PhysicsWorld wraps a Rapier simulation.
 *
 * It owns the RAPIER.World and exposes helpers to create rigid-bodies and
 * colliders.  The simulation is stepped at a fixed timestep (default 60 Hz)
 * using a semi-fixed-timestep accumulator to decouple physics from the
 * render frame-rate.
 *
 * ## Why an accumulator?
 *
 * `requestAnimationFrame` fires at the display refresh rate (often 60 Hz but
 * can be 144 Hz, or can drop under load).  Running the physics at a variable
 * dt causes instability; running it once per frame at a fixed dt leaves
 * leftover time that causes visible jitter.
 *
 * The accumulator stores surplus time from each frame.  When enough time has
 * built up, we run one (or more) fixed-size physics steps and store the
 * remainder for the next frame.  The remainder also gives us an
 * *interpolation alpha* so the renderer can blend between the previous and
 * current physics state, eliminating visual jitter completely.
 */
export class PhysicsWorld {
  world!: RAPIER.World;
  private accumulator = 0;
  private readonly fixedDt: number;

  /** Fraction of a timestep remaining after the last `step()`.  Use this to
   *  interpolate visual positions:
   *  `renderPos = prevPos + (currPos - prevPos) * alpha`  */
  alpha = 0;

  constructor(private config: PhysicsConfig) {
    this.fixedDt = config.timestep;
  }

  /** Must be called once before anything else – initialises the WASM module. */
  async init(): Promise<void> {
    await RAPIER.init();
    const { x, y, z } = this.config.gravity;
    this.world = new RAPIER.World(new RAPIER.Vector3(x, y, z));
  }

  /**
   * Advance the simulation by `dt` seconds (the wall-clock delta from
   * `requestAnimationFrame`).
   *
   * Internally this may run zero, one, or several fixed-size sub-steps so
   * physics stays deterministic regardless of frame-rate.  A cap of 4
   * sub-steps per frame prevents a "spiral of death" when the browser tab is
   * backgrounded and then resumed with a huge accumulated dt.
   */
  step(dt: number): void {
    // Cap incoming dt to avoid spiral of death after tab suspend
    this.accumulator += Math.min(dt, this.fixedDt * 4);

    while (this.accumulator >= this.fixedDt) {
      this.world.step();
      this.accumulator -= this.fixedDt;
    }

    // Alpha for visual interpolation (0 = at last stepped state, 1 = one
    // full step ahead).
    this.alpha = this.accumulator / this.fixedDt;
  }

  /** Convenience: create a rigid body + collider in one call. */
  createRigidBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    return this.world.createRigidBody(desc);
  }

  createCollider(
    desc: RAPIER.ColliderDesc,
    body: RAPIER.RigidBody,
  ): RAPIER.Collider {
    return this.world.createCollider(desc, body);
  }
}
