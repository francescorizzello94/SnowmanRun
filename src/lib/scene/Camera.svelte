<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { Spring } from 'svelte/motion';
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  // Camera position springs for smooth following
  const cameraPosition = new Spring({ x: 0, y: 5, z: 10 }, { stiffness: 0.08, damping: 0.5 });
  const lookAtPosition = new Spring({ x: 0, y: 1, z: -4 }, { stiffness: 0.1, damping: 0.6 });
  
  // Camera roll for extra juice
  const cameraRoll = new Spring(0, { stiffness: 0.12, damping: 0.7 });
  
  let cameraRef = $state<any>();
  
  useTask(() => {
    
    // Always update camera position to follow player (even in START/GAMEOVER)
    cameraPosition.target = {
      x: gameState.playerX,
      y: 5,
      z: 10
    };
    
    // Update look-at target slightly ahead of player
    lookAtPosition.target = {
      x: gameState.playerX,
      y: 1,
      z: -4
    };
    
    // Add subtle roll based on velocity (only during gameplay)
    if (gameState.state === 'PLAYING') {
      const rollTarget = -gameState.playerVelocityX * 0.02;
      cameraRoll.target = rollTarget;
    } else {
      cameraRoll.target = 0;
    }
    
    // Apply lookAt
    if (cameraRef) {
      const lookAt = lookAtPosition.current;
      cameraRef.lookAt(lookAt.x, lookAt.y, lookAt.z);
    }
  });
</script>

<T.PerspectiveCamera
  makeDefault
  fov={60}
  position={[cameraPosition.current.x, cameraPosition.current.y, cameraPosition.current.z]}
  rotation.z={cameraRoll.current}
  bind:ref={cameraRef}
/>
