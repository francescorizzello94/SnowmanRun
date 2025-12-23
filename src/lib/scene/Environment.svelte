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
<!-- Crisp cool-white sun to make snow pop -->
<T.DirectionalLight 
  position={[15, 20, 10]} 
  intensity={4.8}
  color="#ffffff"
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
<!-- Vibrant sky-blue fill with soft grey ground bounce -->
<T.HemisphereLight 
  args={['#00aaff', '#c7cbd1', 0.9]}
/>

<!-- AMBIENT FILL (prevents pitch black shadows) -->
<T.AmbientLight intensity={0.18} color="#d8ecff" />

<!-- BACK/RIM LIGHT (silhouette definition) -->
<T.DirectionalLight 
  position={[-8, 5, -15]} 
  intensity={0.75} 
  color="#aaccff"
/>

<!-- EXPONENTIAL FOG (winter atmosphere + hides distant geometry) -->
<T.FogExp2 attach="fog" args={['#00111e', 0.018]} />
