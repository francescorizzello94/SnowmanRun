<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { T } from '@threlte/core';
  import Camera from './Camera.svelte';
  import Environment from './Environment.svelte';
  import Player from './Player.svelte';
  import Snowballs from './Snowballs.svelte';
  import Snowfall from './Snowfall.svelte';
</script>

<div class="scene-container">
  <Canvas 
    renderMode="always"
    shadows
  >
    <!-- Black void backdrop -->
    <T.Color attach="background" args={['#000000']} />
    
    <!-- Camera -->
    <Camera />
    
    <!-- Environment (lights, ground, fog) -->
    <Environment />

    <!-- Snowfall (toggleable) -->
    <Snowfall />
    
    <!-- Game objects -->
    <Player />
    <Snowballs />
  </Canvas>
</div>

<style>
  .scene-container {
    width: 100vw;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1;
  }
</style>
