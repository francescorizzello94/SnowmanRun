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
	// Difficulty is anchored to the player's chosen preset.
	// Each preset has its own bounds so EASY never ramps into HARD/INSANE behavior.
	readonly DIFFICULTY_RAMP_TIME = 60; // seconds

	/**
	 * Returns difficulty-specific bounds for spawn interval and speed scaling
	 * 
	 * Design Principle: "Anchored Presets" — each difficulty maintains its identity
	 * throughout the session. EASY never escalates into HARD territory, preventing
	 * frustration from unexpected difficulty spikes.
	 * 
	 * Implementation: Each preset has independent initial and target values. The
	 * curve is applied via linear interpolation over DIFFICULTY_RAMP_TIME (60s).
	 * 
	 * Tuning Notes:
	 * - Spawn intervals: Lower = more frequent obstacles
	 * - Speed ranges: Higher = faster-moving obstacles
	 * - EASY caps at 14.5 speed while INSANE reaches 28.5 (nearly 2× faster)
	 * - EASY min spawn interval (0.95s) is slower than HARD initial (1.25s)
	 * 
	 * @param preset - The difficulty level (EASY/NORMAL/HARD/INSANE)
	 * @returns Bounds object with spawn and speed ranges
	 */
	private presetCurve(preset: DifficultyPreset): {
		spawnInitial: number;
		spawnMin: number;
		speedInitial: number;
		speedMax: number;
	} {
		switch (preset) {
			case 'EASY':
				return {
					spawnInitial: 1.7,
					spawnMin: 0.95,
					speedInitial: 7.5,
					speedMax: 14.5
				};
			case 'HARD':
				return {
					spawnInitial: 1.25,
					spawnMin: 0.55,
					speedInitial: 8.5,
					speedMax: 23.5
				};
			case 'INSANE':
				return {
					spawnInitial: 1.05,
					spawnMin: 0.45,
					speedInitial: 9.0,
					speedMax: 28.5
				};
			case 'NORMAL':
			default:
				return {
					spawnInitial: 1.5,
					spawnMin: 0.7,
					speedInitial: 8.0,
					speedMax: 19.5
				};
		}
	}

	getSpawnInterval(timePlayed: number, preset: DifficultyPreset = 'NORMAL'): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		const c = this.presetCurve(preset);
		return c.spawnInitial - (c.spawnInitial - c.spawnMin) * t;
	}

	getSnowballSpeed(timePlayed: number, preset: DifficultyPreset = 'NORMAL'): number {
		const t = Math.min(timePlayed / this.DIFFICULTY_RAMP_TIME, 1);
		const c = this.presetCurve(preset);
		return c.speedInitial + (c.speedMax - c.speedInitial) * t;
	}
}
