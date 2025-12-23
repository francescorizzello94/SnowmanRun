<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import { getGameState } from '$lib/game';
  import * as THREE from 'three';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Access subsystems via game state orchestrator
  const { difficulty, spawner, collision } = gameState;
  
  // Get scene for raycasting
  const { scene } = useThrelte();
  
  // === DEBUG MODE ===
  // Set to true to see collision hitboxes
  const DEBUG_HITBOXES = false;
  
  // Tuning constants
  const CLEANUP_Z = 1.5; // Remove snowballs IMMEDIATELY after passing player (was 15!)
  const HIT_STOP_DURATION = 0.12; // 120ms freeze on collision
  const BASE_RADIUS = 0.6; // Base snowball radius for physics
  const GROUND_OFFSET = 0.02; // Small offset above ground
  const RESTING_RADIUS_PAD = 1.10; // Padding to prevent visual sinking for lumpy variants
  
  // Raycaster for ground detection
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);

  function createSnowBumpTexture(size = 128): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const v = 235 + Math.floor(Math.random() * 20);
      const idx = i * 4;
      data[idx + 0] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.needsUpdate = true;
    return tex;
  }
  
  const snowBump = createSnowBumpTexture(128);

  // Create PBR snow material (slightly "wet/icy" for crisp highlights)
  const snowMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.995, 0.995, 1.0),
    roughness: 0.62,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    ior: 1.31,
    reflectivity: 0.35,
    bumpMap: snowBump,
    bumpScale: 0.03,
    envMapIntensity: 0.45,
    flatShading: false,
  });
  
  // Debug wireframe material
  const debugMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  
  // Create geometry variants (lumpy spheres for hand-packed snow look)
  const geometryVariants: THREE.BufferGeometry[] = [];
  
  function createLumpyGeometry(detail: number, seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(BASE_RADIUS, detail);
    const positions = geo.attributes.position;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      
      const len = Math.sqrt(x * x + y * y + z * z);
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      
      // Keep the silhouette "lumpy" while avoiding deep inward dents that
      // make the mesh visually intersect the ground when rolling.
      let noise = 
        Math.sin(nx * 5.3 + seed) * Math.cos(ny * 4.7 + seed) * 0.055 +
        Math.sin(nz * 7.1 + seed * 2) * Math.cos(nx * 6.3 + seed) * 0.035 +
        Math.sin((nx + ny) * 9.0 + seed * 3) * 0.02;

      // Never dent inward: inward dents are what cause ground clipping when rolling.
      noise = Math.max(noise, 0);
      
      const newLen = len * (1 + noise);
      positions.setXYZ(i, nx * newLen, ny * newLen, nz * newLen);
    }
    
    geo.computeVertexNormals();
    return geo;
  }
  
  geometryVariants.push(createLumpyGeometry(2, 1.0));
  geometryVariants.push(createLumpyGeometry(2, 2.5));
  geometryVariants.push(createLumpyGeometry(2, 4.2));
  
  // Debug geometry for collision visualization
  const debugSphereGeo = new THREE.SphereGeometry(1, 12, 12);
  
  let hitStopTimer = 0;
  let groundMesh: THREE.Mesh | null = null;
  
  function findGroundMesh() {
    if (groundMesh) return;
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name === 'SnowGround') {
        groundMesh = obj;
      }
    });

    // Fallback for safety if name wasn't set for some reason
    if (!groundMesh) {
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          Math.abs(obj.rotation.x + Math.PI / 2) < 0.01 &&
          obj.position.y < 0.1
        ) {
          groundMesh = obj;
        }
      });
    }
  }
  
  function getGroundHeight(x: number, z: number): number {
    const DEFAULT_HEIGHT = 0;
    if (!groundMesh) return DEFAULT_HEIGHT;
    
    rayOrigin.set(x, 10, z);
    raycaster.set(rayOrigin, rayDirection);
    
    const intersects = raycaster.intersectObject(groundMesh, false);
    if (intersects.length > 0) {
      return intersects[0].point.y;
    }
    return DEFAULT_HEIGHT;
  }
  
  /**
   * Main game loop - SYNCHRONIZED collision detection
   * Collision check happens IMMEDIATELY after position update, same frame
   */
  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') return;
    
    findGroundMesh();
    
    // Handle hit-stop
    if (hitStopTimer > 0) {
      hitStopTimer -= delta;
      if (hitStopTimer <= 0) {
        gameState.endGame();
      }
      return;
    }
    
    // Update time and distance
    gameState.timePlayed += delta;
    gameState.distanceTraveled += delta * 10;
    
    // Spawn new snowballs
    if (spawner.shouldSpawn(gameState)) {
      spawner.spawn(gameState);
      gameState.lastSpawnTime = gameState.timePlayed;
    }
    
    // Get current player position for collision (captured once per frame)
    const playerX = gameState.playerX;
    const playerZ = 0;
    
    const speed = difficulty.getSnowballSpeed(gameState.timePlayed, gameState.difficultyPreset);
    const snowballs = gameState.snowballs;
    
    // Process snowballs: update position -> check collision -> cleanup
    // All in same frame, same loop iteration for each snowball
    for (let i = snowballs.length - 1; i >= 0; i--) {
      const snowball = snowballs[i];
      if (!snowball.active) continue;
      
      // 1. UPDATE POSITION
      const distanceTraveled = speed * delta;
      snowball.z += distanceTraveled;
      
      // Ground snapping
      const scaledRadius = BASE_RADIUS * snowball.scale;
      const restingRadius = scaledRadius * RESTING_RADIUS_PAD;
      const groundHeight = getGroundHeight(snowball.x, snowball.z);
      snowball.groundY = groundHeight + restingRadius + GROUND_OFFSET;
      
      // Rolling animation
      const rollDelta = distanceTraveled / scaledRadius;
      snowball.rollAngle += rollDelta;
      
      // 2. IMMEDIATE CLEANUP - Remove if past player (prevents ghost collisions)
      // This happens BEFORE collision check for balls that have passed
      if (snowball.z > CLEANUP_Z) {
        snowballs.splice(i, 1);
        continue; // Skip collision check for removed snowball
      }
      
      // 3. SYNCHRONOUS COLLISION CHECK - Only for snowballs in front of or at player
      // Check collision only when snowball is in the danger zone
      if (snowball.z >= -1.5 && snowball.z <= CLEANUP_Z) {
        if (collision.checkCollision(playerX, playerZ, snowball.x, snowball.z, snowball.scale)) {
          hitStopTimer = HIT_STOP_DURATION;
          return; // Exit immediately on collision
        }
      }
    }
  });
  
  onDestroy(() => {
    stop();
    geometryVariants.forEach(geo => geo.dispose());
    snowBump.dispose();
    snowMaterial.dispose();
    debugMaterial.dispose();
    debugSphereGeo.dispose();
  });
