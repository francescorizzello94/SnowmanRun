<script lang="ts">
  import Game from '$lib/scene/Game.svelte';
</script>

<div class="game-container">
  <Game />
</div>

<style>
  :global(body, html) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    height: 100%;
    width: 100%;
    background: #000;
    overscroll-behavior: none;
    -webkit-text-size-adjust: 100%;
  }

  :global(body) {
    touch-action: none;
  }
</style>
