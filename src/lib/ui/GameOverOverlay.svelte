<script lang="ts">
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  let isNewHighScore = $derived(gameState.distanceTraveled > 0 && gameState.distanceTraveled >= gameState.bestScore);
  
  function handleRestart() {
    gameState.startGame();
  }
</script>

{#if gameState.state === 'GAMEOVER'}
  <div class="overlay gameover-overlay">
    <div class="content">
      <h1>Game Over!</h1>
      
      {#if isNewHighScore}
        <p class="new-high-score">🎉 New High Score! 🎉</p>
      {/if}
      
      <div class="score-display">
        <div class="score-item">
          <span class="label">Your Score</span>
          <span class="value">{gameState.distanceTraveled.toFixed(1)}</span>
        </div>
        <div class="score-item">
          <span class="label">Time Survived</span>
          <span class="value">{gameState.timePlayed.toFixed(1)}s</span>
        </div>
        {#if !isNewHighScore && gameState.bestScore > 0}
          <div class="score-item">
            <span class="label">Best Score</span>
            <span class="value">{gameState.bestScore.toFixed(1)}</span>
          </div>
        {/if}
      </div>

      <div class="final-stats" aria-label="Final statistics">
        <h2>Final Stats</h2>
        <div class="stats-grid">
          <div class="stat-row"><span class="k">Seekers Dodged</span><span class="v">{gameState.dodgedSeekers}</span></div>
          <div class="stat-row"><span class="k">Fracturers Avoided</span><span class="v">{gameState.dodgedFracturers}</span></div>
          <div class="stat-row"><span class="k">Vortex Dodged</span><span class="v">{gameState.dodgedVortex}</span></div>
          <div class="stat-row"><span class="k">Heavies Avoided</span><span class="v">{gameState.dodgedHeavies}</span></div>
        </div>
      </div>
      
      <button onclick={handleRestart}>Play Again</button>
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
    z-index: 100;
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
    display: flex;
    gap: 2rem;
    justify-content: center;
    margin: 2rem 0;
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(44, 95, 141, 0.08);
    padding: 0.85rem 1rem;
    border-radius: 12px;
  }

  .k {
    color: #5c6f7f;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .v {
    color: #2c5f8d;
    font-weight: 900;
    font-size: 1.2rem;
  }
  
  .score-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: rgba(44, 95, 141, 0.1);
    padding: 1.5rem 2rem;
    border-radius: 12px;
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
</style>
