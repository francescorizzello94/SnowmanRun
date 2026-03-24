<script lang="ts">
  import { T } from '@threlte/core';
  import SnowGround from './SnowGround.svelte';
  import { useThrelte } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import { getQualityContext } from '$lib/game';
  import * as THREE from 'three';

  const { settings: Q } = getQualityContext();
  const { renderer } = useThrelte();

  // Quality-aware shadow setup
  renderer.shadowMap.enabled = Q.shadowMapSize > 0;
  renderer.shadowMap.type = Q.softShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;

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
  castShadow={Q.shadowMapSize > 0}
  shadow.camera.left={-8}
  shadow.camera.right={8}
  shadow.camera.top={6}
  shadow.camera.bottom={-12}
  shadow.camera.near={0.5}
  shadow.camera.far={60}
  shadow.mapSize.width={Q.shadowMapSize || 512}
  shadow.mapSize.height={Q.shadowMapSize || 512}
  shadow.bias={-0.0001}
  shadow.normalBias={0.015}
/>

<!-- HEMISPHERE LIGHT (Sky/Ground ambient) -->
<!-- Vibrant sky-blue fill with soft grey ground bounce -->
<T.HemisphereLight 
  args={['#00aaff', '#c7cbd1', 0.65]}
/>

<!-- AMBIENT FILL (prevents pitch black shadows) -->
<T.AmbientLight intensity={0.12} color="#d8ecff" />

<!-- BACK/RIM LIGHT (silhouette definition, disabled on LOW quality) -->
{#if Q.rimLight}
<T.DirectionalLight 
  position={[-8, 5, -15]} 
  intensity={0.75} 
  color="#aaccff"
/>
{/if}

<!-- EXPONENTIAL FOG (winter atmosphere + hides distant geometry) -->
<T.FogExp2 attach="fog" args={['#000000', 0.018]} />
