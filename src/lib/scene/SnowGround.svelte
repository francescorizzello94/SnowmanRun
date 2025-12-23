<script lang="ts">
  import { T } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import * as THREE from 'three';
  
  
  // Ground configuration - lane-sized snow with black surround
  const GROUND_WIDTH = 15;
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
      Math.sin(x * 0.12 + z * 0.07) * 0.10 +
      Math.cos(x * 0.07 - z * 0.10) * 0.08;
    
    // Medium bumps
    const bumps = 
      Math.sin(x * 0.45 + z * 0.38) * 0.025 +
      Math.cos(x * 0.55 - z * 0.32) * 0.02;
    
    // Fine detail
    const detail = 
      Math.sin(x * 1.2 + z * 1.0) * 0.01 +
      Math.cos(x * 1.4 - z * 1.1) * 0.008;
    
    return drift + bumps + detail;
  }

  // Create PBR snow material matching snowball material
  const snowGroundMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(1.0, 1.0, 1.0),
    roughness: 0.72,
    metalness: 0.0,
    clearcoat: 0.7,
    clearcoatRoughness: 0.3,
    ior: 1.31,
    reflectivity: 0.25,
    envMapIntensity: 0.35,
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
    
    // Keep a crisp lane edge by fading displacement to 0 near the sides.
    const halfW = GROUND_WIDTH * 0.5;
    const edgeT = Math.min(Math.abs(x) / halfW, 1);
    const edgeFalloff = Math.pow(1 - edgeT, 2.2);

    // Keep drifts subtle and avoid deep craters.
    const raw = getNoiseHeight(x, y) * edgeFalloff;
    const height = Math.max(-0.10, Math.min(0.10, raw));
    positions.setZ(i, height);
  }
  
  geometry.computeVertexNormals();
  
  onDestroy(() => {
    geometry.dispose();
    snowGroundMaterial.dispose();
  });
</script>

<T.Mesh 
  name="SnowGround"
  rotation.x={-Math.PI / 2} 
  position={[0, -0.01, -30]}
  receiveShadow
>
  <T is={geometry} />
  <T is={snowGroundMaterial} />
</T.Mesh>
