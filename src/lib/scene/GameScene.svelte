<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { T } from '@threlte/core';
  import { getGameState } from '$lib/game';
  import Camera from './Camera.svelte';
  import Environment from './Environment.svelte';
  import Player from './Player.svelte';
  import Snowballs from './Snowballs.svelte';
  import Snowfall from './Snowfall.svelte';
  import SnowSpurt from './SnowSpurt.svelte';

  const gameState = getGameState();

  // Cap rendering resolution to 1.5× to prevent GPU fill-rate saturation on Retina/HiDPI displays.
  const maxDpr = Math.min(window.devicePixelRatio, 1.5);
</script>

<div class="scene-container">
  <Canvas 
    renderMode="always"
    shadows
    dpr={maxDpr}
  >
    <!-- Black void backdrop -->
    <T.Color attach="background" args={['#000000']} />
    
    <!-- Camera -->
    <Camera />
    
    <!-- Environment (lights, ground, fog) -->
    <Environment />

    <!-- Snowfall (toggleable) -->
    {#if gameState.snowfallEnabled}
      <Snowfall />
    {/if}
    
    <!-- Game objects -->
    <Player />
    <SnowSpurt />
    <Snowballs />
  </Canvas>
</div>

<style>
  .scene-container {
    width: 100dvw;
    height: 100dvh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1;
  }

  @supports not (height: 100dvh) {
    .scene-container {
      width: 100vw;
      height: 100vh;
    }
  }
</style>
