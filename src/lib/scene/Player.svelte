<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import { getGameState } from '$lib/game';
  import * as THREE from 'three';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Tuning constants - KINEMATIC MOVEMENT (instant response)
  const MAX_X = 7; // Playable bounds
  const MOVE_SPEED = 12; // Units per second - instant velocity
  const VISUAL_LERP_SPEED = 24; // How fast visual catches up to logical position
  const TILT_AMOUNT = 0.08; // Subtle tilt based on movement direction
  const PLAYER_Z = 0; // Player stays at z=0

  // Model placement
  const SNOWMAN_SCALE = 0.05;
  const GROUND_Y = -0.01; // Matches SnowGround's Y
  const GROUND_SINK = 0.02; // Slightly embed into snow for contact
  
  // Input tracking
  let leftPressed = $state(false);
  let rightPressed = $state(false);
  
  // Visual position (lerped for smooth rendering) - reactive for template binding
  let visualX = $state(0);
  let visualY = $state(0);
  let visualTilt = $state(0);

  // Non-reactive vertical velocity for smooth jump/land
  let yVel = 0;
  
  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'PLAYING') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftPressed = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightPressed = true;
    } else if (e.key === ' ' || e.code === 'Space') {
      gameState.tryStartJump();
    } else if (e.key === 'ArrowUp') {
      gameState.tryStartJump();
    } else if (e.key === 'ArrowDown') {
      gameState.cancelJump();
      // Immediate drop to ground on demand.
      visualY = 0;
      yVel = 0;
    } else if (e.key === 'x' || e.key === 'X') {
      gameState.tryActivateFrostBurst(gameState.playerX, PLAYER_Z);
    }
  }
  
  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftPressed = false;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightPressed = false;
    }
  }
  
  // Linear interpolation helper
  function lerp(current: number, target: number, t: number): number {
    return current + (target - current) * Math.min(t, 1);
  }
  
  // Update player position in useTask
  useTask((delta) => {
    // Reset visual position when not playing
    if (gameState.state !== 'PLAYING') {
      visualX = gameState.playerX;
      visualY = 0;
      visualTilt = 0;
      return;
    }
    
    // KINEMATIC INPUT: World-based mapping
    // Left  => decrease X
    // Right => increase X
    let inputDirection = 0;
    if (leftPressed && !rightPressed) inputDirection = -1;  // Left only
    if (rightPressed && !leftPressed) inputDirection = 1; // Right only
    // If both pressed: inputDirection stays 0 (deadzone)
    
    // Update logical position instantly (used for collision)
    gameState.playerX += inputDirection * MOVE_SPEED * delta;
    gameState.playerX = Math.max(-MAX_X, Math.min(MAX_X, gameState.playerX));
    
    // Clear velocity when not moving (no momentum/drift)
    gameState.playerVelocityX = inputDirection * MOVE_SPEED;
    
    // VISUAL SMOOTHING: Lerp visual position toward logical position
    visualX = lerp(visualX, gameState.playerX, VISUAL_LERP_SPEED * delta);

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
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if gameState.state !== 'ERROR'}
  <T.Group position={[visualX, visualY, PLAYER_Z]} rotation.z={visualTilt}>
    {#await gltfPromise}
      <!-- Loading state - no visual until ready -->
    {:then gltf}
      <!-- GLTF model loaded successfully -->
			<T is={gltf.scene} castShadow />
    {:catch}
      <!-- Error handled via gameState.setError() - no geometry rendered -->
    {/await}
  </T.Group>
{/if}
