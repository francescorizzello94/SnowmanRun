<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { getGameState } from '$lib/game';
  import SnowGround from './SnowGround.svelte';
  import * as THREE from 'three';
  
  const gameState = getGameState();
  
  // Sun light reference for subtle animation
  let sunLight: THREE.DirectionalLight;
</script>

<!-- Procedural snow ground -->
<SnowGround />

<!-- PRIMARY DIRECTIONAL LIGHT (Sun) -->
<!-- Warm yellow/orange tint to contrast with cool snow -->
<T.DirectionalLight 
  bind:ref={sunLight}
  position={[15, 20, 10]} 
  intensity={2.0}
  color="#fff5e6"
  castShadow
  shadow.camera.left={-25}
  shadow.camera.right={25}
  shadow.camera.top={25}
  shadow.camera.bottom={-25}
  shadow.camera.near={0.1}
  shadow.camera.far={100}
  shadow.mapSize.width={2048}
  shadow.mapSize.height={2048}
  shadow.bias={-0.0001}
/>

<!-- HEMISPHERE LIGHT (Sky/Ground ambient) -->
<!-- Cool blue sky, warm ground bounce - creates winter atmosphere -->
<T.HemisphereLight 
  args={['#b3d4e6', '#e6d4b3', 0.6]}
/>

<!-- AMBIENT FILL (prevents pitch black shadows) -->
<T.AmbientLight intensity={0.25} color="#cce0ff" />

<!-- BACK/RIM LIGHT (silhouette definition) -->
<T.DirectionalLight 
  position={[-8, 5, -15]} 
  intensity={0.5} 
  color="#aaccff"
/>

<!-- EXPONENTIAL FOG (winter atmosphere + hides distant geometry) -->
<T.FogExp2 attach="fog" args={['#dce8f0', 0.025]} />
