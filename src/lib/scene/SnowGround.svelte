<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { getGameState } from '$lib/game';
  import { onDestroy } from 'svelte';
  import * as THREE from 'three';
  
  const gameState = getGameState();
  
  // Ground configuration - large enough to extend beyond fog
  const GROUND_WIDTH = 50;
  const GROUND_LENGTH = 120;
  const GROUND_SEGMENTS_X = 80;
  const GROUND_SEGMENTS_Z = 150;
  
  /**
   * Procedural noise function for terrain generation
   * Multi-octave sin/cos creates natural snow drift patterns
   */
  function getNoiseHeight(x: number, z: number): number {
    // Large rolling drifts
    const drift = 
      Math.sin(x * 0.15 + z * 0.08) * 0.3 +
      Math.cos(x * 0.08 - z * 0.12) * 0.25;
    
    // Medium bumps
    const bumps = 
      Math.sin(x * 0.5 + z * 0.4) * 0.08 +
      Math.cos(x * 0.6 - z * 0.35) * 0.06;
    
    // Fine detail
    const detail = 
      Math.sin(x * 1.5 + z * 1.2) * 0.02 +
      Math.cos(x * 1.8 - z * 1.4) * 0.015;
    
    return drift + bumps + detail;
  }
  
  // Create PBR snow material matching snowball material
  const snowGroundMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0.95, 0.95, 1.0), // Near-white, slight blue
    roughness: 0.9, // Very rough for diffuse snow
    metalness: 0.0,
    flatShading: false,
    side: THREE.FrontSide,
  });
  
  // Create geometry with procedural displacement
  const geometry = new THREE.PlaneGeometry(
    GROUND_WIDTH, 
    GROUND_LENGTH, 
    GROUND_SEGMENTS_X, 
    GROUND_SEGMENTS_Z
  );
  
  // Apply terrain displacement
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i); // This is actually Z in world space after rotation
    
    const height = getNoiseHeight(x, y);
    positions.setZ(i, height);
  }
  
  geometry.computeVertexNormals();
  
  let mesh: THREE.Mesh;
  
  // UV scrolling for movement illusion
  useTask((delta) => {
    if (gameState.state === 'PLAYING' && mesh) {
      // We could scroll UVs here if using a repeating texture
      // For now, the procedural displacement provides visual interest
    }
  });
  
  onDestroy(() => {
    geometry.dispose();
    snowGroundMaterial.dispose();
  });
</script>

<T.Mesh 
  bind:ref={mesh}
  rotation.x={-Math.PI / 2} 
  position={[0, -0.01, -30]}
  receiveShadow
>
  <T is={geometry} />
  <T is={snowGroundMaterial} />
</T.Mesh>
