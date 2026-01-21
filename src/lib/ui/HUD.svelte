<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameState } from '$lib/game';
  import type { DifficultyPreset } from '$lib/game/difficulty.svelte';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();

  const presets: DifficultyPreset[] = ['EASY', 'NORMAL', 'HARD', 'INSANE'];

  let isCompact = $state(false);
  let controlsOpen = $state(true);

  function updateCompact() {
    if (typeof window === 'undefined') return;
    // Some mobile devices report unexpectedly large CSS widths; prefer input capability
    // and height constraints over width-only checks.
    const isTouchLike = window.matchMedia('(pointer: coarse), (hover: none)').matches;
    const isNarrow = window.matchMedia('(max-width: 520px)').matches;
    const isShort = window.matchMedia('(max-height: 520px)').matches;
    const nextCompact = isTouchLike || isNarrow || isShort;
    isCompact = nextCompact;
    controlsOpen = !nextCompact;
  }

  onMount(() => {
    updateCompact();
    window.addEventListener('resize', updateCompact);
    window.addEventListener('orientationchange', updateCompact);
    return () => {
      window.removeEventListener('resize', updateCompact);
      window.removeEventListener('orientationchange', updateCompact);
    };
  });

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
  <div class="hud" class:compact={isCompact}>
    <div class="stat stat-stack" class:stat-compact={isCompact} aria-label="Run stats">
      <div class="metric">
        <span class="label">Distance</span>
        <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
      </div>
      <div class="metric">
        <span class="label">Time</span>
        <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
      </div>
    </div>

    {#if isCompact}
      <button
        type="button"
        class="settings"
        aria-label={controlsOpen ? 'Hide HUD settings' : 'Show HUD settings'}
        aria-expanded={controlsOpen}
        onclick={() => (controlsOpen = !controlsOpen)}
      >
        ⚙
      </button>
    {/if}

    {#if !isCompact || controlsOpen}
      <div class="controls" aria-label="Difficulty and snow controls">
        <div class="control-row">
          <span class="label">Difficulty</span>
          <div class="buttons" role="group" aria-label="Difficulty presets">
            {#each presets as preset (preset)}
              <button
                type="button"
                class:selected={gameState.difficultyPreset === preset}
                onclick={() => setPreset(preset)}
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
    {/if}
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

  .hud.compact {
    left: 0.75rem;
    right: 0.75rem;
    top: calc(0.65rem + env(safe-area-inset-top));
    transform: none;
    align-items: flex-start;
    gap: 0.55rem;
    pointer-events: auto;
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

  .stat-compact {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    min-width: 0;
    min-height: auto;
    padding: 0.35rem 0.65rem;
    border-radius: 12px;
    width: 100%;
  }

  .stat-compact .metric {
    flex: 1 1 0;
    align-items: flex-start;
  }

  .stat-compact .metric:last-child {
    align-items: flex-end;
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

  .settings {
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(0, 0, 0, 0.42);
    color: #fff;
    width: 2.55rem;
    height: 2.55rem;
    border-radius: 16px;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    font-size: 1.25rem;
    font-weight: 900;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .settings:active {
    transform: scale(0.98);
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
    top: calc(5.25rem + env(safe-area-inset-top));
    transform: translateX(-50%);
    z-index: 50;
    pointer-events: none;
    padding: 0.55rem 0.85rem;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.66);
    color: #ffffff;
    font-size: 1.25rem;
    font-weight: 900;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
    animation: milestoneToast 0.85s ease-out;
  }

  @keyframes milestoneToast {
    0% {
      opacity: 0;
      transform: translateX(-50%) translateY(-4px);
    }
    12% {
      opacity: 1;
      transform: translateX(-50%) translateY(0px);
    }
    70% {
      opacity: 1;
      transform: translateX(-50%) translateY(0px);
    }
    100% {
      opacity: 0;
      transform: translateX(-50%) translateY(-2px);
    }
  }

  @media (max-width: 520px) {
    .value {
      font-size: 1.05rem;
    }

    .label {
      font-size: 0.65rem;
    }

    .controls {
      min-width: 0;
      width: 100%;
    }

    .milestone {
      top: calc(3.75rem + env(safe-area-inset-top));
      font-size: 0.95rem;
      padding: 0.45rem 0.7rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .milestone {
      animation: none;
    }
  }
</style>
