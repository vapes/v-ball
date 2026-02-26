import * as THREE from "three";
import type { CameraConfig } from "@/types";

/**
 * A third-person follow camera that smoothly tracks the marble.
 *
 * The camera maintains a fixed **offset** from the target (the marble) and
 * uses exponential smoothing (lerp) each frame so the camera doesn't "snap"
 * when the ball changes direction suddenly.
 *
 * The `lookAheadFactor` pushes the look-at point slightly in the direction
 * the ball is moving, which gives the player a better view of upcoming
 * obstacles.
 */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly offset: THREE.Vector3;
  private readonly smoothSpeed: number;
  private readonly lookAheadFactor: number;

  /** Smoothed camera position – persists across frames. */
  private smoothedPosition: THREE.Vector3;

  constructor(config: CameraConfig, aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 500);
    this.offset = config.offset.clone();
    this.smoothSpeed = config.smoothSpeed;
    this.lookAheadFactor = config.lookAheadFactor;
    this.smoothedPosition = new THREE.Vector3();
  }

  /**
   * Call once per render frame after the marble mesh has been sync'd.
   *
   * @param targetPos  The marble's interpolated world position.
   * @param velocity   The marble's current linear velocity (for look-ahead).
   * @param dt         Frame delta in seconds.
   */
  update(targetPos: THREE.Vector3, velocity: THREE.Vector3, dt: number): void {
    // Desired position = target + offset
    const desired = targetPos.clone().add(this.offset);

    // Exponential smoothing — `1 - e^(-speed * dt)` makes the smoothing
    // frame-rate independent (unlike a raw lerp factor).
    const t = 1 - Math.exp(-this.smoothSpeed * dt);
    this.smoothedPosition.lerp(desired, t);

    this.camera.position.copy(this.smoothedPosition);

    // Look-at point: slightly ahead of the ball in its velocity direction.
    const lookAt = targetPos
      .clone()
      .addScaledVector(velocity.normalize(), this.lookAheadFactor);
    this.camera.lookAt(lookAt);
  }

  /** Snap the camera to the target immediately (e.g. on spawn / respawn). */
  snapTo(targetPos: THREE.Vector3): void {
    this.smoothedPosition.copy(targetPos).add(this.offset);
    this.camera.position.copy(this.smoothedPosition);
    this.camera.lookAt(targetPos);
  }

  /** Handle window resize. */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}
