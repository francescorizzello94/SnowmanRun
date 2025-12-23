<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { T } from '@threlte/core';
  import Camera from './Camera.svelte';
  import Environment from './Environment.svelte';
  import Player from './Player.svelte';
  import Snowballs from './Snowballs.svelte';
</script>

<div class="scene-container">
  <Canvas 
    renderMode="always"
    shadows
  >
    <!-- Scene background color - matches fog for seamless horizon -->
    <T.Color attach="background" args={['#dce8f0']} />
    
    <!-- Camera -->
    <Camera />
    
    <!-- Environment (lights, ground, fog) -->
    <Environment />
    
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
