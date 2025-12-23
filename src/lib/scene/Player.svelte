<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Tuning constants - KINEMATIC MOVEMENT (instant response)
  const MAX_X = 7; // Playable bounds
  const MOVE_SPEED = 12; // Units per second - instant velocity
  const VISUAL_LERP_SPEED = 18; // How fast visual catches up to logical position
  const TILT_AMOUNT = 0.08; // Subtle tilt based on movement direction
  const PLAYER_Z = 0; // Player stays at z=0
  
  // Input tracking
  let leftPressed = $state(false);
  let rightPressed = $state(false);
  
  // Visual position (lerped for smooth rendering) - reactive for template binding
  let visualX = $state(0);
  let visualTilt = $state(0);
  
  // Handle keyboard input
  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'PLAYING') return;
    
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftPressed = true;
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightPressed = true;
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
      visualTilt = 0;
      return;
    }
    
    // KINEMATIC INPUT: Direct velocity based on input
    // Note: Negated because camera looks in -Z direction
    let inputDirection = 0;
    if (leftPressed && !rightPressed) inputDirection = 1;  // Left only
    if (rightPressed && !leftPressed) inputDirection = -1; // Right only
    // If both pressed: inputDirection stays 0 (deadzone)
    
    // Update logical position instantly (used for collision)
    gameState.playerX += inputDirection * MOVE_SPEED * delta;
    gameState.playerX = Math.max(-MAX_X, Math.min(MAX_X, gameState.playerX));
    
    // Clear velocity when not moving (no momentum/drift)
    gameState.playerVelocityX = inputDirection * MOVE_SPEED;
    
    // VISUAL SMOOTHING: Lerp visual position toward logical position
    visualX = lerp(visualX, gameState.playerX, VISUAL_LERP_SPEED * delta);
    
    // Tilt based on movement direction (not velocity magnitude)
    const targetTilt = -inputDirection * TILT_AMOUNT;
    visualTilt = lerp(visualTilt, targetTilt, 12 * delta);
  });
  
  // Load snowman GLTF with explicit lifecycle management
  const gltfPromise = useGltf('/snowman_scene.gltf');
  
  // Track asset loading state
  gltfPromise
    .then(() => {
      gameState.setReady();
    })
    .catch((error) => {
      console.error('Failed to load snowman GLTF:', error);
      gameState.setError('Failed to load 3D model. Please refresh the page.');
    });
</script>

<svelte:window onkeydown={handleKeyDown} onkeyup={handleKeyUp} />

{#if gameState.state !== 'ERROR'}
  <T.Group position={[visualX, 0, PLAYER_Z]} rotation.z={visualTilt}>
    {#await gltfPromise}
      <!-- Loading state - no visual until ready -->
    {:then gltf}
      <!-- GLTF model loaded successfully -->
      <T is={gltf.scene} scale={0.05} position.y={1.5} castShadow />
    {:catch}
      <!-- Error handled via gameState.setError() - no geometry rendered -->
    {/await}
  </T.Group>
{/if}
