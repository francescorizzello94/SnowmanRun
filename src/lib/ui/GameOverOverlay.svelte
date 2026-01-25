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
      <div class="title-block" aria-label="Game over">
        <h1 class="title">You Got Hit!</h1>
      </div>
      
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
        <div class="stats-grid">
          <div class="stat-row seeker"><span class="k">Seekers Dodged</span><span class="v">{gameState.dodgedSeekers}</span></div>
          <div class="stat-row fracturer"><span class="k">Fracturers Avoided</span><span class="v">{gameState.dodgedFracturers}</span></div>
          <div class="stat-row vortex"><span class="k">Vortex Dodged</span><span class="v">{gameState.dodgedVortex}</span></div>
          <div class="stat-row heavy"><span class="k">Heavies Avoided</span><span class="v">{gameState.dodgedHeavies}</span></div>
        </div>
      </div>

      <div class="actions" aria-label="Game over actions">
        <button type="button" class="play-again" aria-keyshortcuts="Enter Space" onclick={handleRestart}>
          <span class="play-again__label">Play Again</span>
          <span class="play-again__keys" aria-hidden="true">
            <span class="keycap keycap--enter" aria-hidden="true">
              <svg class="key-icon key-icon--enter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6v5a3 3 0 0 1-3 3H5" />
                <path d="M9 10l-4 4 4 4" />
              </svg>
            </span>
            <span class="keycap keycap--space">SPACE</span>
          </span>
        </button>
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
    margin: 0;
  }

  .title-block {
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    margin: 0 0 1rem 0;
  }

  .title {
    font-size: 3.35rem;
    font-weight: 1000;
    letter-spacing: 0.02em;
    line-height: 1.02;

    /* Design-grade title: dark-to-blue gradient text */
    background: linear-gradient(180deg, #0f172a, #1f4f76 55%, #2c5f8d);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;

    text-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
  }

  .title::after {
    content: '';
    display: block;
    margin: 0.55rem auto 0 auto;
    width: 9.25rem;
    height: 7px;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(44, 95, 141, 0.15), rgba(44, 95, 141, 0.75), rgba(44, 95, 141, 0.15));
    box-shadow:
      0 10px 22px rgba(44, 95, 141, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.55);
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

  .play-again {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 0.55rem;

    /* Primary action styling (match RankBadge glass/hero vibe) */
    background: linear-gradient(180deg, rgba(44, 95, 141, 0.98), rgba(30, 74, 109, 0.98));
    border: 1px solid rgba(255, 255, 255, 0.28);
    box-shadow:
      0 16px 34px rgba(15, 23, 42, 0.22),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    overflow: hidden;
  }

  .play-again::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(120% 140% at 20% 0%, rgba(255, 255, 255, 0.22), transparent 55%);
    pointer-events: none;
  }

  .play-again__label {
    line-height: 1;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-shadow: 0 2px 12px rgba(15, 23, 42, 0.22);
  }

  .play-again__keys {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    opacity: 0.95;
    line-height: 0;
  }

  .key-icon {
    display: block;
  }

  .keycap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 1.15rem;
    padding: 0 0.55rem;
    border-radius: 8px;

    /* Top-down keycap (no perspective), with subtle bevel */
    background: linear-gradient(to bottom, #ffffff, #f1f5f9);
    color: #0f172a;
    border: 1px solid rgba(15, 23, 42, 0.18);
    box-shadow:
      0 2px 8px rgba(15, 23, 42, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.95),
      inset 0 -1px 0 rgba(15, 23, 42, 0.08);
    font-weight: 900;
    letter-spacing: 0.08em;
    font-size: 0.66rem;
    line-height: 1;
  }

  .keycap--space {
    min-width: 3.9rem;
  }

  .keycap--enter {
    width: 1.35rem;
    height: 1.35rem;
    padding: 0;
    border-radius: 999px;
  }

  .key-icon--enter {
    width: 0.95rem;
    height: 0.95rem;
    color: #0f172a;
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

  .play-again:hover {
    background: linear-gradient(180deg, rgba(56, 115, 168, 0.98), rgba(33, 85, 125, 0.98));
    transform: translateY(-1px) scale(1.03);
  }

  .play-again:active {
    transform: translateY(0) scale(0.985);
  }

  .play-again:focus-visible {
    outline: 3px solid rgba(44, 95, 141, 0.55);
    outline-offset: 4px;
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

    .title {
      font-size: 2.35rem;
    }

    .title::after {
      width: 7.5rem;
      height: 6px;
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

    .play-again__keys {
      display: none;
    }
  }
</style>
