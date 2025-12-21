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
  >
    <!-- Scene background color -->
    <T.Color attach="background" args={['#e8f4f8']} />
    
    <!-- Camera -->
    <Camera />
    
    <!-- Environment (lights, ground, fog) -->
    <Environment />
    
    <!-- Game objects -->\
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