</script>

<!-- Snowball visuals -->
{#each gameState.snowballs as snowball (snowball.id)}
  {#if snowball.active}
    <T.Mesh 
      position={[snowball.x, snowball.groundY, snowball.z]} 
      rotation={[snowball.rollAngle, snowball.rotationY, 0]}
      scale={[snowball.scale, snowball.scale, snowball.scale]}
      castShadow
      receiveShadow
    >
      <T is={geometryVariants[snowball.geometryVariant]} />
      <T is={snowMaterial} />
    </T.Mesh>
    
    <!-- Debug hitbox visualization -->
    {#if DEBUG_HITBOXES}
      <T.Mesh 
        position={[snowball.x, snowball.groundY, snowball.z]}
        scale={[collision.SNOWBALL_RADIUS * snowball.scale, collision.SNOWBALL_RADIUS * snowball.scale, collision.SNOWBALL_RADIUS * snowball.scale]}
      >
        <T is={debugSphereGeo} />
        <T is={debugMaterial} />
      </T.Mesh>
    {/if}
  {/if}
{/each}

<!-- Player hitbox debug visualization -->
{#if DEBUG_HITBOXES}
  <T.Mesh position={[gameState.playerX, 1.0, 0]}>
    <T.SphereGeometry args={[collision.SNOWMAN_RADIUS, 12, 12]} />
    <T is={debugMaterial} />
  </T.Mesh>
{/if}
