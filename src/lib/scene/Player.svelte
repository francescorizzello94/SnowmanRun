<script lang="ts">
  import { onDestroy } from 'svelte';
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import { getGameState } from '$lib/game';
  import * as THREE from 'three';

  // Dependency injection: retrieve game state from context
  const gameState = getGameState();

  // Frost Phase visual state (reactive for template binding)
  let frostPhaseActive = $state(false);
  let frostPhaseIntensity = $state(0);

  // Dash visual state (reactive for template binding)
  let dashActive = $state(false);
  let dashIntensity = $state(0);
  
  // Tuning constants - KINEMATIC MOVEMENT (instant response)
  const MAX_X = 7; // Playable bounds
  const MOVE_SPEED = 12; // Units per second - instant velocity
  const VISUAL_LERP_SPEED = 24; // How fast visual catches up to logical position
  const TILT_AMOUNT = 0.08; // Subtle tilt based on movement direction
  const Z_LERP_SPEED = 18; // Dash forward smoothing

  // Model placement
  const SNOWMAN_SCALE = 0.05;
  const GROUND_Y = -0.01; // Matches SnowGround's Y
  const GROUND_SINK = 0.02; // Slightly embed into snow for contact
  
  // Visual position (lerped for smooth rendering) - reactive for template binding
  let visualX = $state(0);
  let visualY = $state(0);
  let visualTilt = $state(0);
  let visualZ = $state(0);

  // Non-reactive vertical velocity for smooth jump/land
  let yVel = 0;
  
  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'PLAYING') return;

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameState.setDigitalLeftHeld(true);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameState.setDigitalRightHeld(true);
    } else if (e.key === ' ' || e.code === 'Space') {
      gameState.tryStartJump();
    } else if (e.key === 'ArrowUp') {
      gameState.tryStartJump();
    } else if (e.key === 'ArrowDown') {
      gameState.cancelJump();
      // Immediate drop to ground on demand.
      visualY = 0;
      yVel = 0;
    }
  }
  
  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      gameState.setDigitalLeftHeld(false);
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      gameState.setDigitalRightHeld(false);
    }
  }
  
  // Linear interpolation helper
  function lerp(current: number, target: number, t: number): number {
    return current + (target - current) * Math.min(t, 1);
  }
  
  // Dash arrow visuals (anime speed cues)
  const DASH_ARROW_COUNT = 10;
  const dashArrowSlots = Array.from({ length: DASH_ARROW_COUNT });
  const dashArrowGeometry = new THREE.ConeGeometry(0.08, 0.65, 3, 1, true);
  const dashArrowMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#b7f0ff'),
    transparent: true,
    opacity: 0.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const dashArrowOffsets = dashArrowSlots.map((_, i) => ({
    angle: (i / DASH_ARROW_COUNT) * Math.PI * 2,
    radius: 0.75 + (i % 3) * 0.1,
    y: 0.55 + ((i * 7) % 5) * 0.07,
    phase: Math.random() * Math.PI * 2,
    speed: 1.1 + Math.random() * 1.6,
  }));

  let dashArrowGroup = $state<THREE.Group | undefined>(undefined);

  // Update player position in useTask
  useTask((delta) => {
    // Reset visual position when not playing
    if (gameState.state !== 'PLAYING') {
      visualX = gameState.playerX;
      visualY = 0;
      visualTilt = 0;
      visualZ = 0;
      gameState.playerZ = 0;
      dashActive = false;
      dashIntensity = 0;
      return;
    }
    
    // KINEMATIC INPUT: World-based mapping
    // Left  => decrease X
    // Right => increase X
    const inputDirection = gameState.getMoveAxisX();
    
    // Update logical position instantly (used for collision)
    gameState.playerX += inputDirection * MOVE_SPEED * delta;
    gameState.playerX = Math.max(-MAX_X, Math.min(MAX_X, gameState.playerX));
    
    // Clear velocity when not moving (no momentum/drift)
    gameState.playerVelocityX = inputDirection * MOVE_SPEED;
    
    // VISUAL SMOOTHING: Lerp visual position toward logical position
    visualX = lerp(visualX, gameState.playerX, VISUAL_LERP_SPEED * delta);
    visualZ = lerp(visualZ, gameState.playerZ, Z_LERP_SPEED * delta);

    // Jump arc (visual only; collision gating handled via gameState jump timers)
    const now = gameState.timePlayed;
    let targetY = 0;
    if (now >= gameState.jumpStartTime && now < gameState.jumpEndTime) {
      const dur = Math.max(0.001, gameState.jumpEndTime - gameState.jumpStartTime);
      const t = (now - gameState.jumpStartTime) / dur;
      const JUMP_HEIGHT = 1.3;
      targetY = 4 * JUMP_HEIGHT * t * (1 - t);
    }

    // Springy smoothing for confidence + better landing feel.
    // Faster on the way down to avoid floaty landings.
    const stiffness = targetY > visualY ? 160 : 240;
    const damping = 20;
    yVel += (targetY - visualY) * stiffness * delta;
    yVel *= Math.exp(-damping * delta);
    visualY = Math.max(0, visualY + yVel * delta);
    
    // Tilt based on movement direction (not velocity magnitude)
    const targetTilt = -inputDirection * TILT_AMOUNT;
    visualTilt = lerp(visualTilt, targetTilt, 12 * delta);

    // Dash visual state
    dashActive = gameState.isDashActive(now);
    if (dashActive) {
      dashIntensity = gameState.getDashIntensity(now);
    } else {
      dashIntensity = 0;
    }

    if (dashArrowGroup) {
      dashArrowGroup.visible = dashActive;
      if (dashActive) {
        dashArrowMaterial.opacity = 0.55 * dashIntensity;
        const children = dashArrowGroup.children as THREE.Mesh[];
        const spin = now * 1.35;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const o = dashArrowOffsets[i];
          const wave = (now * (2.0 + o.speed) + o.phase) % 1;
          const z = -0.25 - wave * 1.3;
          const r = o.radius + Math.sin(now * 7 + o.phase) * 0.08;
          const a = o.angle + spin * 0.2;
          const s = 0.85 + dashIntensity * 0.6;
          child.position.set(Math.cos(a) * r, o.y + Math.sin(now * 5 + o.phase) * 0.05, z);
          child.rotation.set(Math.PI / 2, a + Math.PI / 2, 0);
          child.scale.set(s, s, s);
        }
      }
    }

    // Frost Phase visual state (reuse 'now' from above)
    frostPhaseActive = gameState.isFrostPhaseActive(now);
    if (frostPhaseActive) {
      // Intensity pulses and fades as Frost Phase progresses
      const progress = gameState.getFrostPhaseProgress(now);
      // Start strong, pulse in the middle, fade at the end
      const baseFade = 1 - progress * progress; // Quadratic fade out
      const pulse = Math.sin(now * 8) * 0.15 + 0.85; // Subtle pulse
      frostPhaseIntensity = baseFade * pulse;
    } else {
      frostPhaseIntensity = 0;
    }
  });
  
  function tuneGltfMaterials(root: THREE.Object3D) {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;

      // Ensure shadows work for all actual renderable meshes (GLTF root flags
      // don't always propagate to children).
      obj.castShadow = true;
      obj.receiveShadow = true;

      const material = obj.material;
      const mats = Array.isArray(material) ? material : [material];
      for (const mat of mats) {
        if (!mat) continue;
        if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
          mat.roughness = Math.min(mat.roughness, 0.65);
          mat.metalness = 0.0;
          mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 0, 0.35);
          mat.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Auto-grounding algorithm for GLTF models
   * 
   * Problem: GLTF models often have arbitrary pivot points, making manual Y-offset
   * error-prone. This function computes the bounding box AFTER scaling, finds the
   * lowest vertex, and offsets the model so that point aligns with GROUND_Y.
   * 
   * Process:
   * 1. Apply scale to model (affects bounds calculation)
   * 2. Force world matrix update to get accurate transformed bounds
   * 3. Compute bounding box (includes all child meshes)
   * 4. Offset Y position so minY aligns with ground plane
   * 5. Apply GROUND_SINK to slightly embed model into snow for visual contact
   * 
   * @param root - The GLTF scene root object to ground
   */
  function placeModelOnGround(root: THREE.Object3D) {
    // Apply scale in code so we can compute accurate bounds.
    root.scale.setScalar(SNOWMAN_SCALE);
    root.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(root);
    const minY = box.min.y;

    // Move so the lowest point sits on the ground plane, then sink slightly.
    root.position.y += (GROUND_Y - minY) - GROUND_SINK;
    root.updateWorldMatrix(true, true);
  }

  // Frost Phase visual effect: icy shield aura
  const frostShieldGeometry = new THREE.SphereGeometry(1.8, 24, 24);

  // Load snowman GLTF with explicit lifecycle management
  const gltfPromise = useGltf('/snowman_scene.gltf')
    .then((gltf) => {
      tuneGltfMaterials(gltf.scene);
      placeModelOnGround(gltf.scene);
      gameState.setReady();
      return gltf;
    })
    .catch((error) => {
      console.error('Failed to load snowman GLTF:', error);
      gameState.setError('Failed to load 3D model. Please refresh the page.');
      throw error;
    });

  onDestroy(() => {
    dashArrowGeometry.dispose();
    dashArrowMaterial.dispose();
  });
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if gameState.state !== 'ERROR'}
  <T.Group position={[visualX, visualY, visualZ]} rotation.z={visualTilt}>
    {#await gltfPromise}
      <!-- Loading state - no visual until ready -->
    {:then gltf}
      <!-- GLTF model loaded successfully -->
      <T is={gltf.scene} castShadow />
    {:catch}
      <!-- Error handled via gameState.setError() - no geometry rendered -->
    {/await}

    <!-- Frost Phase Shield Effect -->
    {#if frostPhaseActive}
      <T.Mesh
        position={[0, 1.0, 0]}
        scale={[1 + frostPhaseIntensity * 0.1, 1 + frostPhaseIntensity * 0.1, 1 + frostPhaseIntensity * 0.1]}
      >
        <T is={frostShieldGeometry} />
        <T.MeshBasicMaterial
          color="#6ee7ff"
          transparent={true}
          opacity={frostPhaseIntensity * 0.35}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </T.Mesh>
    {/if}

    <!-- Dash Speed Arrows -->
    <T.Group bind:ref={dashArrowGroup} visible={false}>
      {#each dashArrowSlots as _, i (i)}
        <T.Mesh>
          <T is={dashArrowGeometry} />
          <T is={dashArrowMaterial} />
        </T.Mesh>
      {/each}
    </T.Group>
  </T.Group>
{/if}
