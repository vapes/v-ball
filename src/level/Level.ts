import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { PhysicsWorld } from "@/core/PhysicsWorld";
import type { LevelConfig, PlatformConfig } from "@/types";

/**
 * Builds the visual and physical representation of a level track.
 *
 * Each platform is a box with a Three.js mesh (for rendering) and a Rapier
 * fixed rigid-body + cuboid collider (for physics).  Ramps are just rotated
 * platforms—Rapier handles the angled collision surface automatically.
 */
export class Level {
  readonly meshes: THREE.Mesh[] = [];

  constructor(
    private physics: PhysicsWorld,
    private scene: THREE.Scene,
    readonly config: LevelConfig,
  ) {
    for (const platform of config.platforms) {
      this.createPlatform(platform);
    }
  }

  private createPlatform(cfg: PlatformConfig): void {
    const { x: hx, y: hy, z: hz } = cfg.size;

    // ── Visual ────────────────────────────────────────────────────────
    const geo = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
    const mat = new THREE.MeshStandardMaterial({
      color: cfg.color ?? 0x88aa88,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    if (cfg.rotation) {
      mesh.rotation.set(cfg.rotation.x, cfg.rotation.y, cfg.rotation.z);
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.meshes.push(mesh);

    // ── Physics ───────────────────────────────────────────────────────
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
      cfg.position.x,
      cfg.position.y,
      cfg.position.z,
    );

    if (cfg.rotation) {
      const euler = new THREE.Euler(
        cfg.rotation.x,
        cfg.rotation.y,
        cfg.rotation.z,
      );
      const q = new THREE.Quaternion().setFromEuler(euler);
      bodyDesc.setRotation(new RAPIER.Quaternion(q.x, q.y, q.z, q.w));
    }

    const body = this.physics.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(0.8)
      .setRestitution(0.1);
    this.physics.createCollider(colliderDesc, body);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default level data — a winding track with ramps, turns and guardrails.
// ─────────────────────────────────────────────────────────────────────────────

export function createDefaultLevel(): LevelConfig {
  const platforms: PlatformConfig[] = [];
  const trackColor = 0x6b8e6b;
  const rampColor = 0x8fbc8f;
  const wallColor = 0x556b55;

  // Helper to add guardrails (thin walls) along a platform
  const addGuardrails = (
    px: number,
    py: number,
    pz: number,
    halfWidth: number,
    halfLength: number,
    alongZ: boolean,
  ) => {
    const wallHeight = 0.4;
    const wallThickness = 0.15;
    if (alongZ) {
      // Walls on X-sides
      platforms.push({
        position: { x: px - halfWidth + wallThickness, y: py + wallHeight, z: pz },
        size: { x: wallThickness, y: wallHeight, z: halfLength },
        color: wallColor,
      });
      platforms.push({
        position: { x: px + halfWidth - wallThickness, y: py + wallHeight, z: pz },
        size: { x: wallThickness, y: wallHeight, z: halfLength },
        color: wallColor,
      });
    } else {
      // Walls on Z-sides
      platforms.push({
        position: { x: px, y: py + wallHeight, z: pz - halfWidth + wallThickness },
        size: { x: halfLength, y: wallHeight, z: wallThickness },
        color: wallColor,
      });
      platforms.push({
        position: { x: px, y: py + wallHeight, z: pz + halfWidth - wallThickness },
        size: { x: halfLength, y: wallHeight, z: wallThickness },
        color: wallColor,
      });
    }
  };

  // ── Section 1: Starting platform (wide, flat) ─────────────────────
  platforms.push({
    position: { x: 0, y: -0.5, z: 0 },
    size: { x: 4, y: 0.5, z: 4 },
    color: 0x7799aa,
  });

  // ── Section 2: Straight track heading −Z ──────────────────────────
  const straightLength = 12;
  platforms.push({
    position: { x: 0, y: -0.5, z: -(4 + straightLength) },
    size: { x: 3, y: 0.5, z: straightLength },
    color: trackColor,
  });
  addGuardrails(0, -0.5, -(4 + straightLength), 3, straightLength, true);

  // ── Section 3: Gentle downhill ramp ────────────────────────────────
  const rampLen = 8;
  const rampAngle = -0.15; // ~8.5 degrees downhill
  platforms.push({
    position: { x: 0, y: -1.5, z: -(4 + straightLength * 2 + rampLen) },
    size: { x: 3, y: 0.3, z: rampLen },
    rotation: { x: rampAngle, y: 0, z: 0 },
    color: rampColor,
  });

  // ── Section 4: Turn platform (wide square) ────────────────────────
  const turnZ = -(4 + straightLength * 2 + rampLen * 2 + 4);
  platforms.push({
    position: { x: 0, y: -2.5, z: turnZ },
    size: { x: 5, y: 0.5, z: 5 },
    color: 0x7799aa,
  });

  // ── Section 5: Track heading +X ───────────────────────────────────
  const seg5Len = 14;
  platforms.push({
    position: { x: 5 + seg5Len, y: -2.5, z: turnZ },
    size: { x: seg5Len, y: 0.5, z: 3 },
    color: trackColor,
  });
  addGuardrails(5 + seg5Len, -2.5, turnZ, 3, seg5Len, false);

  // ── Section 6: Uphill ramp ────────────────────────────────────────
  const uphillLen = 6;
  platforms.push({
    position: { x: 5 + seg5Len * 2 + uphillLen, y: -1.5, z: turnZ },
    size: { x: uphillLen, y: 0.3, z: 3 },
    rotation: { x: 0, y: 0, z: 0.12 },
    color: rampColor,
  });

  // ── Section 7: Second turn platform ───────────────────────────────
  const turn2X = 5 + seg5Len * 2 + uphillLen * 2 + 5;
  platforms.push({
    position: { x: turn2X, y: -0.5, z: turnZ },
    size: { x: 5, y: 0.5, z: 5 },
    color: 0x7799aa,
  });

  // ── Section 8: Track heading +Z (back towards start) ──────────────
  const seg8Len = 16;
  platforms.push({
    position: { x: turn2X, y: -0.5, z: turnZ + 5 + seg8Len },
    size: { x: 3, y: 0.5, z: seg8Len },
    color: trackColor,
  });
  addGuardrails(turn2X, -0.5, turnZ + 5 + seg8Len, 3, seg8Len, true);

  // ── Section 9: Narrow bridge ──────────────────────────────────────
  platforms.push({
    position: { x: turn2X, y: -0.5, z: turnZ + 5 + seg8Len * 2 + 6 },
    size: { x: 1.5, y: 0.5, z: 6 },
    color: 0xaa8866,
  });

  // ── Section 10: Finish platform ───────────────────────────────────
  platforms.push({
    position: { x: turn2X, y: -0.5, z: turnZ + 5 + seg8Len * 2 + 18 },
    size: { x: 5, y: 0.5, z: 5 },
    color: 0xddaa44,
  });

  return {
    platforms,
    spawnPoint: { x: 0, y: 2, z: 0 },
    killPlaneY: -20,
  };
}
