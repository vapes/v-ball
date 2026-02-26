import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "@/core/PhysicsWorld";
import type { InputState, MarbleConfig } from "@/types";

/**
 * The marble the player controls.
 *
 * ## Movement model
 *
 * Instead of setting the marble's position directly (which would break
 * physics), we apply **torques** around the world X and Z axes.  A torque
 * around the X-axis makes the ball roll forward/backward along Z, and a
 * torque around the Z-axis makes it roll left/right along X.
 *
 * Rapier automatically converts the torque into angular velocity, which in
 * turn generates linear velocity through friction with the ground surface.
 * This produces the "weighty" feel of a real ball because:
 *   - The ball must spin up before it moves.
 *   - Changing direction requires overcoming angular inertia.
 *   - Linear and angular damping simulate air/rolling resistance.
 *
 * ## Rotation math
 *
 * The visual sphere's quaternion is copied straight from the physics body
 * every frame.  Rapier tracks rotation natively as a quaternion, so there
 * is no gimbal-lock risk and no manual Euler-angle bookkeeping.  The net
 * rotation comes from integrating angular velocity each physics sub-step:
 *
 *     ω_new  = ω_old + (τ / I) · dt          (torque / inertia)
 *     q_new  = q_old + 0.5 · [0, ω_new] · q_old · dt   (quaternion derivative)
 *
 * Rapier does this internally; we just read back the result.
 *
 * ## Anti-jitter (interpolation)
 *
 * Because physics runs at a fixed 60 Hz but rendering runs at the display
 * refresh rate, copying the physics transform directly would cause the
 * marble to "snap" to discrete positions.  We store the **previous** frame's
 * physics position and blend with the current one using the accumulator
 * alpha from PhysicsWorld:
 *
 *     renderPos = lerp(prevPos, currPos, alpha)
 *
 * This produces buttery-smooth motion at any frame rate.
 */
export class Player {
  readonly mesh: THREE.Mesh;
  readonly body: RAPIER.RigidBody;

  /** Previous physics position – used for interpolation. */
  private prevPosition = new THREE.Vector3();
  /** Current physics position after the latest step. */
  private currPosition = new THREE.Vector3();

  /** Previous physics rotation – used for interpolation. */
  private prevQuaternion = new THREE.Quaternion();
  /** Current physics quaternion after the latest step. */
  private currQuaternion = new THREE.Quaternion();

  private readonly config: MarbleConfig;

  /** Track whether the marble is touching a surface for jump gating. */
  private grounded = false;

  constructor(
    physics: PhysicsWorld,
    scene: THREE.Scene,
    config: MarbleConfig,
    spawnPosition: { x: number; y: number; z: number },
  ) {
    this.config = config;

    // ── Visual mesh ─────────────────────────────────────────────────────
    const geometry = new THREE.SphereGeometry(config.radius, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4488ff,
      metalness: 0.3,
      roughness: 0.4,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    // ── Physics body ────────────────────────────────────────────────────
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPosition.x, spawnPosition.y, spawnPosition.z)
      .setLinearDamping(config.linearDamping)
      .setAngularDamping(config.angularDamping);

    this.body = physics.createRigidBody(bodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.ball(config.radius)
      .setMass(config.mass)
      .setRestitution(config.restitution)
      .setFriction(config.friction);

    physics.createCollider(colliderDesc, this.body);

    // Initialise interpolation buffers to the spawn position
    this.currPosition.set(spawnPosition.x, spawnPosition.y, spawnPosition.z);
    this.prevPosition.copy(this.currPosition);
  }

  /**
   * Apply movement forces based on current input.
   * Called once per render frame, *before* `PhysicsWorld.step()`.
   */
  applyInput(input: InputState): void {
    const force = this.config.moveForce;

    // Build a torque vector.  Torque around X rolls the ball along Z,
    // and torque around Z rolls the ball along X (right-hand rule).
    let tx = 0;
    let tz = 0;

    if (input.forward) tx += force; // roll forward (−Z in camera space)
    if (input.backward) tx -= force;
    if (input.left) tz += force; // roll left (−X)
    if (input.right) tz -= force;

    if (tx !== 0 || tz !== 0) {
      this.body.applyTorqueImpulse(new RAPIER.Vector3(tx, 0, tz), true);
    }

    // Speed clamp – prevents runaway velocity on long downhill slopes.
    const vel = this.body.linvel();
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    if (speed > this.config.maxSpeed) {
      const scale = this.config.maxSpeed / speed;
      this.body.setLinvel(
        new RAPIER.Vector3(vel.x * scale, vel.y * scale, vel.z * scale),
        true,
      );
    }

    // Simple jump: apply upward impulse when grounded.
    if (input.jump && this.grounded) {
      this.body.applyImpulse(new RAPIER.Vector3(0, 8, 0), true);
      this.grounded = false;
    }
  }

  /**
   * Snapshot the current physics state *before* the next step.
   * Call once per frame, right before `PhysicsWorld.step()`.
   */
  savePreviousState(): void {
    this.prevPosition.copy(this.currPosition);
    this.prevQuaternion.copy(this.currQuaternion);
  }

  /**
   * Read back the post-step physics state.
   * Call once per frame, right after `PhysicsWorld.step()`.
   */
  readPhysicsState(): void {
    const t = this.body.translation();
    this.currPosition.set(t.x, t.y, t.z);

    const r = this.body.rotation();
    this.currQuaternion.set(r.x, r.y, r.z, r.w);
  }

  /**
   * Update the Three.js mesh by interpolating between the previous and
   * current physics states.
   */
  syncMesh(alpha: number): void {
    // Position: linear interpolation
    this.mesh.position.lerpVectors(this.prevPosition, this.currPosition, alpha);

    // Rotation: spherical-linear interpolation (slerp)
    this.mesh.quaternion.slerpQuaternions(
      this.prevQuaternion,
      this.currQuaternion,
      alpha,
    );
  }

  /** Return the interpolated world position for the camera to track. */
  getPosition(): THREE.Vector3 {
    return this.mesh.position;
  }

  /** Check whether the marble is resting on something. */
  updateGrounded(physicsWorld: PhysicsWorld): void {
    // Cast a short ray downward from the centre of the ball.
    const t = this.body.translation();
    const origin = new RAPIER.Vector3(t.x, t.y, t.z);
    const direction = new RAPIER.Vector3(0, -1, 0);
    const ray = new RAPIER.Ray(origin, direction);
    const hit = physicsWorld.world.castRay(
      ray,
      this.config.radius + 0.05,
      true,
    );
    this.grounded = hit !== null;
  }

  /** Teleport the marble back to a spawn point. */
  respawn(position: { x: number; y: number; z: number }): void {
    this.body.setTranslation(
      new RAPIER.Vector3(position.x, position.y, position.z),
      true,
    );
    this.body.setLinvel(new RAPIER.Vector3(0, 0, 0), true);
    this.body.setAngvel(new RAPIER.Vector3(0, 0, 0), true);
    this.currPosition.set(position.x, position.y, position.z);
    this.prevPosition.copy(this.currPosition);
  }
}
