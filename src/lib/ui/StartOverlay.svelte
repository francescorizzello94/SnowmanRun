<script lang="ts">
  import { getGameState } from '$lib/game';
  
  // Dependency injection: retrieve game state from context
  const gameState = getGameState();
  
  function handleStart() {
    gameState.startGame();
  }
</script>

{#if gameState.state === 'LOADING'}
  <div class="overlay loading-overlay">
    <div class="content">
      <h1>Snowman's Great Escape</h1>
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
      <h1>Snowman's Great Escape</h1>
      <p>Use Arrow Keys or A/D to dodge snowballs</p>
      <button onclick={handleStart}>Click to Play</button>
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
</style>
