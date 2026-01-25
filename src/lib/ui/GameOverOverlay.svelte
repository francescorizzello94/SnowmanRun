<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameState, RANKS } from '$lib/game';
  import RankBadge from '$lib/ui/RankBadge.svelte';

  // Dependency injection: retrieve game state from context
  const gameState = getGameState();

  let isNewHighScore = $derived(gameState.distanceTraveled > 0 && gameState.distanceTraveled >= gameState.bestScore);
  let finalRank = $derived(RANKS[gameState.currentRankIndex]);
  
  function handleRestart() {
    gameState.startGame();
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'GAMEOVER') return;

    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      handleRestart();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });
</script>

{#if gameState.state === 'GAMEOVER'}
  <div class="overlay gameover-overlay">
    <div class="content">
      <h1>You Got Hit!</h1>
      
      {#if isNewHighScore}
        <p class="new-high-score">🎉 New High Score! 🎉</p>
      {/if}
      
      <div class="score-display">
        <div class="rank-hero-wrap" aria-label="Final rank">
          <RankBadge rankName={finalRank.name} />
        </div>

        <div class="score-cards" aria-label="Score summary">
          <div class="score-card">
            <span class="label">Your Score</span>
            <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
          </div>
          <div class="score-card">
            <span class="label">Time Survived</span>
            <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
          </div>
          {#if !isNewHighScore && gameState.bestScore > 0}
            <div class="score-card">
              <span class="label">Best Score</span>
              <span class="value">{gameState.bestScore.toFixed(1)}</span>
            </div>
          {/if}
        </div>
      </div>

      <div class="final-stats" aria-label="Final statistics">
        <h2>Final Stats</h2>
        <div class="stats-grid">
          <div class="stat-row seeker"><span class="k">Seekers Dodged</span><span class="v">{gameState.dodgedSeekers}</span></div>
          <div class="stat-row fracturer"><span class="k">Fracturers Avoided</span><span class="v">{gameState.dodgedFracturers}</span></div>
          <div class="stat-row vortex"><span class="k">Vortex Dodged</span><span class="v">{gameState.dodgedVortex}</span></div>
          <div class="stat-row heavy"><span class="k">Heavies Avoided</span><span class="v">{gameState.dodgedHeavies}</span></div>
        </div>
      </div>

      <div class="actions" aria-label="Game over actions">
        <button type="button" aria-keyshortcuts="Enter Space" onclick={handleRestart}>Play Again</button>
        <a
          class="coffee"
          href="https://buymeacoffee.com/cellardoortechnologies"
          target="_blank"
          rel="noopener noreferrer"
        >
          Buy me a coffee
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    max-width: 100vw;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 100;
		touch-action: auto;
		box-sizing: border-box;
  }
  
  .gameover-overlay {
    background: rgba(255, 255, 255, 0.95);
    animation: fadeIn 0.3s ease-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .content {
    text-align: center;
    pointer-events: auto;
		touch-action: pan-y;
		box-sizing: border-box;
    width: min(66rem, calc(100% - 2rem));
  }
  
  h1 {
    font-size: 3rem;
    margin: 0 0 1rem 0;
    color: #2c5f8d;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .new-high-score {
    font-size: 1.5rem;
    color: #d4af37;
    font-weight: bold;
    margin: 1rem 0;
    animation: pulse 1s ease-in-out infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }
  
  .score-display {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    margin: 2rem 0;
  }

  .rank-hero-wrap {
    width: min(28rem, 100%);
  }

  .score-cards {
    width: 100%;
    max-width: 46rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.9rem;
    align-items: stretch;
  }

  .final-stats {
    margin: 0 auto 1.5rem auto;
    max-width: 46rem;
    pointer-events: auto;
  }

  h2 {
    margin: 0.5rem 0 0.75rem 0;
    font-size: 1.35rem;
    color: #2c5f8d;
    letter-spacing: 0.5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem 1.25rem;
    justify-content: center;
  }

  .stat-row {
    --accent: #2c5f8d;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(44, 95, 141, 0.08);
    padding: 0.85rem 1rem;
    border-radius: 12px;
    border-left: 6px solid var(--accent);
  }

  .stat-row.seeker {
    --accent: #ff6a3d;
    background: rgba(255, 106, 61, 0.16);
  }

  .stat-row.fracturer {
    --accent: #b07cff;
    background: rgba(176, 124, 255, 0.16);
  }

  .stat-row.vortex {
    --accent: #31d3ff;
    background: rgba(49, 211, 255, 0.16);
  }

  .stat-row.heavy {
    --accent: #ffd34d;
    background: rgba(255, 211, 77, 0.22);
  }

  .stat-row.heavy .k,
  .stat-row.heavy .v {
    color: #2f2206;
  }

  .k {
    color: #5c6f7f;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .v {
    color: var(--accent);
    font-weight: 900;
    font-size: 1.2rem;
  }
  
  .score-card {
    display: flex;
    flex-direction: column;
    align-items: center;

    padding: 1.15rem 1.25rem;
    border-radius: 14px;

    background: rgba(255, 255, 255, 0.62);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.45);
    box-shadow:
      0 10px 26px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      inset 0 0 0 1px rgba(15, 23, 42, 0.04);
  }
  
  .label {
    font-size: 0.9rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
  }
  
  .value {
    font-size: 2.5rem;
    font-weight: bold;
    color: #2c5f8d;
  }
  
  .actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 2rem;
  }

  button {
    padding: 1rem 2rem;
    font-size: 1.5rem;
    background: #2c5f8d;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s, background 0.2s;
  }
  
  button:hover {
    background: #1e4a6d;
    transform: scale(1.05);
  }
  
  button:active {
    transform: scale(0.95);
  }

  .coffee {
    display: inline-block;
    color: #2c5f8d;
    font-weight: 800;
    text-decoration: none;
    padding: 0.65rem 1rem;
    border-radius: 10px;
    border: 1px solid rgba(44, 95, 141, 0.35);
    background: rgba(44, 95, 141, 0.08);
    transition: transform 0.2s, background 0.2s;
  }

  .coffee:hover {
    background: rgba(44, 95, 141, 0.12);
    transform: scale(1.02);
  }

  .coffee:active {
    transform: scale(0.98);
  }

  .coffee:focus-visible {
    outline: 2px solid rgba(44, 95, 141, 0.6);
    outline-offset: 3px;
  }

  @media (max-width: 540px), (max-height: 740px) {
    .overlay {
      align-items: flex-start;
      padding: calc(0.75rem + env(safe-area-inset-top))
        calc(0.75rem + env(safe-area-inset-right))
        calc(0.75rem + env(safe-area-inset-bottom))
        calc(0.75rem + env(safe-area-inset-left));
    }

    .content {
      width: min(30rem, 100%);
      max-height: calc(100dvh - 1.5rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      overflow: auto;
      -webkit-overflow-scrolling: touch;
      padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
    }

    h1 {
      font-size: 2.2rem;
    }

    .score-display {
      gap: 0.75rem;
      margin: 1.25rem 0;
    }

    .score-cards {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .value {
      font-size: 2.1rem;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .actions {
      margin-top: 1.25rem;
    }

    button {
      width: min(22rem, 100%);
      font-size: 1.25rem;
      padding: 0.9rem 1.25rem;
    }
  }
</style>
