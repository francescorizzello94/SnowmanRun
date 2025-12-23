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
	readonly PLAYABLE_WIDTH_MIN = -7.0; // Left boundary
	readonly PLAYABLE_WIDTH_MAX = 7.0; // Right boundary
	readonly LANE_COUNT = 5;
	readonly MIN_SCALE = 0.5; // Procedural variation: smallest snowball
	readonly MAX_SCALE = 1.3; // Procedural variation: largest snowball
	readonly GEOMETRY_VARIANTS = 3; // Number of geometry variations

	// Dependency injection: DifficultyManager instance
	private difficulty: DifficultyManager;

	constructor(difficulty: DifficultyManager) {
		this.difficulty = difficulty;
	}

	private getLaneX(laneIndex: number): number {
		const t = this.LANE_COUNT <= 1 ? 0.5 : laneIndex / (this.LANE_COUNT - 1);
		return this.PLAYABLE_WIDTH_MIN + (this.PLAYABLE_WIDTH_MAX - this.PLAYABLE_WIDTH_MIN) * t;
	}

	private getBlockCount(gameState: GameStateManager): number {
		const preset = gameState.difficultyPreset;
		const ramp = Math.min(gameState.timePlayed / 45, 1);

		// Block count = how many lanes we place snowballs in this spawn "row".
		// Must always leave at least 1 lane open.
		if (preset === 'EASY') return 1;
		if (preset === 'NORMAL') return Math.random() < 0.65 ? 2 : 1;
		if (preset === 'HARD') return Math.random() < 0.75 + 0.1 * ramp ? 3 : 2;
		// INSANE: frequent 3-lane blocks, occasional 4-lane near-walls (still fair)
		return Math.random() < 0.25 + 0.25 * ramp ? 4 : 3;
	}

	private pickSafeLane(gameState: GameStateManager): number {
		const candidates: number[] = [];
		for (let i = 0; i < this.LANE_COUNT; i++) candidates.push(i);

		// Force weaving: avoid staying safe in the same lane too long
		if (gameState.sameLaneCount >= 1 && candidates.length > 1) {
			const idx = candidates.indexOf(gameState.lastLaneIndex);
			if (idx >= 0) candidates.splice(idx, 1);
		}

		// Strong bias against repeating the last safe lane
		if (candidates.length > 1) {
			const idx = candidates.indexOf(gameState.lastLaneIndex);
			if (idx >= 0 && Math.random() < 0.85) candidates.splice(idx, 1);
		}

		return candidates[Math.floor(Math.random() * candidates.length)] ?? 0;
	}

	/**
	 * Spawn snowballs using a lane system
	 * Mutates gameState directly for O(1) performance
	 */
	spawn(gameState: GameStateManager) {
		// 1) Choose the safe lane (opening) and update fairness tracking.
		const safeLane = this.pickSafeLane(gameState);
		if (safeLane === gameState.lastLaneIndex) {
			gameState.sameLaneCount += 1;
		} else {
			gameState.lastLaneIndex = safeLane;
			gameState.sameLaneCount = 0;
		}

		// 2) Choose how many lanes to block this row.
		const blockCountRaw = this.getBlockCount(gameState);
		const blockCount = Math.min(blockCountRaw, this.LANE_COUNT - 1);

		// 3) Pick blocked lanes (excluding safe lane), spread across width.
		const blocked = new Array<boolean>(this.LANE_COUNT).fill(false);
		blocked[safeLane] = false;

		const candidates: number[] = [];
		for (let i = 0; i < this.LANE_COUNT; i++) {
			if (i !== safeLane) candidates.push(i);
		}
		// Shuffle candidates
		for (let i = candidates.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const tmp = candidates[i];
			candidates[i] = candidates[j];
			candidates[j] = tmp;
		}
		for (let i = 0; i < blockCount; i++) {
			blocked[candidates[i]] = true;
		}

		// 4) Spawn snowballs in blocked lanes at the same "row" Z.
		for (let lane = 0; lane < this.LANE_COUNT; lane++) {
			if (!blocked[lane]) continue;
			const x = this.getLaneX(lane);
			const z = this.SPAWN_Z + (Math.random() * 1.2 - 0.6);

			const scale = this.MIN_SCALE + Math.random() * (this.MAX_SCALE - this.MIN_SCALE);
			const rotationY = Math.random() * Math.PI * 2;
			const geometryVariant = Math.floor(Math.random() * this.GEOMETRY_VARIANTS);
			gameState.addSnowball(x, z, scale, rotationY, geometryVariant);
		}
	}

	/**
	 * Check if it's time to spawn based on difficulty
	 */
	shouldSpawn(gameState: GameStateManager): boolean {
		const interval = this.difficulty.getSpawnInterval(
			gameState.timePlayed,
			gameState.difficultyPreset
		);
		return gameState.timePlayed - gameState.lastSpawnTime >= interval;
	}
}
