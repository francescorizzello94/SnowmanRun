<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameState, RANKS } from '$lib/game';
  import type { DifficultyPreset } from '$lib/game/difficulty.svelte';
  import { getRankUi, RANK_ICON_PATHS } from '$lib/ui/rank-ui';

  // Dependency injection: retrieve game state from context
  const gameState = getGameState();

  // Derive current rank for display
  let currentRank = $derived(RANKS[gameState.currentRankIndex]);
  let currentRankUi = $derived(getRankUi(currentRank.name));
  let frostPhaseActive = $derived(gameState.isFrostPhaseActive(gameState.timePlayed));

  const presets: DifficultyPreset[] = ['EASY', 'NORMAL', 'HARD', 'INSANE'];

  let isCompact = $state(false);
  let controlsOpen = $state(false);

  function updateCompact() {
    if (typeof window === 'undefined') return;
    // Some mobile devices report unexpectedly large CSS widths; prefer input capability
    // and height constraints over width-only checks.
    const isTouchLike = window.matchMedia('(pointer: coarse), (hover: none)').matches;
    const isNarrow = window.matchMedia('(max-width: 520px)').matches;
    const isShort = window.matchMedia('(max-height: 520px)').matches;
    const nextCompact = isTouchLike || isNarrow || isShort;
    isCompact = nextCompact;

    // Always keep settings collapsed on compact/mobile.
    if (nextCompact) controlsOpen = false;
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
    <div class="stat hud-card" aria-label="Run stats">
      <div class="stats-row">
        <div class="metric">
          <span class="label">Distance</span>
          <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
        </div>
        <div class="metric">
          <span class="label">Time</span>
          <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
        </div>
        <div class="metric rank-metric">
          <span class="label">Rank</span>
          <span class="rank-value" aria-label={currentRank.name} title={currentRank.name}>
            <span class="rank-icon" style="color: {currentRank.color}" aria-hidden="true">
              <svg
                class="rank-icon__svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d={RANK_ICON_PATHS[currentRankUi.icon]} />
              </svg>
            </span>
            <span class="rank-text" style="color: {currentRank.color}">{currentRank.name}</span>
          </span>
          {#if frostPhaseActive}
            <span class="frost-indicator">FROST PHASE</span>
          {/if}
        </div>

        <button
          type="button"
          class="metric settings-metric"
          aria-label={controlsOpen ? 'Hide HUD settings' : 'Show HUD settings'}
          aria-expanded={controlsOpen}
          onclick={() => (controlsOpen = !controlsOpen)}
        >
          <span class="label">Settings</span>
          <span class="value settings-icon" aria-hidden="true">⚙</span>
        </button>
      </div>

      {#if controlsOpen}
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
    pointer-events: none;
    z-index: 10;
  }

  .hud.compact {
    left: 0.75rem;
    right: 0.75rem;
    top: calc(0.65rem + env(safe-area-inset-top));
    transform: none;
    pointer-events: auto;
  }
  
  .stat {
    pointer-events: auto;
  }

  .hud-card {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    background: rgba(255, 255, 255, 0.9);
    padding: 0.45rem 0.9rem;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    width: min(42rem, calc(100vw - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right)));
  }

  .hud.compact .hud-card {
    width: 100%;
    padding: 0.35rem 0.65rem;
  }

  .stats-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.85rem;
    min-width: 0;
  }

  .rank-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
  }

  .rank-icon__svg {
    width: 100%;
    height: 100%;
  }

  .hud.compact .rank-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .hud.compact .frost-indicator {
    font-size: 0.55rem;
    padding: 0.1rem 0.3rem;
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    flex: 1 1 0;
    min-width: 0;
  }

  .metric.rank-metric {
    flex: 1.15 1 0;
  }

  .settings-metric {
    flex: 0 0 auto;
    min-width: 3.25rem;
    cursor: pointer;
    border: 0;
    background: transparent;
    padding: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .settings-metric:focus-visible {
    outline: 2px solid rgba(44, 95, 141, 0.6);
    outline-offset: 3px;
    border-radius: 10px;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    margin-top: 0.55rem;
    padding-top: 0.55rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
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

  .controls button {
    border: 1px solid rgba(0, 0, 0, 0.15);
    background: rgba(255, 255, 255, 0.95);
    padding: 0.28rem 0.5rem;
    border-radius: 10px;
    cursor: pointer;
    font-size: 0.8rem;
    color: #2c5f8d;
  }

  .controls button.selected {
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
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.15rem;
  }

  .value {
    font-size: 1.55rem;
    font-weight: 900;
    color: #2c5f8d;
  }

  .rank-value {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 950;
    line-height: 1.05;
    letter-spacing: 0.02em;
  }

  .rank-text {
    white-space: nowrap;
  }

  .hud.compact .rank-text {
    display: none;
  }

  .settings-icon {
    color: #2c5f8d;
  }

  .frost-indicator {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0.15rem 0.45rem;
    background: linear-gradient(135deg, #6ee7ff 0%, #31d3ff 100%);
    color: #fff;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.8px;
    border-radius: 6px;
    animation: frostPulse 0.5s ease-in-out infinite alternate;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  @keyframes frostPulse {
    0% {
      opacity: 0.85;
      transform: scale(1);
    }
    100% {
      opacity: 1;
      transform: scale(1.02);
    }
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
