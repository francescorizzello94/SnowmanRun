/**
 * Snowball Spawner System
 * Context-aware, stateless spawning logic with fairness rules
 */

import type { GameStateManager } from './state.svelte';
import type { DifficultyManager } from './difficulty.svelte';

/**
 * Snowball Spawner System
 *
 * Specification Compliance:
 * - No internal state - all mutations go through GameStateManager
 * - Operates via O(1) direct property updates on gameState
 * - DifficultyManager injected via constructor (dependency inversion)
 * - Scoped to GameStateManager instance to prevent cross-request contamination
 */
export class SnowballSpawner {
	// Tuning constants
	readonly SPAWN_Z = -60; // Spawn far away (outside fog/frustum)
	readonly PLAYABLE_WIDTH_MIN = -8.0; // Left boundary
	readonly PLAYABLE_WIDTH_MAX = 8.0; // Right boundary
	readonly MIN_SCALE = 0.5; // Procedural variation: smallest snowball
	readonly MAX_SCALE = 1.3; // Procedural variation: largest snowball
	readonly GEOMETRY_VARIANTS = 3; // Number of geometry variations

	// Fairness tracking
	private lastSpawnX: number = 0;
	readonly MIN_SPAWN_DISTANCE = 3.0; // Minimum X distance between consecutive spawns

	// Dependency injection: DifficultyManager instance
	private difficulty: DifficultyManager;

	constructor(difficulty: DifficultyManager) {
		this.difficulty = difficulty;
	}

	/**
	 * Spawn a new snowball with full random distribution across playable width
	 * Mutates gameState directly for O(1) performance
	 */
	spawn(gameState: GameStateManager) {
		// Generate random X position across full playable width
		let x: number;
		let attempts = 0;

		do {
			x =
				this.PLAYABLE_WIDTH_MIN +
				Math.random() * (this.PLAYABLE_WIDTH_MAX - this.PLAYABLE_WIDTH_MIN);
			attempts++;
		} while (Math.abs(x - this.lastSpawnX) < this.MIN_SPAWN_DISTANCE && attempts < 5);

		this.lastSpawnX = x;

		// Procedural variation: randomize scale, rotation, and geometry
		const scale = this.MIN_SCALE + Math.random() * (this.MAX_SCALE - this.MIN_SCALE);
		const rotationY = Math.random() * Math.PI * 2;
		const geometryVariant = Math.floor(Math.random() * this.GEOMETRY_VARIANTS);

		gameState.addSnowball(x, this.SPAWN_Z, scale, rotationY, geometryVariant);
	}

	/**
	 * Check if it's time to spawn based on difficulty
	 */
	shouldSpawn(timePlayed: number, lastSpawnTime: number): boolean {
		const interval = this.difficulty.getSpawnInterval(timePlayed);
		return timePlayed - lastSpawnTime >= interval;
	}
}
