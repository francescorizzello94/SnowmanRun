<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { useGltf } from '@threlte/extras';
  import { Spring } from 'svelte/motion';
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Tuning constants
  const MAX_X = 6;
  const ACCELERATION = 50; // was 40 - more responsive
  const FRICTION = 0.88; // was 0.85 - slightly less slippery
  const TILT_AMOUNT = 0.15;
  const PLAYER_Z = 0; // Player stays at z=0
  
  // Input tracking
  let leftPressed = $state(false);
  let rightPressed = $state(false);
  
  // Visual-only spring for tilt animation (does not affect collision)
  const tiltSpring = new Spring(0, { stiffness: 0.15, damping: 0.6 });
  
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
  
  // Update physics in useTask
  useTask((delta) => {
    // CRITICAL: Only update physics during gameplay AND when assets are loaded
    // This prevents invisible hitbox issues if model fails to load
    if (gameState.state !== 'PLAYING') {
      tiltSpring.target = 0;
      return;
    }
    
    // Calculate input direction
    let input = 0;
    if (leftPressed) input -= 1;
    if (rightPressed) input += 1;
    
    // Apply acceleration and friction (single-source physics)
    gameState.playerVelocityX += input * ACCELERATION * delta;
    gameState.playerVelocityX *= FRICTION;
    
    // Update position directly from velocity (no spring latency)
    gameState.playerX += gameState.playerVelocityX * delta;
    gameState.playerX = Math.max(-MAX_X, Math.min(MAX_X, gameState.playerX));
    
    // Update visual-only tilt spring based on velocity
    const tiltTarget = -gameState.playerVelocityX * TILT_AMOUNT;
    tiltSpring.target = tiltTarget;
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

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} />

{#if gameState.state !== 'ERROR'}
  <T.Group position={[gameState.playerX, 0, PLAYER_Z]} rotation.z={tiltSpring.current}>
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
