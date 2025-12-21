// Export game systems for easy importing
export { createGameState, getGameState, type GameState, type Snowball } from './state.svelte';

// Export subsystem classes (not instances) for type safety and testing
export { DifficultyManager } from './difficulty.svelte';
export { SnowballSpawner } from './spawner.svelte';
export { CollisionDetector } from './collision.svelte';
