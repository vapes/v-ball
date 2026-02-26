import * as THREE from "three";
import { PhysicsWorld } from "@/core/PhysicsWorld";
import { Player } from "@/entities/Player";
import { Level, createDefaultLevel } from "@/level/Level";
import { FollowCamera } from "@/camera/FollowCamera";
import { InputManager } from "@/input/InputManager";
import type { MarbleConfig, CameraConfig, PhysicsConfig } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const PHYSICS_CONFIG: PhysicsConfig = {
  gravity: { x: 0, y: -9.81, z: 0 },
  timestep: 1 / 60,
};

const MARBLE_CONFIG: MarbleConfig = {
  radius: 0.5,
  mass: 1,
  restitution: 0.3,
  friction: 0.8,
  linearDamping: 0.4,
  angularDamping: 0.6,
  moveForce: 0.35,
  maxSpeed: 20,
};

const CAMERA_CONFIG: CameraConfig = {
  offset: new THREE.Vector3(0, 8, 14),
  lookAheadFactor: 2,
  smoothSpeed: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // ── Renderer ──────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.getElementById("app")!.appendChild(renderer.domElement);

  // ── Scene ─────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 60, 120);

  // ── Lighting ──────────────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(20, 30, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.left = -60;
  directionalLight.shadow.camera.right = 60;
  directionalLight.shadow.camera.top = 60;
  directionalLight.shadow.camera.bottom = -60;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 100;
  scene.add(directionalLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x556633, 0.3);
  scene.add(hemisphereLight);

  // ── Physics ───────────────────────────────────────────────────────────
  const physics = new PhysicsWorld(PHYSICS_CONFIG);
  await physics.init();

  // ── Level ─────────────────────────────────────────────────────────────
  const levelConfig = createDefaultLevel();
  const _level = new Level(physics, scene, levelConfig);

  // ── Player ────────────────────────────────────────────────────────────
  const player = new Player(physics, scene, MARBLE_CONFIG, levelConfig.spawnPoint);

  // ── Camera ────────────────────────────────────────────────────────────
  const followCam = new FollowCamera(
    CAMERA_CONFIG,
    window.innerWidth / window.innerHeight,
  );
  followCam.snapTo(player.getPosition());

  // ── Input ─────────────────────────────────────────────────────────────
  const input = new InputManager();

  // ── HUD ───────────────────────────────────────────────────────────────
  const hud = document.getElementById("hud")!;

  // ── Resize handling ───────────────────────────────────────────────────
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    followCam.resize(window.innerWidth, window.innerHeight);
  });

  // ── Game loop ─────────────────────────────────────────────────────────
  //
  // Frame order:
  //   1. Compute frame dt from the browser timestamp.
  //   2. Read input and apply forces/torques to the marble body.
  //   3. Save previous physics state (for interpolation).
  //   4. Step the physics world (may run 0–4 fixed sub-steps).
  //   5. Read back new physics state.
  //   6. Interpolate the mesh using alpha from the accumulator.
  //   7. Update the follow camera.
  //   8. Render the scene.
  //
  let lastTime = performance.now();
  const velocityVec = new THREE.Vector3();

  function loop(now: number): void {
    requestAnimationFrame(loop);

    const dt = Math.min((now - lastTime) / 1000, 0.1); // seconds, capped
    lastTime = now;

    // 1 ─ Input → forces
    player.applyInput(input.state);

    // 2 ─ Save previous state for interpolation
    player.savePreviousState();

    // 3 ─ Step physics
    physics.step(dt);

    // 4 ─ Read back new physics state
    player.readPhysicsState();
    player.updateGrounded(physics);

    // 5 ─ Interpolate mesh
    player.syncMesh(physics.alpha);

    // 6 ─ Kill plane check → respawn
    if (player.getPosition().y < levelConfig.killPlaneY) {
      player.respawn(levelConfig.spawnPoint);
      followCam.snapTo(player.getPosition());
    }

    // 7 ─ Camera
    const lv = player.body.linvel();
    velocityVec.set(lv.x, lv.y, lv.z);
    followCam.update(player.getPosition(), velocityVec, dt);

    // 8 ─ HUD
    const speed = velocityVec.length();
    hud.textContent = `Speed: ${speed.toFixed(1)} m/s`;

    // 9 ─ Render
    renderer.render(scene, followCam.camera);
  }

  // Hide the loading screen and start the loop.
  const loadingEl = document.getElementById("loading");
  if (loadingEl) loadingEl.style.display = "none";

  requestAnimationFrame(loop);
}

main().catch((err) => {
  console.error("Failed to start game:", err);
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = `Error: ${err.message}`;
});
