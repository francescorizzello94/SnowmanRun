/**
 * Difficulty Scaling System
 *
 * Specification Compliance:
 * - Pure logic manager with no internal state
 * - All methods are pure functions (input → output, no side effects)
 * - Scoped to GameStateManager instance to prevent cross-request contamination
 * - Safe for concurrent SvelteKit SSR execution
 */
export class DifficultyManager {
	// Tuning constants
	readonly INITIAL_SPAWN_INTERVAL = 2.0; // seconds (was 1.5 - easier start)
	readonly MIN_SPAWN_INTERVAL = 0.4; // seconds (was 0.25 - less chaotic)
	readonly INITIAL_SPEED = 6; // units/second (was 8 - easier to react)
	readonly MAX_SPEED = 18; // units/second (was 20 - slightly less punishing)
	readonly DIFFICULTY_RAMP_TIME = 90; // seconds (was 60 - more gradual ramp)

	getSpawnInterval(timePlayed: number): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		return (
			this.INITIAL_SPAWN_INTERVAL - (this.INITIAL_SPAWN_INTERVAL - this.MIN_SPAWN_INTERVAL) * t
		);
	}

	getSnowballSpeed(timePlayed: number): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		return this.INITIAL_SPEED + (this.MAX_SPEED - this.INITIAL_SPEED) * t;
	}
}
