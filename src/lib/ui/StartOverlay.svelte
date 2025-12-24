<script lang="ts">
  import { onMount } from 'svelte';
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  function handleStart() {
    gameState.startGame();
  }

  function handleGlobalKeyDown(e: KeyboardEvent) {
    if (gameState.state !== 'START') return;

    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      handleStart();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });
</script>

{#if gameState.state === 'LOADING'}
  <div class="overlay loading-overlay">
    <div class="content">
      <h1>Snowman Run</h1>
      <div class="loading-spinner"></div>
      <p>Loading 3D models...</p>
    </div>
  </div>
{:else if gameState.state === 'ERROR'}
  <div class="overlay error-overlay">
    <div class="content error">
      <h1>⚠️ Error</h1>
      <p>{gameState.errorMessage || 'An error occurred'}</p>
      <button onclick={() => window.location.reload()}>Reload Page</button>
    </div>
  </div>
{:else if gameState.state === 'START'}
  <div class="overlay start-overlay">
    <div class="content">
      <h1>Snowman Run</h1>

      <div class="panel" aria-label="How to play">
        <h2>How to play</h2>
        <div class="howto-grid">
          <div class="howto-row">
            <span class="k">Move</span>
            <span class="v">
              <span class="keys">
                <span class="key">←</span><span class="key">→</span>
              </span>
              <span class="or">or</span>
              <span class="keys">
                <span class="key">A</span><span class="key">D</span>
              </span>
            </span>
          </div>

          <div class="howto-row">
            <span class="k">Jump</span>
            <span class="v">
              <span class="keys">
                <span class="key">Space</span>
              </span>
              <span class="or">or</span>
              <span class="keys">
                <span class="key">↑</span>
              </span>
              <span class="note">(clears all snowballs except Heavies)</span>
            </span>
          </div>
        </div>
      </div>

      <div class="panel" aria-label="Antagonistic snowball types">
        <h2>Beware these snowball types!</h2>
        <div class="enemy-grid" role="list">
          <div class="enemy-card seeker" role="listitem">
            <div class="swatch" aria-hidden="true"></div>
            <div class="enemy-text">
              <div class="enemy-name">Seeker</div>
              <div class="enemy-desc">Homes toward you</div>
            </div>
          </div>
          <div class="enemy-card vortex" role="listitem">
            <div class="swatch" aria-hidden="true"></div>
            <div class="enemy-text">
              <div class="enemy-name">Vortex</div>
              <div class="enemy-desc">Sways side-to-side</div>
            </div>
          </div>
          <div class="enemy-card fracturer" role="listitem">
            <div class="swatch" aria-hidden="true"></div>
            <div class="enemy-text">
              <div class="enemy-name">Fracturer</div>
              <div class="enemy-desc">Splits into two fragments</div>
            </div>
          </div>
          <div class="enemy-card heavy" role="listitem">
            <div class="swatch" aria-hidden="true"></div>
            <div class="enemy-text">
              <div class="enemy-name">Heavy</div>
              <div class="enemy-desc">Huge — can’t be jumped</div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" aria-keyshortcuts="Enter Space" onclick={handleStart} autofocus>Click to Play</button>
      <p class="key-hint">Press <strong>Space</strong> or <strong>Enter</strong> to start</p>
      {#if gameState.bestScore > 0}
        <p class="best-score">Best Score: {gameState.bestScore.toFixed(1)}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }
  
  .start-overlay {
    background: transparent;
  }
  
  .content {
    text-align: center;
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.95);
    padding: 3rem 4rem;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }
  
  .content.error {
    background: rgba(255, 235, 238, 0.95);
    border: 2px solid rgba(211, 47, 47, 0.3);
  }
  
  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top-color: #2196F3;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 1.5rem auto;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  h1 {
    font-size: 3rem;
    margin: 0 0 1rem 0;
    color: #2c5f8d;
    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  p {
    font-size: 1.2rem;
    margin: 0.5rem 0;
    color: #555;
  }

  h2 {
    margin: 0 0 0.85rem 0;
    font-size: 1.35rem;
    color: #2c5f8d;
    letter-spacing: 0.5px;
  }

  .panel {
    margin-top: 1.25rem;
    background: rgba(44, 95, 141, 0.08);
    border-radius: 14px;
    padding: 1.1rem 1.25rem;
    text-align: left;
  }

  .howto-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .howto-row {
    display: grid;
    grid-template-columns: 5.5rem 1fr;
    align-items: center;
    gap: 0.75rem;
  }

  .k {
    color: #5c6f7f;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 0.85rem;
    font-weight: 800;
  }

  .v {
    color: #2d3b45;
    font-size: 1.05rem;
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .keys {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
  }

  .key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0.5rem;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.12);
    color: #2c5f8d;
    font-weight: 800;
    font-size: 0.95rem;
    line-height: 1;
    min-height: 1.8rem;
  }

  .or {
    color: #6f7f8c;
    font-size: 0.95rem;
    font-weight: 700;
  }

  .note {
    color: #6f7f8c;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .enemy-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .enemy-card {
    --accent: #2c5f8d;
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.85rem 0.95rem;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }

  .enemy-card.seeker {
    --accent: #ff6a3d;
  }

  .enemy-card.fracturer {
    --accent: #b07cff;
  }

  .enemy-card.vortex {
    --accent: #31d3ff;
  }

  .enemy-card.heavy {
    --accent: #ffd34d;
  }

  .swatch {
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.25);
    border: 3px solid var(--accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    flex: 0 0 auto;
  }

  .enemy-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .enemy-name {
    font-size: 1.05rem;
    font-weight: 900;
    color: #2d3b45;
    letter-spacing: 0.2px;
  }

  .enemy-desc {
    font-size: 0.95rem;
    color: #5c6f7f;
    font-weight: 600;
  }

  @media (max-width: 540px) {
    .content {
      padding: 2.25rem 1.5rem;
    }

    .enemy-grid {
      grid-template-columns: 1fr;
    }

    .howto-row {
      grid-template-columns: 4.75rem 1fr;
    }
  }
  
  button {
    margin-top: 2rem;
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
  
  .best-score {
    margin-top: 1.5rem;
    font-size: 1rem;
    color: #888;
  }

  .key-hint {
    margin-top: 0.75rem;
    font-size: 1rem;
    color: #777;
  }
</style>
