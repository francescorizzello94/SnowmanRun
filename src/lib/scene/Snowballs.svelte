<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import { getGameState, getQualityContext } from '$lib/game';
  import * as THREE from 'three';
  
  const gameState = getGameState();
  const { settings: Q } = getQualityContext();
  const { difficulty, spawner, collision } = gameState;
  
  const DEBUG_HITBOXES = false;
  
  // Tuning constants
  const CLEANUP_Z = 1.5;
  const HIT_STOP_DURATION = 0.12;
  const GROUND_OFFSET = 0.02;
  const WOBBLE_TILT = 0.06;
  const SKITTER_MAX_HOP = 0.07;
  const FRACTURE_SPLIT_OFFSET = 0.8;
  const FRAGMENT_SCALE_RATIO = 0.55;
  const MAX_SNOWBALLS = 100;
  
  // === PROFILE BADGES (imperative sprite pool) ===
  const MAX_BADGES = 20;
  const badgeTextures: THREE.Texture[] = [];
  const badgeMaterials: Partial<Record<string, THREE.SpriteMaterial>> = {};
  const badgeGroup = new THREE.Group();
  badgeGroup.name = 'BadgeGroup';
  const badgeSpritePool: THREE.Sprite[] = [];

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
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = colorHex;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 23, 0, Math.PI * 2);
    ctx.stroke();
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
    if (typeof document === 'undefined' || !Q.badgeSprites) return;
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
        map: tex, transparent: true, opacity: 0.95,
        depthTest: false, depthWrite: false,
      });
    }
    for (let i = 0; i < MAX_BADGES; i++) {
      const sprite = new THREE.Sprite();
      sprite.visible = false;
      sprite.renderOrder = 1000;
      badgeGroup.add(sprite);
      badgeSpritePool.push(sprite);
    }
  }
  initBadges();

  // === MATERIALS (quality-aware) ===
  function createSnowBumpTexture(size = 128): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      const v = 235 + Math.floor(Math.random() * 20);
      const idx = i * 4;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    tex.needsUpdate = true;
    return tex;
  }
  const snowBump = createSnowBumpTexture(128);

  function createSnowMaterial(): THREE.Material {
    if (Q.physicalMaterial) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ffffff'), roughness: 0.94, metalness: 0.0,
        clearcoat: 0.18, clearcoatRoughness: 0.55, ior: 1.31, reflectivity: 0.12,
        bumpMap: snowBump, bumpScale: 0.022, envMapIntensity: 0.25,
        emissive: new THREE.Color('#a9dcff'), emissiveIntensity: 0.0, flatShading: false,
      });
      if (Q.fresnelShader) {
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.uEdgeColor = { value: new THREE.Color('#a9dcff') };
          shader.uniforms.uEdgePower = { value: 3.0 };
          shader.uniforms.uEdgeIntensity = { value: 0.18 };
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <emissivemap_fragment>',
              `#include <emissivemap_fragment>
               float edgeF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), uEdgePower);
               totalEmissiveRadiance += uEdgeColor * (edgeF * uEdgeIntensity);`)
            .replace('uniform vec3 emissive;',
              `uniform vec3 emissive;
               uniform vec3 uEdgeColor;
               uniform float uEdgePower;
               uniform float uEdgeIntensity;`);
        };
      }
      return mat;
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'), roughness: 0.9, metalness: 0.0,
      bumpMap: snowBump, bumpScale: 0.018, envMapIntensity: 0.2, flatShading: false,
    });
  }
  const snowMaterial = createSnowMaterial();

  // === GEOMETRY (quality-aware detail) ===
  const geometryVariants: THREE.BufferGeometry[] = [];
  const geometryBottomOffsets: number[] = [];
  const geometryRadii: number[] = [];

  function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  function fract(x: number): number { return x - Math.floor(x); }
  function hash1(n: number): number { return fract(Math.sin(n) * 43758.5453123); }
  function hash3(ix: number, iy: number, iz: number, seed: number): [number, number, number] {
    const n = ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 19.19;
    return [hash1(n), hash1(n + 13.13), hash1(n + 29.79)];
  }

  function applyVoronoiDisplacement(
    geo: THREE.BufferGeometry, seed: number, frequency: number, clumpAmp: number, ridgeAmp: number
  ) {
    const positions = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++) {
      const x0 = positions.getX(i), y0 = positions.getY(i), z0 = positions.getZ(i);
      const len = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0) || 1;
      const nx = x0 / len, ny = y0 / len, nz = z0 / len;
      const px = nx * frequency, py = ny * frequency, pz = nz * frequency;
      const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
      let d1 = Infinity, d2 = Infinity;
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          for (let oz = -1; oz <= 1; oz++) {
            const iix = cx + ox, iiy = cy + oy, iiz = cz + oz;
            const [rx, ry, rz] = hash3(iix, iiy, iiz, seed);
            const ddx = iix + rx - px, ddy = iiy + ry - py, ddz = iiz + rz - pz;
            const dist2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (dist2 < d1) { d2 = d1; d1 = dist2; } else if (dist2 < d2) { d2 = dist2; }
          }
        }
      }
      const dist1 = Math.sqrt(d1), dist2v = Math.sqrt(d2);
      const clump = 1.0 - smoothstep(0.18, 0.44, dist1);
      const clumpRamp = smoothstep(0.15, 0.95, clump);
      const ridge = Math.max(0, Math.min(1, (dist2v - dist1) * 3.4));
      const ridgeRamp = smoothstep(0.10, 0.55, ridge);
      const disp = clumpRamp * clumpAmp + ridgeRamp * ridgeAmp;
      positions.setXYZ(i, nx * len * (1 + disp), ny * len * (1 + disp), nz * len * (1 + disp));
    }
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
  }
  
  function createAvalancheGeometry(seed: number): THREE.BufferGeometry {
    const geo = new THREE.IcosahedronGeometry(0.6, Q.snowballDetail);
    applyVoronoiDisplacement(geo, seed, 3.25, 0.06, 0.095);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let minY = Infinity;
    for (let i = 0; i < pos.count; i++) { if (pos.getY(i) < minY) minY = pos.getY(i); }
    geometryBottomOffsets.push(-minY);
    geometryRadii.push(geo.boundingSphere?.radius ?? 0.6);
    return geo;
  }
  geometryVariants.push(createAvalancheGeometry(1.0));
  geometryVariants.push(createAvalancheGeometry(2.3));
  geometryVariants.push(createAvalancheGeometry(4.7));
  
  // === INSTANCED MESHES — 3 draw calls for ALL snowballs ===
  const instancedMeshes: THREE.InstancedMesh[] = [];
  for (let v = 0; v < 3; v++) {
    const im = new THREE.InstancedMesh(geometryVariants[v], snowMaterial, MAX_SNOWBALLS);
    im.count = 0;
    im.frustumCulled = false;
    im.castShadow = Q.snowballShadows;
    im.receiveShadow = false;
    instancedMeshes.push(im);
  }

  // Reusable temporaries (zero per-frame alloc)
  const _euler = new THREE.Euler();
  const _quat = new THREE.Quaternion();
  const _pos = new THREE.Vector3();
  const _scl = new THREE.Vector3();
  const _mat = new THREE.Matrix4();
  const _innerPos = new THREE.Vector3();
  const _innerScl = new THREE.Vector3();
  const _innerMat = new THREE.Matrix4();
  const _identityQuat = new THREE.Quaternion();
  const _counts = [0, 0, 0];
  const _fragParamsLeft = {
    profile: 'FRAGMENT' as const, speedMul: 1.35, collisionRadiusMul: 0.95,
    wobbleMul: 1.15, hopMul: 1.05, baseX: 0, parentFracturerId: 0,
  };
  const _fragParamsRight = {
    profile: 'FRAGMENT' as const, speedMul: 1.35, collisionRadiusMul: 0.95,
    wobbleMul: 1.15, hopMul: 1.05, baseX: 0, parentFracturerId: 0,
  };

  const debugMaterial = DEBUG_HITBOXES ? new THREE.MeshBasicMaterial({
    color: 0xff0000, wireframe: true, transparent: true, opacity: 0.5,
  }) : null;
  const debugSphereGeo = DEBUG_HITBOXES ? new THREE.SphereGeometry(1, 12, 12) : null;

  let hitStopTimer = 0;

  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') {
      for (let v = 0; v < 3; v++) instancedMeshes[v].count = 0;
      return;
    }
    
    if (hitStopTimer > 0) {
      hitStopTimer -= delta;
      if (hitStopTimer <= 0) gameState.endGame();
      return;
    }
    
    gameState.timePlayed += delta;
    const forwardSpeed = gameState.getForwardSpeed(gameState.timePlayed);
    gameState.distanceTraveled += delta * forwardSpeed;
    gameState.updateDashState(gameState.timePlayed, gameState.distanceTraveled);

    const distMilestone = Math.floor(gameState.distanceTraveled / 100) * 100;
    if (distMilestone >= 100 && distMilestone > gameState.lastDistanceMilestone) {
      gameState.lastDistanceMilestone = distMilestone;
      gameState.queueMilestone(`${distMilestone}M REACHED!`);
    }
    gameState.checkRankProgression();
    gameState.tickMilestones();
    
    if (spawner.shouldSpawn(gameState)) {
      spawner.spawn(gameState);
      gameState.lastSpawnTime = gameState.timePlayed;
    }
    
    const playerX = gameState.playerX;
    const playerZ = gameState.playerZ;
    const dashSpeedMul = gameState.getDashSpeedMultiplier(gameState.timePlayed);
    const speed = difficulty.getSnowballSpeed(gameState.timePlayed, gameState.difficultyPreset) * dashSpeedMul;
    const snowballs = gameState.snowballs;
    const SEEKER_LOCK_Z = -15;
    const seekerLockZ = playerZ + SEEKER_LOCK_Z;
    const SEEKER_LEAD_MIN = 0.35;
    const SEEKER_LEAD_MAX = 0.95;
    const SEEKER_TURN_RATE = 3.6;
    const seekerAlpha = 1 - Math.exp(-SEEKER_TURN_RATE * delta);
    
    _counts[0] = 0; _counts[1] = 0; _counts[2] = 0;
    let badgeIdx = 0;
    
    for (let i = snowballs.length - 1; i >= 0; i--) {
      const snowball = snowballs[i];
      if (!snowball.active) continue;
      
      const snowballSpeed = speed * (snowball.speedMul ?? 1.0);
      const distTraveled = snowballSpeed * delta;
      snowball.z += distTraveled;

      if (snowball.profile === 'VORTEX') {
        snowball.x = snowball.baseX + Math.sin(gameState.timePlayed * snowball.vortexFreq + snowball.vortexPhase) * snowball.vortexAmp;
      } else if (snowball.profile === 'SEEKER') {
        if (snowball.seekerLocked !== true && snowball.z >= seekerLockZ) snowball.seekerLocked = true;
        if (snowball.seekerLocked !== true) {
          const toPlayer = Math.max(0.001, playerZ - snowball.z);
          const tToPlayer = toPlayer / Math.max(0.001, snowballSpeed);
          const leadT = Math.max(SEEKER_LEAD_MIN, Math.min(SEEKER_LEAD_MAX, tToPlayer));
          const predictedX = Math.max(-7, Math.min(7, playerX + gameState.playerVelocityX * leadT));
          snowball.baseX += (predictedX - snowball.baseX) * seekerAlpha;
        }
        snowball.x = snowball.baseX;
      } else {
        snowball.x = snowball.baseX;
      }

      // Fracturer split
      if (snowball.profile === 'FRACTURER' && !snowball.hasFractured && snowball.z >= snowball.fractureZ) {
        snowball.hasFractured = true;
        const parentFracturerId = snowball.id;
        const splitZ = snowball.z;
        const baseX = snowball.baseX;
        const parentScale = snowball.scale;
        const parentGeoVariant = snowball.geometryVariant;
        const fragScale = Math.max(FRAGMENT_SCALE_RATIO, parentScale * FRAGMENT_SCALE_RATIO);
        const offset = (FRACTURE_SPLIT_OFFSET + Math.random() * 0.25) * parentScale;
        gameState.deactivateSnowballDirect(snowball);
        const lx = Math.max(-7, Math.min(7, baseX - offset));
        const rx = Math.max(-7, Math.min(7, baseX + offset));
        _fragParamsLeft.baseX = lx; _fragParamsLeft.parentFracturerId = parentFracturerId;
        _fragParamsRight.baseX = rx; _fragParamsRight.parentFracturerId = parentFracturerId;
        const lf = gameState.addSnowball(lx, splitZ, fragScale, Math.random() * Math.PI * 2, parentGeoVariant, _fragParamsLeft);
        const rf = gameState.addSnowball(rx, splitZ, fragScale, Math.random() * Math.PI * 2, parentGeoVariant, _fragParamsRight);
        const sc = (lf ? 1 : 0) + (rf ? 1 : 0);
        if (sc > 0) gameState.registerFracturerSplit(parentFracturerId, sc);
        continue;
      }
      
      // Ground anchoring — O(1) analytical lookup (replaces per-frame raycasting)
      const variant = snowball.geometryVariant;
      const bottom = (geometryBottomOffsets[variant] ?? 0.6) * snowball.scale;
      const groundHeight = gameState.getGroundHeight(snowball.x, snowball.z);
      const hopWave = Math.sin(gameState.timePlayed * snowball.hopFreq + snowball.hopPhase);
      const hc = Math.max(0, hopWave); const hc3 = hc * hc * hc;
      const hop = hc3 * hc3 * SKITTER_MAX_HOP * snowball.scale * (snowball.hopMul ?? 1.0);
      snowball.groundY = groundHeight + bottom + GROUND_OFFSET + hop;
      
      const r = (geometryRadii[variant] ?? 0.6) * snowball.scale;
      snowball.rollAngle += distTraveled / Math.max(0.0001, r);

      // Write instance matrix (group transform × inner wobble+scale)
      const wobbleTilt = Math.sin(snowball.rollAngle * 0.75 + snowball.hopPhase) * WOBBLE_TILT * (snowball.wobbleMul ?? 1);
      _euler.set(snowball.rollAngle, snowball.rotationY, wobbleTilt);
      _quat.setFromEuler(_euler);
      _pos.set(snowball.x, snowball.groundY, snowball.z);
      _scl.set(1, 1, 1);
      _mat.compose(_pos, _quat, _scl);
      _innerPos.set(
        snowball.wobbleOffsetX * snowball.scale * (snowball.wobbleMul ?? 1), 0,
        snowball.wobbleOffsetZ * snowball.scale * (snowball.wobbleMul ?? 1)
      );
      _innerScl.set(snowball.scale, snowball.scale, snowball.scale);
      _innerMat.compose(_innerPos, _identityQuat, _innerScl);
      _mat.multiply(_innerMat);
      const idx = _counts[variant]++;
      instancedMeshes[variant].setMatrixAt(idx, _mat);

      // Badge sprites
      if (Q.badgeSprites && badgeIdx < MAX_BADGES && snowball.profile !== 'STANDARD' && snowball.profile !== 'FRAGMENT') {
        const bm = badgeMaterials[snowball.profile];
        if (bm) {
          const sp = badgeSpritePool[badgeIdx++];
          sp.visible = true;
          sp.material = bm;
          const br = (geometryRadii[variant] ?? 0.6) * snowball.scale;
          const bl = (snowball.profile === 'HEAVY' ? 0.85 : 0.6) * snowball.scale;
          const bs = (snowball.profile === 'HEAVY' ? 1.15 : 0.9) * snowball.scale;
          sp.position.set(snowball.x, snowball.groundY + br + bl, snowball.z);
          sp.scale.set(bs, bs, bs);
        }
      }
      
      // Cleanup past player
      if (snowball.z > playerZ + CLEANUP_Z) {
        if (snowball.profile === 'FRAGMENT' && snowball.parentFracturerId !== undefined) {
          gameState.recordFracturerFragmentPassed(snowball.parentFracturerId);
        } else {
          gameState.recordDodge(snowball.profile);
        }
        gameState.deactivateSnowballDirect(snowball);
        continue;
      }
      
      // Collision
      if (snowball.z >= playerZ - 1.5 && snowball.z <= playerZ + CLEANUP_Z) {
        const now = gameState.timePlayed;
        if (gameState.isDashActive(now)) continue;
        if (gameState.isFrostPhaseActive(now)) continue;
        const jumping = now >= gameState.jumpInvulnStartTime && now < gameState.jumpInvulnEndTime;
        if (jumping && snowball.profile !== 'HEAVY') continue;
        if (collision.checkCollision(playerX, playerZ, snowball.x, snowball.z, snowball.scale, snowball.collisionRadiusMul ?? 1.0)) {
          hitStopTimer = HIT_STOP_DURATION;
          return;
        }
      }
    }

    // Commit instance counts
    for (let v = 0; v < 3; v++) {
      instancedMeshes[v].count = _counts[v];
      if (_counts[v] > 0) instancedMeshes[v].instanceMatrix.needsUpdate = true;
    }
    // Hide unused badges
    for (let b = badgeIdx; b < badgeSpritePool.length; b++) badgeSpritePool[b].visible = false;
  });
  
  onDestroy(() => {
    stop();
    badgeGroup.clear();
    instancedMeshes.forEach(im => im.dispose());
    geometryVariants.forEach(geo => geo.dispose());
    snowBump.dispose();
    snowMaterial.dispose();
    if (debugMaterial) debugMaterial.dispose();
    if (debugSphereGeo) debugSphereGeo.dispose();
    badgeTextures.forEach(t => t.dispose());
    Object.values(badgeMaterials).forEach(m => m?.dispose());
  });
</script>

<!-- 3 InstancedMesh draw calls for ALL snowballs (was 100 individual meshes) -->
{#each instancedMeshes as im}
  <T is={im} />
{/each}

<!-- Imperative badge sprite group -->
<T is={badgeGroup} />

<!-- Debug hitboxes (dev only) -->
{#if DEBUG_HITBOXES && debugSphereGeo && debugMaterial}
  {#each gameState.snowballs as snowball}
    {#if snowball.active}
      <T.Mesh
        position={[snowball.x, snowball.groundY, snowball.z]}
        scale={[collision.SNOWBALL_RADIUS * snowball.scale, collision.SNOWBALL_RADIUS * snowball.scale, collision.SNOWBALL_RADIUS * snowball.scale]}
      >
        <T is={debugSphereGeo} />
        <T is={debugMaterial} />
      </T.Mesh>
    {/if}
  {/each}
  <T.Mesh position={[gameState.playerX, 1.0, 0]}>
    <T.SphereGeometry args={[collision.SNOWMAN_RADIUS, 12, 12]} />
    <T is={debugMaterial} />
  </T.Mesh>
{/if}
