<script lang="ts">
  /**
   * Root Game Component
   * Initializes SSR-safe game state context for all child components
   */
  import { createGameState } from '$lib/game';
  import GameScene from './GameScene.svelte';
  import StartOverlay from '$lib/ui/StartOverlay.svelte';
  import HUD from '$lib/ui/HUD.svelte';
  import MobileControls from '$lib/ui/MobileControls.svelte';
  import RotateOverlay from '$lib/ui/RotateOverlay.svelte';
  import GameOverOverlay from '$lib/ui/GameOverOverlay.svelte';
  
  // Initialize context-scoped game state
  createGameState();
</script>

<div class="game-container">
  <GameScene />
  <StartOverlay />
  <HUD />
  <RotateOverlay />
  <MobileControls />
  <GameOverOverlay />
</div>

<style>
  .game-container {
    position: relative;
  }
</style>
