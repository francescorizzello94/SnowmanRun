// Export game systems for easy importing
export {
	createGameState,
	getGameState,
	RANKS,
	type GameState,
	type Snowball,
	type RankName
} from './state.svelte';

// Export subsystem classes (not instances) for type safety and testing
export { DifficultyManager } from './difficulty.svelte';
export { SnowballSpawner } from './spawner.svelte';
export { CollisionDetector } from './collision.svelte';

// Export quality system
export {
	createQualityContext,
	getQualityContext,
	detectQualityTier,
	getPreset,
	type QualityTier,
	type QualitySettings,
	type QualityContext
} from './quality.svelte';
