<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Access subsystems via game state orchestrator
  const { difficulty, spawner, collision } = gameState;
  
  // Tuning constants
  const CLEANUP_Z = 15; // Remove snowballs that pass player
  const HIT_STOP_DURATION = 0.12; // 120ms freeze on collision
  
  let hitStopTimer = 0; // Non-reactive: high-frequency update
  
  /**
   * Main game loop - Performance optimized
   * Specification: Delta time for temporal decoupling, O(1) updates via direct reference
   */
  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') return;
    
    // Handle hit-stop (freeze frame on collision)
    if (hitStopTimer > 0) {
      hitStopTimer -= delta;
      if (hitStopTimer <= 0) {
        gameState.endGame();
      }
      return; // Freeze everything during hit-stop
    }
    
    // Update time and distance (reactive UI state)
    gameState.timePlayed += delta;
    gameState.distanceTraveled += delta * 10; // Arbitrary distance units
    
    // Spawn new snowballs
    if (spawner.shouldSpawn(gameState.timePlayed, gameState.lastSpawnTime)) {
      spawner.spawn(gameState);
      gameState.lastSpawnTime = gameState.timePlayed;
    }
    
    // Update snowball positions and check collisions
    // Performance: Direct iteration, O(1) property updates via reference
    const speed = difficulty.getSnowballSpeed(gameState.timePlayed);
    const snowballs = gameState.snowballs;
    
    // Iterate backwards to safely remove during iteration
    for (let i = snowballs.length - 1; i >= 0; i--) {
      const snowball = snowballs[i];
      if (!snowball.active) continue;
      
      // Move snowball forward (O(1) direct property update)
      snowball.z += speed * delta;
      
      // Check collision with player (player is at z=0)
      if (collision.checkCollision(gameState.playerX, 0, snowball.x, snowball.z)) {
        hitStopTimer = HIT_STOP_DURATION;
        return;
      }
      
      // Remove if past cleanup threshold (backwards iteration allows safe removal)
      if (snowball.z > CLEANUP_Z) {
        snowballs.splice(i, 1);
      }
    }
  });
  
  /**
   * Resource cleanup on component unmount
   * Specification: Explicit lifecycle management to prevent memory leaks
   */
  onDestroy(() => {
    stop();
  });
</script>

{#each gameState.snowballs as snowball (snowball.id)}
  {#if snowball.active}
    <T.Mesh position={[snowball.x, 0.6, snowball.z]} castShadow>
      <T.SphereGeometry args={[0.6, 16, 16]} />
      <T.MeshStandardMaterial color="#e8f4f8" roughness={0.3} metalness={0.1} />
    </T.Mesh>
  {/if}
{/each}
