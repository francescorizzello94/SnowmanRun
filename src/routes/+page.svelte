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
  }
</style>
