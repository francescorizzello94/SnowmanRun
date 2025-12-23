/**
 * Difficulty Scaling System
 *
 * Specification Compliance:
 * - Pure logic manager with no internal state
 * - All methods are pure functions (input → output, no side effects)
 * - Scoped to GameStateManager instance to prevent cross-request contamination
 * - Safe for concurrent SvelteKit SSR execution
 */
export type DifficultyPreset = 'EASY' | 'NORMAL' | 'HARD' | 'INSANE';

export class DifficultyManager {
	// Tuning constants
	readonly INITIAL_SPAWN_INTERVAL = 1.6; // seconds
	readonly MIN_SPAWN_INTERVAL = 0.2; // seconds
	readonly INITIAL_SPEED = 8; // units/second
	readonly MAX_SPEED = 30; // units/second
	readonly DIFFICULTY_RAMP_TIME = 60; // seconds

	private getPresetMultipliers(preset: DifficultyPreset): {
		spawnIntervalMul: number;
		speedMul: number;
	} {
		switch (preset) {
			case 'EASY':
					return { spawnIntervalMul: 1.35, speedMul: 0.85 };
			case 'HARD':
					return { spawnIntervalMul: 0.65, speedMul: 1.35 };
			case 'INSANE':
					return { spawnIntervalMul: 0.45, speedMul: 1.65 };
			case 'NORMAL':
			default:
				return { spawnIntervalMul: 1.0, speedMul: 1.0 };
		}
	}

	getSpawnInterval(timePlayed: number, preset: DifficultyPreset = 'NORMAL'): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		const base =
			this.INITIAL_SPAWN_INTERVAL - (this.INITIAL_SPAWN_INTERVAL - this.MIN_SPAWN_INTERVAL) * t;
		return base * this.getPresetMultipliers(preset).spawnIntervalMul;
	}

	getSnowballSpeed(timePlayed: number, preset: DifficultyPreset = 'NORMAL'): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		const base = this.INITIAL_SPEED + (this.MAX_SPEED - this.INITIAL_SPEED) * t;
		return base * this.getPresetMultipliers(preset).speedMul;
	}
}
