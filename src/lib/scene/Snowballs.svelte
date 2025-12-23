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
  const GROUND_OFFSET = 0.02; // Small offset above ground
  const WOBBLE_TILT = 0.06; // Small extra wobble tilt on top of pivot offset
  const SKITTER_MAX_HOP = 0.07; // Vertical hop amplitude (scaled by snowball scale)
  const FRACTURE_SPLIT_OFFSET = 0.8; // Base X separation for fragments
  const FRAGMENT_SCALE_RATIO = 0.55; // Scale multiplier for fragment snowballs
  
  // Raycaster for ground detection
  const raycaster = new THREE.Raycaster();
  const rayOrigin = new THREE.Vector3();
  const rayDirection = new THREE.Vector3(0, -1, 0);

  // === PROFILE BADGES (UI cues) ===
  // Goal: keep STANDARD snowballs plain; add lightweight, readable markers for elite profiles.
  // Implemented as camera-facing sprites (billboarded) with tiny glyphs.
  let badgesReady = false;
  const badgeTextures: THREE.Texture[] = [];
  const badgeMaterials: Partial<Record<string, THREE.SpriteMaterial>> = {};

  function createBadgeTexture(label: string, colorHex: string): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const data = new Uint8Array([0, 0, 0, 0]);
      const fallback = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
      fallback.needsUpdate = true;
      return fallback;
    }

    ctx.clearRect(0, 0, size, size);

    // Soft dark backing for readability.
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();

    // Colored ring.
    ctx.lineWidth = 6;
    ctx.strokeStyle = colorHex;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 23, 0, Math.PI * 2);
    ctx.stroke();

    // Center letter.
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Arial';
    ctx.fillText(label, size / 2, size / 2 + 1);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }

  function initBadges() {
    if (typeof document === 'undefined') return;

    const defs: Array<[string, string, string]> = [
      ['SEEKER', 'S', '#ff6a3d'],
      ['FRACTURER', 'F', '#b07cff'],
      ['VORTEX', 'V', '#31d3ff'],
      ['HEAVY', 'H', '#ffd34d'],
    ];

    for (const [profile, label, color] of defs) {
      const tex = createBadgeTexture(label, color);
      badgeTextures.push(tex);
      badgeMaterials[profile] = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      });
    }

    badgesReady = true;
  }

  initBadges();

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

  // Crystalline PBR snow: bright white, high roughness, subtle pale-blue edge glow.
  const snowMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ffffff'),
    roughness: 0.94,
    metalness: 0.0,
    clearcoat: 0.18,
    clearcoatRoughness: 0.55,
    ior: 1.31,
    reflectivity: 0.12,
    bumpMap: snowBump,
    bumpScale: 0.022,
    envMapIntensity: 0.25,
    emissive: new THREE.Color('#a9dcff'),
    emissiveIntensity: 0.0,
    flatShading: false,
  });

  // Fresnel-like emissive tint at edges to mimic soft subsurface scattering.
  // Implemented via onBeforeCompile to keep MeshPhysicalMaterial lighting model.
  snowMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uEdgeColor = { value: new THREE.Color('#a9dcff') };
    shader.uniforms.uEdgePower = { value: 3.0 };
    shader.uniforms.uEdgeIntensity = { value: 0.18 };

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         float edgeF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), uEdgePower);
         totalEmissiveRadiance += uEdgeColor * (edgeF * uEdgeIntensity);`
      )
      .replace(
        'uniform vec3 emissive;',
        `uniform vec3 emissive;
         uniform vec3 uEdgeColor;
         uniform float uEdgePower;
         uniform float uEdgeIntensity;`
      );
  };
  
  // Debug wireframe material
  const debugMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });
  
  // Create geometry variants (lumpy spheres for hand-packed snow look)
  const geometryVariants: THREE.BufferGeometry[] = [];
  const geometryBottomOffsets: number[] = [];
  const geometryRadii: number[] = [];

  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function fract(x: number): number {
    return x - Math.floor(x);
  }

  function hash1(n: number): number {
    return fract(Math.sin(n) * 43758.5453123);
  }

  function hash3(ix: number, iy: number, iz: number, seed: number): [number, number, number] {
    const n = ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 19.19;
    const a = hash1(n);
    const b = hash1(n + 13.13);
    const c = hash1(n + 29.79);
    return [a, b, c];
  }

  function applyVoronoiDisplacement(
    geo: THREE.BufferGeometry,
    seed: number,
    frequency: number,
    clumpAmp: number,
    ridgeAmp: number
  ) {
    const positions = geo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < positions.count; i++) {
      const x0 = positions.getX(i);
      const y0 = positions.getY(i);
      const z0 = positions.getZ(i);

      // Use normalized direction so displacement is radial.
      const len = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0) || 1;
      const nx = x0 / len;
      const ny = y0 / len;
      const nz = z0 / len;

      // Voronoi on a scaled space.
      const px = nx * frequency;
      const py = ny * frequency;
      const pz = nz * frequency;

      const cx = Math.floor(px);
      const cy = Math.floor(py);
      const cz = Math.floor(pz);

      let d1 = Infinity;
      let d2 = Infinity;

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const ix = cx + ox;
            const iy = cy + oy;
            const iz = cz + oz;
            const [rx, ry, rz] = hash3(ix, iy, iz, seed);

            // Feature point inside cell.
            const fx = ix + rx;
            const fy = iy + ry;
            const fz = iz + rz;

            const dx = fx - px;
            const dy = fy - py;
            const dz = fz - pz;
            const dist2 = dx * dx + dy * dy + dz * dz;

            if (dist2 < d1) {
              d2 = d1;
              d1 = dist2;
            } else if (dist2 < d2) {
              d2 = dist2;
            }
          }
        }
      }

      const dist1 = Math.sqrt(d1);
      const dist2 = Math.sqrt(d2);

      // Flattened clumps near cell centers.
      const clump = 1.0 - smoothstep(0.18, 0.44, dist1);
      const clumpRamp = smoothstep(0.15, 0.95, clump);

      // Sharp ridges near boundaries (F2 - F1).
      const ridge = Math.max(0, Math.min(1, (dist2 - dist1) * 3.4));
      const ridgeRamp = smoothstep(0.10, 0.55, ridge);

      // Outward-only displacement (no inward dents).
      const disp = clumpRamp * clumpAmp + ridgeRamp * ridgeAmp;
      const newLen = len * (1 + disp);
      positions.setXYZ(i, nx * newLen, ny * newLen, nz * newLen);
    }

    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  
  function createAvalancheGeometry(seed: number): THREE.BufferGeometry {
    // Procedural Icosphere generation (detail level 4)
    const geo = new THREE.IcosahedronGeometry(0.6, 4);

    // Voronoi displacement + smoothstep ramps to form clumps and ridges.
    applyVoronoiDisplacement(geo, seed, 3.25, 0.06, 0.095);

    // Cache bottom offset (for perfect ground anchoring) and radius (for roll sync).
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
    }

    const bottom = -minY; // distance from origin to bottom-most vertex
    geometryBottomOffsets.push(bottom);

    const r = geo.boundingSphere?.radius ?? 0.6;
    geometryRadii.push(r);
    return geo;
  }

  geometryVariants.push(createAvalancheGeometry(1.0));
  geometryVariants.push(createAvalancheGeometry(2.3));
  geometryVariants.push(createAvalancheGeometry(4.7));
  
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

    // Milestone triggers (non-blocking)
    // Distance: every 100m
    const distMilestone = Math.floor(gameState.distanceTraveled / 100) * 100;
    if (distMilestone >= 100 && distMilestone > gameState.lastDistanceMilestone) {
      gameState.lastDistanceMilestone = distMilestone;
      gameState.queueMilestone(`${distMilestone}M REACHED!`);
    }

    // Time: every 30s -> rank up
    const RANKS = ['SURVIVOR', 'BLIZZARD WALKER', 'AVALANCHE MASTER'] as const;
    const timeIndex = Math.floor(gameState.timePlayed / 30);
    if (timeIndex >= 1 && timeIndex > gameState.lastTimeMilestoneIndex) {
      gameState.lastTimeMilestoneIndex = timeIndex;
      const rank = RANKS[Math.min(timeIndex - 1, RANKS.length - 1)];
      gameState.queueMilestone(`RANK UP: ${rank}`);
    }

    // Advance queued milestone messages
    gameState.tickMilestones();
    
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
      const snowballSpeed = speed * (snowball.speedMul ?? 1.0);
      const distanceTraveled = snowballSpeed * delta;
      snowball.z += distanceTraveled;

      // Profile motion: Vortex sways horizontally (affects collision and ground sampling)
      if (snowball.profile === 'VORTEX') {
        snowball.x = snowball.baseX + Math.sin(gameState.timePlayed * snowball.vortexFreq + snowball.vortexPhase) * snowball.vortexAmp;
      } else {
        snowball.x = snowball.baseX;
      }

      // Profile behavior: Fracturer splits into two faster fragments near the player.
      if (snowball.profile === 'FRACTURER' && !snowball.hasFractured && snowball.z >= snowball.fractureZ) {
        snowball.hasFractured = true;

        const splitZ = snowball.z;
        const baseX = snowball.baseX;
        const fragScale = Math.max(FRAGMENT_SCALE_RATIO, snowball.scale * FRAGMENT_SCALE_RATIO);
        const offset = (FRACTURE_SPLIT_OFFSET + Math.random() * 0.25) * snowball.scale;

        // Remove the parent first (keeps loop safe while iterating backwards)
        snowballs.splice(i, 1);

        // Common parameters for fracture fragments
        const fragmentParams = {
          profile: 'FRAGMENT' as const,
          speedMul: 1.35,
          collisionRadiusMul: 0.95,
          wobbleMul: 1.15,
          hopMul: 1.05,
        };

        // Spawn two fragments, slightly diverging
        const leftX = Math.max(-7, Math.min(7, baseX - offset));
        const rightX = Math.max(-7, Math.min(7, baseX + offset));

        gameState.addSnowball(leftX, splitZ, fragScale, Math.random() * Math.PI * 2, snowball.geometryVariant, {
          ...fragmentParams,
          baseX: leftX,
        });
        gameState.addSnowball(rightX, splitZ, fragScale, Math.random() * Math.PI * 2, snowball.geometryVariant, {
          ...fragmentParams,
          baseX: rightX,
        });
        continue;
      }
      
      // Ground anchoring: bottom edge touches the lane surface regardless of scale.
      const variant = snowball.geometryVariant;
      const bottom = (geometryBottomOffsets[variant] ?? 0.6) * snowball.scale;
      const groundHeight = getGroundHeight(snowball.x, snowball.z);

      // Skitter motion: tiny vertical hops (always positive) as it travels.
      const hopWave = Math.sin(gameState.timePlayed * snowball.hopFreq + snowball.hopPhase);
      const hop =
        Math.pow(Math.max(0, hopWave), 6) *
        SKITTER_MAX_HOP *
        snowball.scale *
        (snowball.hopMul ?? 1.0);

      snowball.groundY = groundHeight + bottom + GROUND_OFFSET + hop;
      
      // Synchronized rotation: ΔAngle = ΔDistance / Radius
      const radius = (geometryRadii[variant] ?? 0.6) * snowball.scale;
      const rollDelta = distanceTraveled / Math.max(0.0001, radius);
      snowball.rollAngle += rollDelta;
      
      // 2. IMMEDIATE CLEANUP - Remove if past player (prevents ghost collisions)
      // This happens BEFORE collision check for balls that have passed
      if (snowball.z > CLEANUP_Z) {
		gameState.recordDodge(snowball.profile);
        snowballs.splice(i, 1);
        continue; // Skip collision check for removed snowball
      }
      
      // 3. SYNCHRONOUS COLLISION CHECK - Only for snowballs in front of or at player
      // Check collision only when snowball is in the danger zone
      if (snowball.z >= -1.5 && snowball.z <= CLEANUP_Z) {
        if (collision.checkCollision(
          playerX,
          playerZ,
          snowball.x,
          snowball.z,
          snowball.scale,
          snowball.collisionRadiusMul ?? 1.0
        )) {
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
    badgeTextures.forEach((t) => t.dispose());
    Object.values(badgeMaterials).forEach((m) => m?.dispose());
  });
</script>

<!-- Snowball visuals -->
{#each gameState.snowballs as snowball (snowball.id)}
  {#if snowball.active}
    {@const wobbleTilt = Math.sin(snowball.rollAngle * 0.75 + snowball.hopPhase) * WOBBLE_TILT * (snowball.wobbleMul ?? 1)}
    <!-- Organic wobble: pivot offset via Group+Mesh offset -->
    <T.Group
      position={[snowball.x, snowball.groundY, snowball.z]}
      rotation={[snowball.rollAngle, snowball.rotationY, wobbleTilt]}
    >
      <T.Mesh
        position={[snowball.wobbleOffsetX * snowball.scale * (snowball.wobbleMul ?? 1), 0, snowball.wobbleOffsetZ * snowball.scale * (snowball.wobbleMul ?? 1)]}
        scale={[snowball.scale, snowball.scale, snowball.scale]}
        castShadow
        receiveShadow
      >
        <T is={geometryVariants[snowball.geometryVariant]} />
        <T is={snowMaterial} />
      </T.Mesh>
    </T.Group>

    {#if badgesReady && snowball.profile !== 'STANDARD' && snowball.profile !== 'FRAGMENT'}
      {@const badgeMat = badgeMaterials[snowball.profile]}
      {@const badgeR = (geometryRadii[snowball.geometryVariant] ?? 0.6) * snowball.scale}
      {@const badgeLift = (snowball.profile === 'HEAVY' ? 0.85 : 0.6) * snowball.scale}
      {@const badgeSize = (snowball.profile === 'HEAVY' ? 1.15 : 0.9) * snowball.scale}

      {#if badgeMat}
        <!-- UI badge: camera-facing sprite above the snowball (does not roll). -->
        <T.Sprite
          position={[snowball.x, snowball.groundY + badgeR + badgeLift, snowball.z]}
          scale={[badgeSize, badgeSize, badgeSize]}
          renderOrder={1000}
        >
          <T is={badgeMat} />
        </T.Sprite>
      {/if}
    {/if}
    
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
