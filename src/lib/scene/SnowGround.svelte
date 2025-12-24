<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { onDestroy, onMount } from 'svelte';
  import { getGameState } from '$lib/game';
  import * as THREE from 'three';
  
  
  // Ground configuration - lane-sized snow with black surround
  const GROUND_WIDTH = 15;
  const GROUND_LENGTH = 120;
  const GROUND_SEGMENTS_X = 80;
  const GROUND_SEGMENTS_Z = 150;
  
  /**
   * Procedural noise function for terrain generation
   * Multi-octave sin/cos creates natural snow drift patterns
   */
  function getNoiseHeight(x: number, z: number): number {
    // Large rolling drifts
    const drift = 
      Math.sin(x * 0.12 + z * 0.07) * 0.10 +
      Math.cos(x * 0.07 - z * 0.10) * 0.08;
    
    // Medium bumps
    const bumps = 
      Math.sin(x * 0.45 + z * 0.38) * 0.025 +
      Math.cos(x * 0.55 - z * 0.32) * 0.02;
    
    // Fine detail
    const detail = 
      Math.sin(x * 1.2 + z * 1.0) * 0.01 +
      Math.cos(x * 1.4 - z * 1.1) * 0.008;
    
    return drift + bumps + detail;
  }

  // Create PBR snow material matching snowball material
  const snowGroundMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 1.0, 1.0),
    roughness: 0.72,
    metalness: 0.0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.3,
    ior: 1.31,
    reflectivity: 0.25,
    envMapIntensity: 0.35,
    flatShading: false,
    side: THREE.FrontSide,
  });
  
  // Create geometry with procedural displacement
  const geometry = new THREE.PlaneGeometry(
    GROUND_WIDTH, 
    GROUND_LENGTH, 
    GROUND_SEGMENTS_X, 
    GROUND_SEGMENTS_Z
  );

  // Ground transform (must match template below)
  const GROUND_Y = -0.01;
  const GROUND_Z = -30;

  // === Snow trail (procedural deformation) ===
  // Goal: a subtle packed groove + pushed-up berms when the player moves.
  // Designed to be minimal and textureless; no extra meshes.
  const gameState = getGameState();

  type TrailPoint = { x: number; y: number; t: number; strength: number; dir: number };
  const MAX_POINTS = 80;
  const trail: TrailPoint[] = [];

  const TRACK_HALF_WIDTH = 0.55; // ~snowman footprint width
  const TRACK_HALF_LENGTH = 0.7;
  const TRACK_DEPTH = 0.055;
  const BERM_HEIGHT = 0.035;
  const FADE_SECONDS = 7.5;
  const STAMP_SPACING = 0.18;
  const MIN_SPEED_TO_STAMP = 0.35;
  const UPDATE_HZ = 18;

  let lastStampX = 1e9;
  let lastStampY = 1e9;
  let accum = 0;

  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function worldToGroundLocal(worldX: number, worldZ: number): { x: number; y: number } {
    // Plane is rotated -PI/2 around X, so its local +Y points toward world -Z.
    // With no scale and only translation, local X = worldX, local Y = -(worldZ - GROUND_Z).
    return { x: worldX, y: -(worldZ - GROUND_Z) };
  }

  /**
   * Stamps a new trail point into the deformation system
   * 
   * Design: Uses Gaussian stamping to create a groove with pushed-up berms.
   * Direction-aware to create asymmetric displacement (snow pushed to the side
   * based on movement direction).
   * 
   * Throttling: Stamps are spaced STAMP_SPACING apart to avoid excessive geometry
   * updates. Only stamps when speed exceeds MIN_SPEED_TO_STAMP (prevents stationary
   * sinking).
   * 
   * @param worldX - Player X position in world space
   * @param worldZ - Player Z position in world space
   * @param now - Current game time for fade calculation
   */
  function addTrailPoint(worldX: number, worldZ: number, now: number) {
    const speed = Math.abs(gameState.playerVelocityX);
    if (speed < MIN_SPEED_TO_STAMP) return;

    const dir = Math.sign(gameState.playerVelocityX) || 0;
    const p = worldToGroundLocal(worldX, worldZ);

    // Throttle stamps to avoid excessive geometry work
    const dx = p.x - lastStampX;
    const dy = p.y - lastStampY;
    if (dx * dx + dy * dy < STAMP_SPACING * STAMP_SPACING) return;
    lastStampX = p.x;
    lastStampY = p.y;

    // Strength scales with speed (faster movement = deeper groove)
    const strength = Math.min(1, speed / 10);
    trail.push({ x: p.x, y: p.y, t: now, strength, dir });
    if (trail.length > MAX_POINTS) trail.shift();
  }
  
  // Apply terrain displacement
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i); // This is actually Z in world space after rotation
    
    // Keep a crisp lane edge by fading displacement to 0 near the sides.
    const halfW = GROUND_WIDTH * 0.5;
    const edgeT = Math.min(Math.abs(x) / halfW, 1);
    const edgeFalloff = Math.pow(1 - edgeT, 2.2);

    // Keep drifts subtle and avoid deep craters.
    const raw = getNoiseHeight(x, y) * edgeFalloff;
    const height = Math.max(-0.10, Math.min(0.10, raw));
    positions.setZ(i, height);
  }

  // Keep a copy of the base terrain so the trail can be applied additively.
  const baseZ = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) {
    baseZ[i] = positions.getZ(i);
  }
  
  geometry.computeVertexNormals();

  function resetTerrain() {
    // Clear trail state (must happen before restoring base terrain)
    trail.length = 0;
    lastStampX = 1e9;
    lastStampY = 1e9;
    accum = 0;

    // Restore base terrain (undo any deformation)
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, baseZ[i]);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    normals.needsUpdate = true;
  }

  /**
   * Applies all trail deformations to the terrain geometry
   * 
   * Algorithm: For each vertex, sum Gaussian influence from all active trail points.
   * Creates both a groove (negative displacement) and asymmetric berms (positive
   * displacement on the sides, stronger on the movement direction side).
   * 
   * Performance: Throttled to UPDATE_HZ (18Hz) instead of per-frame. Rebuilds
   * vertex heights additively from baseZ to allow multiple overlapping trails.
   * 
   * Mathematical model:
   * - Groove: Gaussian kernel centered on stamp, depth = TRACK_DEPTH × strength × fade
   * - Berms: Ridge band function (peaks at 0.65-0.85 normalized distance from center)
   *   with directional bias (1.0 on movement side, 0.65 on opposite side)
   * 
   * @param now - Current game time for fade calculation
   */
  function applyTrail(now: number) {
    // Prune expired points.
    for (let i = trail.length - 1; i >= 0; i--) {
      if (now - trail[i].t > FADE_SECONDS) trail.splice(i, 1);
    }

    if (trail.length === 0) return;

    const sx = TRACK_HALF_WIDTH;
    const sy = TRACK_HALF_LENGTH;
    const inv2sx2 = 1 / (2 * sx * sx);
    const inv2sy2 = 1 / (2 * sy * sy);

    // Rebuild heights from base + trail influence.
    for (let vi = 0; vi < positions.count; vi++) {
      const x = positions.getX(vi);
      const y = positions.getY(vi);
      let z = baseZ[vi];

      for (let pi = 0; pi < trail.length; pi++) {
        const tp = trail[pi];
        const age = now - tp.t;
        const fade = Math.exp(-age / FADE_SECONDS);

        const dx = x - tp.x;
        const dy = y - tp.y;

        // Gaussian influence kernel
        const g = Math.exp(-(dx * dx) * inv2sx2 - (dy * dy) * inv2sy2);
        const s = tp.strength * fade;

        // Packed groove.
        z += -TRACK_DEPTH * s * g;

        // Side berms: stronger on the "outside" of movement.
        const edge = Math.abs(dx) / sx;
        const ridgeBand = smoothstep(0.45, 0.85, edge) * (1 - smoothstep(0.85, 1.25, edge));
        const bias = tp.dir !== 0 && dx * tp.dir > 0 ? 1.0 : 0.65;
        z += BERM_HEIGHT * s * g * ridgeBand * bias;
      }

      positions.setZ(vi, z);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    normals.needsUpdate = true;
  }

  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') return;

    // Stamp at the player's ground contact position.
    addTrailPoint(gameState.playerX, 0, gameState.timePlayed);

    // Throttle geometry work.
    accum += delta;
    const step = 1 / UPDATE_HZ;
    if (accum < step) return;
    accum = 0;

    applyTrail(gameState.timePlayed);
  });

  onMount(() => {
    gameState.registerTerrainResetHook(resetTerrain);
  });
  
  onDestroy(() => {
    gameState.unregisterTerrainResetHook(resetTerrain);
    stop?.();
    geometry.dispose();
    snowGroundMaterial.dispose();
  });
</script>

<T.Mesh 
  name="SnowGround"
  rotation.x={-Math.PI / 2} 
  position={[0, GROUND_Y, GROUND_Z]}
  receiveShadow
>
  <T is={geometry} />
  <T is={snowGroundMaterial} />
</T.Mesh>
