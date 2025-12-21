<script lang="ts">
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
</script>

{#if gameState.state === 'PLAYING'}
  <div class="hud">
    <div class="stat">
      <span class="label">Distance</span>
      <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
    </div>
    <div class="stat">
      <span class="label">Time</span>
      <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
    </div>
  </div>
{/if}

<style>
  .hud {
    position: fixed;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 3rem;
    pointer-events: none;
    z-index: 10;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.9);
    padding: 1rem 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .label {
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.25rem;
  }
  
  .value {
    font-size: 2rem;
    font-weight: bold;
    color: #2c5f8d;
  }
</style>
