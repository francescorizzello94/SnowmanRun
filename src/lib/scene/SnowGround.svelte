<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { onDestroy, onMount } from 'svelte';
  import { getGameState, getQualityContext } from '$lib/game';
  import * as THREE from 'three';
  
  const { settings: Q } = getQualityContext();
  
  // Ground configuration - lane-sized snow with black surround
  const GROUND_WIDTH = 15;
  const GROUND_LENGTH = 120;
  const GROUND_SEGMENTS_X = Q.terrainSegmentsX;
  const GROUND_SEGMENTS_Z = Q.terrainSegmentsZ;
  
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

  // Quality-aware ground material
  const snowGroundMaterial: THREE.Material = Q.physicalMaterial
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(1.0, 1.0, 1.0),
        roughness: 0.72, metalness: 0.0,
        clearcoat: 0.7, clearcoatRoughness: 0.3,
        ior: 1.31, reflectivity: 0.25,
        envMapIntensity: 0.35, flatShading: false, side: THREE.FrontSide,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(1.0, 1.0, 1.0),
        roughness: 0.75, metalness: 0.0,
        envMapIntensity: 0.3, flatShading: false, side: THREE.FrontSide,
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
  const MAX_POINTS = Q.terrainTrailMaxPoints;

  // Pre-allocated circular trail pool — zero per-stamp allocation
  const trailPool: TrailPoint[] = Array.from({ length: MAX_POINTS }, () => (
    { x: 0, y: 0, t: 0, strength: 0, dir: 0 }
  ));
  let trailHead = 0;   // next write index (circular)
  let trailCount = 0;  // active point count

  const TRACK_HALF_WIDTH = 0.55; // ~snowman footprint width
  const TRACK_HALF_LENGTH = 0.7;
  const TRACK_DEPTH = 0.055;
  const BERM_HEIGHT = 0.035;
  const FADE_SECONDS = 7.5;
  const INV_FADE_SECONDS = 1 / FADE_SECONDS;
  const STAMP_SPACING = 0.18;
  const MIN_SPEED_TO_STAMP = 0.35;
  const UPDATE_HZ = Q.terrainTrailHz;

  let lastStampX = 1e9;
  let lastStampY = 1e9;
  let accum = 0;

  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  let _localX = 0;
  let _localY = 0;
  function worldToGroundLocal(worldX: number, worldZ: number): void {
    _localX = worldX;
    _localY = -(worldZ - GROUND_Z);
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
    worldToGroundLocal(worldX, worldZ);

    // Throttle stamps to avoid excessive geometry work
    const dx = _localX - lastStampX;
    const dy = _localY - lastStampY;
    if (dx * dx + dy * dy < STAMP_SPACING * STAMP_SPACING) return;
    lastStampX = _localX;
    lastStampY = _localY;

    // Strength scales with speed (faster movement = deeper groove)
    const strength = Math.min(1, speed / 10);

    // Write into pre-allocated circular pool — zero allocation
    const slot = trailPool[trailHead];
    slot.x = _localX; slot.y = _localY; slot.t = now;
    slot.strength = strength; slot.dir = dir;
    trailHead = (trailHead + 1) % MAX_POINTS;
    if (trailCount < MAX_POINTS) trailCount++;
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

  // === Analytical height lookup (O(1) bilinear interpolation, replaces per-frame raycasting) ===
  // PlaneGeometry vertices: stored_x = ix*segW - halfW, stored_y = halfL - iy*segH
  // After rotation -PI/2 around X + translation [0, GROUND_Y, GROUND_Z]:
  //   world_x = stored_x,  world_y = stored_z + GROUND_Y,  world_z = -stored_y + GROUND_Z
  const HALF_W = GROUND_WIDTH / 2;
  const HALF_L = GROUND_LENGTH / 2;
  const SEG_W = GROUND_WIDTH / GROUND_SEGMENTS_X;
  const SEG_H = GROUND_LENGTH / GROUND_SEGMENTS_Z;
  const GRID_X1 = GROUND_SEGMENTS_X + 1;

  function analyticalHeightLookup(wx: number, wz: number): number {
    const cx = Math.max(-HALF_W, Math.min(HALF_W, wx));
    const cz = Math.max(GROUND_Z - HALF_L, Math.min(GROUND_Z + HALF_L, wz));

    const fix = (cx + HALF_W) / SEG_W;
    const fiy = (HALF_L - GROUND_Z + cz) / SEG_H;

    const ix0 = Math.max(0, Math.min(GROUND_SEGMENTS_X - 1, Math.floor(fix)));
    const iy0 = Math.max(0, Math.min(GROUND_SEGMENTS_Z - 1, Math.floor(fiy)));

    const tx = fix - ix0;
    const ty = fiy - iy0;

    const z00 = positions.getZ(iy0 * GRID_X1 + ix0);
    const z10 = positions.getZ(iy0 * GRID_X1 + (ix0 + 1));
    const z01 = positions.getZ((iy0 + 1) * GRID_X1 + ix0);
    const z11 = positions.getZ((iy0 + 1) * GRID_X1 + (ix0 + 1));

    return GROUND_Y + z00 * (1 - tx) * (1 - ty) + z10 * tx * (1 - ty) + z01 * (1 - tx) * ty + z11 * tx * ty;
  }

  // Cache base normals so resetTerrain() can memcpy instead of O(faces) recompute
  const initialNormals = new Float32Array((geometry.attributes.normal as THREE.BufferAttribute).array);

  function resetTerrain() {
    // Clear trail state (must happen before restoring base terrain)
    trailHead = 0;
    trailCount = 0;
    lastStampX = 1e9;
    lastStampY = 1e9;
    accum = 0;

    // Restore base terrain (undo any deformation)
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, baseZ[i]);
    }
    positions.needsUpdate = true;

    // Restore cached normals — O(1) memcpy instead of O(faces) recompute
    const normals = geometry.attributes.normal as THREE.BufferAttribute;
    (normals.array as Float32Array).set(initialNormals);
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
  // Pre-allocated per-trail-point weight buffer — avoids recomputing
  // Math.exp(fade) inside the vertex×trail inner loop (612× reduction).
  const _trailWeights = new Float32Array(MAX_POINTS);

  function applyTrail(now: number) {
    // Build active trail list from circular pool, pruning expired in-place.
    // Collect into a compact run and pre-compute per-point weights.
    let activeCount = 0;
    const oldest = trailHead - trailCount;
    for (let k = 0; k < trailCount; k++) {
      const idx = ((oldest + k) % MAX_POINTS + MAX_POINTS) % MAX_POINTS;
      const tp = trailPool[idx];
      const age = now - tp.t;
      if (age > FADE_SECONDS) continue;
      // Hoist fade + strength into a single pre-multiplied weight
      _trailWeights[activeCount] = tp.strength * Math.exp(-age * INV_FADE_SECONDS);
      // Compact: rewrite into dense prefix for iteration below
      if (activeCount !== k) {
        const dst = ((oldest + activeCount) % MAX_POINTS + MAX_POINTS) % MAX_POINTS;
        const src = trailPool[idx];
        const d = trailPool[dst];
        d.x = src.x; d.y = src.y; d.t = src.t;
        d.strength = src.strength; d.dir = src.dir;
      }
      activeCount++;
    }
    trailCount = activeCount;

    if (activeCount === 0) return;

    const sx = TRACK_HALF_WIDTH;
    const sy = TRACK_HALF_LENGTH;
    const inv2sx2 = 1 / (2 * sx * sx);
    const inv2sy2 = 1 / (2 * sy * sy);

    // Spatial bounding box of all active trail points (+ generous padding).
    // Vertices outside this box get no trail influence — skips ~90% of the
    // expensive inner loop.
    const PAD = 2.0;
    const first = ((oldest) % MAX_POINTS + MAX_POINTS) % MAX_POINTS;
    let bbMinX = trailPool[first].x, bbMaxX = trailPool[first].x;
    let bbMinY = trailPool[first].y, bbMaxY = trailPool[first].y;
    for (let k = 1; k < activeCount; k++) {
      const idx = ((oldest + k) % MAX_POINTS + MAX_POINTS) % MAX_POINTS;
      const tp = trailPool[idx];
      if (tp.x < bbMinX) bbMinX = tp.x; else if (tp.x > bbMaxX) bbMaxX = tp.x;
      if (tp.y < bbMinY) bbMinY = tp.y; else if (tp.y > bbMaxY) bbMaxY = tp.y;
    }
    bbMinX -= PAD; bbMaxX += PAD;
    bbMinY -= PAD; bbMaxY += PAD;

    // Rebuild heights from base + trail influence.
    for (let vi = 0; vi < positions.count; vi++) {
      const x = positions.getX(vi);
      const y = positions.getY(vi);
      let z = baseZ[vi];

      // Only run Gaussian trail loop for vertices inside the bounding box
      if (x >= bbMinX && x <= bbMaxX && y >= bbMinY && y <= bbMaxY) {
        for (let k = 0; k < activeCount; k++) {
          const idx = ((oldest + k) % MAX_POINTS + MAX_POINTS) % MAX_POINTS;
          const tp = trailPool[idx];
          const s = _trailWeights[k]; // pre-computed strength × fade

          const dx = x - tp.x;
          const dy = y - tp.y;

          // Gaussian influence kernel (single Math.exp per vertex×point)
          const g = Math.exp(-(dx * dx) * inv2sx2 - (dy * dy) * inv2sy2);

          // Packed groove.
          z += -TRACK_DEPTH * s * g;

          // Side berms: stronger on the "outside" of movement.
          const edge = Math.abs(dx) / sx;
          const ridgeBand = smoothstep(0.45, 0.85, edge) * (1 - smoothstep(0.85, 1.25, edge));
          const bias = tp.dir !== 0 && dx * tp.dir > 0 ? 1.0 : 0.65;
          z += BERM_HEIGHT * s * g * ridgeBand * bias;
        }
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
    if (!Q.terrainTrailEnabled) return;

    // Stamp at the player's ground contact position.
    addTrailPoint(gameState.playerX, gameState.playerZ, gameState.timePlayed);

    // Throttle geometry work.
    accum += delta;
    const step = 1 / UPDATE_HZ;
    if (accum < step) return;
    accum = 0;

    applyTrail(gameState.timePlayed);
  });

  onMount(() => {
    gameState.registerTerrainResetHook(resetTerrain);
    gameState.registerHeightLookup(analyticalHeightLookup);
  });
  
  onDestroy(() => {
    gameState.unregisterTerrainResetHook(resetTerrain);
    gameState.unregisterHeightLookup();
    stop?.();
    geometry.dispose();
    snowGroundMaterial.dispose();
  });
</script>

<T.Mesh 
  name="SnowGround"
  rotation.x={-Math.PI / 2} 
  position={[0, GROUND_Y, GROUND_Z]}
  receiveShadow={Q.shadowMapSize > 0}
>
  <T is={geometry} />
  <T is={snowGroundMaterial} />
</T.Mesh>
