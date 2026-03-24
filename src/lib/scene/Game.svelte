<script lang="ts">
  /**
   * Root Game Component
   * Initializes SSR-safe game state context for all child components
   */
  import { createGameState, createQualityContext } from '$lib/game';
  import GameScene from './GameScene.svelte';
  import StartOverlay from '$lib/ui/StartOverlay.svelte';
  import HUD from '$lib/ui/HUD.svelte';
  import MobileControls from '$lib/ui/MobileControls.svelte';
  import GameOverOverlay from '$lib/ui/GameOverOverlay.svelte';
  
  // Initialize context-scoped game state
  createGameState();
  // Initialize quality detection (consumed by scene components via getQualityContext())
  createQualityContext();
</script>

<div class="game-container">
  <GameScene />
  <StartOverlay />
  <HUD />
  <MobileControls />
  <GameOverOverlay />
</div>

<style>
  .game-container {
    position: relative;
  }
</style>
