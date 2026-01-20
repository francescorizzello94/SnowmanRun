<script lang="ts">
  import { getGameState } from '$lib/game';
  import type { DifficultyPreset } from '$lib/game/difficulty.svelte';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();

  const presets: DifficultyPreset[] = ['EASY', 'NORMAL', 'HARD', 'INSANE'];

  function setPreset(preset: DifficultyPreset) {
    gameState.setDifficultyPreset(preset);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'PLAYING') return;

    if (e.key === '1') setPreset('EASY');
    if (e.key === '2') setPreset('NORMAL');
    if (e.key === '3') setPreset('HARD');
    if (e.key === '4') setPreset('INSANE');
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if gameState.state === 'PLAYING'}
  <div class="hud">
    <div class="stat stat-stack" aria-label="Run stats">
      <div class="metric">
        <span class="label">Distance</span>
        <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
      </div>
      <div class="metric">
        <span class="label">Time</span>
        <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
      </div>
    </div>

    <div class="controls" aria-label="Difficulty and snow controls">
      <div class="control-row">
        <span class="label">Difficulty</span>
        <div class="buttons" role="group" aria-label="Difficulty presets">
          {#each presets as preset}
            <button
              type="button"
              class:selected={gameState.difficultyPreset === preset}
              on:click={() => setPreset(preset)}
            >
              {preset}
            </button>
          {/each}
        </div>
      </div>

      <label class="toggle">
        <input type="checkbox" bind:checked={gameState.snowfallEnabled} />
        <span class="label">Snowfall</span>
      </label>
      <div class="hint">Hotkeys: 1–4</div>
    </div>
  </div>

  {#if gameState.milestoneText && gameState.timePlayed < gameState.milestoneExpiresAt}
    <div class="milestone" aria-live="polite">
      {gameState.milestoneText}
    </div>
  {/if}
{/if}

<style>
  .hud {
    position: fixed;
    top: calc(1rem + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%) scale(0.85);
    transform-origin: top center;
    display: flex;
    gap: 1.25rem;
    pointer-events: none;
    z-index: 10;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.55rem 1.1rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 7.5rem;
  }

  .stat-stack {
    align-items: stretch;
    justify-content: space-between;
    min-width: 9rem;
    min-height: 6.4rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
  }

  .controls {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.75rem 0.9rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    min-width: 18rem;
  }

  .control-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  button {
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 0.95);
    padding: 0.28rem 0.5rem;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.8rem;
    color: #2c5f8d;
  }

  button.selected {
    border-color: rgba(44, 95, 141, 0.5);
    background: rgba(44, 95, 141, 0.08);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .hint {
    font-size: 0.8rem;
    color: #888;
  }
  
  .label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.15rem;
  }
  
  .value {
    font-size: 1.55rem;
    font-weight: bold;
    color: #2c5f8d;
  }

  .milestone {
    position: fixed;
    left: 50%;
    top: 45%;
    transform: translate(-50%, -50%);
    z-index: 50;
    pointer-events: none;
    padding: 0.9rem 1.25rem;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.78);
    color: #ffffff;
    font-size: 2.1rem;
    font-weight: 900;
    letter-spacing: 1px;
    text-transform: uppercase;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
    animation: milestoneFlash 0.85s ease-out;
  }

  @keyframes milestoneFlash {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.98);
    }
    12% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.04);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.98);
    }
  }

  @media (max-width: 520px) {
    .hud {
      left: 0.75rem;
      right: 0.75rem;
      top: calc(0.75rem + env(safe-area-inset-top));
      transform: none;
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .stat,
    .controls {
      min-width: 0;
      width: 100%;
    }

    .stat {
      padding: 0.45rem 0.75rem;
      border-radius: 12px;
    }

    .stat-stack {
      min-height: 5.3rem;
    }

    .value {
      font-size: 1.25rem;
    }

    .label {
      font-size: 0.7rem;
    }

    .controls {
      padding: 0.65rem 0.75rem;
      border-radius: 12px;
    }

    button {
      font-size: 0.78rem;
      padding: 0.25rem 0.45rem;
    }

    .milestone {
      font-size: 1.45rem;
      padding: 0.75rem 1rem;
    }
  }
</style>
