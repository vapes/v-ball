import type * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

/** Configuration for the physics simulation. */
export interface PhysicsConfig {
  gravity: { x: number; y: number; z: number };
  timestep: number; // seconds per physics step (1/60 for 60 Hz)
}

/** Properties for creating the player marble. */
export interface MarbleConfig {
  radius: number;
  mass: number;
  restitution: number; // bounciness [0, 1]
  friction: number;
  linearDamping: number; // slows linear velocity over time
  angularDamping: number; // slows spin over time
  moveForce: number; // force magnitude applied per input axis
  maxSpeed: number; // clamp on linear velocity magnitude
}

/** A single platform / ramp segment in the level. */
export interface PlatformConfig {
  position: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number }; // half-extents for box collider
  rotation?: { x: number; y: number; z: number }; // Euler angles in radians
  color?: number;
}

/** Track definition – an ordered list of platforms. */
export interface LevelConfig {
  platforms: PlatformConfig[];
  spawnPoint: { x: number; y: number; z: number };
  killPlaneY: number; // Y below which the marble respawns
}

/** Camera follow-offset & smoothing parameters. */
export interface CameraConfig {
  offset: THREE.Vector3;
  lookAheadFactor: number; // how far ahead of the marble the camera looks
  smoothSpeed: number; // lerp factor per frame (0–1, higher = snappier)
}

/** Snapshot of which movement keys are currently held. */
export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
}
