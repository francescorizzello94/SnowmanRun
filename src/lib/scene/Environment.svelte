<script lang="ts">
  import { T } from '@threlte/core';
  import SnowGround from './SnowGround.svelte';
  import { onDestroy } from 'svelte';
  import * as THREE from 'three';

  const surroundMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
  });

  const surroundGeometry = new THREE.PlaneGeometry(260, 260, 1, 1);

  onDestroy(() => {
    surroundGeometry.dispose();
    surroundMaterial.dispose();
  });
</script>

<!-- Procedural snow ground -->
<SnowGround />

<!-- Black stage surround (outside lane) -->
<T.Mesh rotation.x={-Math.PI / 2} position={[0, -2.0, -40]} name="Surround">
  <T is={surroundGeometry} />
  <T is={surroundMaterial} />
</T.Mesh>

<!-- PRIMARY DIRECTIONAL LIGHT (Sun) -->
<!-- Warm yellow/orange tint to contrast with cool snow -->
<T.DirectionalLight 
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
  shadow.bias={-0.00005}
  shadow.normalBias={0.02}
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
<T.FogExp2 attach="fog" args={['#000000', 0.02]} />
