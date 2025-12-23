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
	readonly LANE_SHIFT_MAX = 0.9; // Dynamic lane drift amplitude
	readonly LANE_JITTER_MAX = 0.22; // Per-snowball micro offset (breaks perfect tracks)
	readonly LANE_TARGET_TIMEOUT = 2.75; // No lane stays "untargeted" longer than this
	readonly STAGGER_ROW_GAP_Z = 2.2; // Distance between staggered rows
	readonly MIN_SCALE = 0.5; // Procedural variation: smallest snowball
	readonly MAX_SCALE = 1.3; // Procedural variation: largest snowball
	readonly GEOMETRY_VARIANTS = 3; // Number of geometry variations

	// Dependency injection: DifficultyManager instance
	private difficulty: DifficultyManager;

	constructor(difficulty: DifficultyManager) {
		this.difficulty = difficulty;
	}

	private clamp(x: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, x));
	}

	private ensureSpawnerState(gameState: GameStateManager) {
		if (gameState.spawnerLastBlockedTimes.length !== this.LANE_COUNT) {
			gameState.spawnerLastBlockedTimes = new Array<number>(this.LANE_COUNT).fill(-1e9);
		}
	}

	private getLaneX(laneIndex: number): number {
		const t = this.LANE_COUNT <= 1 ? 0.5 : laneIndex / (this.LANE_COUNT - 1);
		return this.PLAYABLE_WIDTH_MIN + (this.PLAYABLE_WIDTH_MAX - this.PLAYABLE_WIDTH_MIN) * t;
	}

	private updateLaneShift(gameState: GameStateManager) {
		// Stateless spawner: store lane shift in gameState.
		const dt = this.clamp(gameState.timePlayed - gameState.lastSpawnTime, 0.0, 2.0);
		// Random-walk drift with damping.
		const accel = (Math.random() * 2 - 1) * 1.2;
		gameState.spawnerLaneShiftV = gameState.spawnerLaneShiftV * 0.75 + accel * dt;
		gameState.spawnerLaneShiftX += gameState.spawnerLaneShiftV * 0.18;
		gameState.spawnerLaneShiftX = this.clamp(
			gameState.spawnerLaneShiftX,
			-this.LANE_SHIFT_MAX,
			this.LANE_SHIFT_MAX
		);
	}

	private laneCenterX(gameState: GameStateManager, laneIndex: number): number {
		const base = this.getLaneX(laneIndex);
		// Keep margin so jitter never spills outside the playable bounds.
		const margin = 0.35;
		return this.clamp(
			base + gameState.spawnerLaneShiftX,
			this.PLAYABLE_WIDTH_MIN + margin,
			this.PLAYABLE_WIDTH_MAX - margin
		);
	}

	private findClosestLane(gameState: GameStateManager, x: number): number {
		let bestLane = 0;
		let bestDist = Infinity;
		for (let i = 0; i < this.LANE_COUNT; i++) {
			const dx = Math.abs(this.laneCenterX(gameState, i) - x);
			if (dx < bestDist) {
				bestDist = dx;
				bestLane = i;
			}
		}
		return bestLane;
	}

	private pickWeightedUnique(
		weights: number[],
		count: number,
		excludeMask: number
	): number[] {
		const picked: number[] = [];
		const available = new Array<boolean>(weights.length).fill(true);
		for (let i = 0; i < weights.length; i++) {
			if (excludeMask & (1 << i)) available[i] = false;
		}

		for (let k = 0; k < count; k++) {
			let sum = 0;
			for (let i = 0; i < weights.length; i++) {
				if (!available[i]) continue;
				sum += Math.max(0, weights[i]);
			}
			if (sum <= 0) break;
			let r = Math.random() * sum;
			let chosen = -1;
			for (let i = 0; i < weights.length; i++) {
				if (!available[i]) continue;
				r -= Math.max(0, weights[i]);
				if (r <= 0) {
					chosen = i;
					break;
				}
			}
			if (chosen < 0) break;
			available[chosen] = false;
			picked.push(chosen);
		}
		return picked;
	}

	private getBlockCount(gameState: GameStateManager): number {
		const preset = gameState.difficultyPreset;
		const ramp = Math.min(gameState.timePlayed / 45, 1);

		// Block count = how many lanes we place snowballs in this spawn "row".
		// Keep pressure high enough to prevent a permanent "lucky" idle spot.
		// Must always leave at least 1 lane open.
		if (preset === 'EASY') return Math.random() < 0.6 ? 1 : 2;
		if (preset === 'NORMAL') return Math.random() < 0.35 + 0.25 * ramp ? 3 : 2;
		if (preset === 'HARD') return Math.random() < 0.6 + 0.2 * ramp ? 3 : 2;
		// INSANE: frequent 3-lane blocks, occasional 4-lane near-walls (still fair)
		return Math.random() < 0.18 + 0.22 * ramp ? 4 : 3;
	}

	private spawnRow(gameState: GameStateManager, blockedMask: number, zBase: number) {
		for (let lane = 0; lane < this.LANE_COUNT; lane++) {
			if ((blockedMask & (1 << lane)) === 0) continue;
			gameState.spawnerLastBlockedTimes[lane] = gameState.timePlayed;

			const centerX = this.laneCenterX(gameState, lane);
			const jitterX = (Math.random() * 2 - 1) * this.LANE_JITTER_MAX;
			const x = this.clamp(centerX + jitterX, this.PLAYABLE_WIDTH_MIN, this.PLAYABLE_WIDTH_MAX);
			const z = zBase + (Math.random() * 1.2 - 0.6);

			const scale = this.MIN_SCALE + Math.random() * (this.MAX_SCALE - this.MIN_SCALE);
			const rotationY = Math.random() * Math.PI * 2;
			const geometryVariant = Math.floor(Math.random() * this.GEOMETRY_VARIANTS);
			gameState.addSnowball(x, z, scale, rotationY, geometryVariant);
		}
	}

	/**
	 * Spawn snowballs using a lane system
	 * Mutates gameState directly for O(1) performance
	 */
	spawn(gameState: GameStateManager) {
		this.ensureSpawnerState(gameState);
		this.updateLaneShift(gameState);

		const preset = gameState.difficultyPreset;
		const ramp = Math.min(gameState.timePlayed / 55, 1);
		const playerLane = this.findClosestLane(gameState, gameState.playerX);

		// Pattern selection: occasionally spawn staggered "walls" to force lateral movement.
		const baseStaggerChance =
			preset === 'EASY'
				? 0.05
				: preset === 'NORMAL'
					? 0.11
					: preset === 'HARD'
						? 0.16
						: 0.22;
		const staggerChance = baseStaggerChance * (0.7 + 0.6 * ramp);

		if (Math.random() < staggerChance) {
			// Pick two gap lanes, then block everything else (3 snowballs on 5 lanes).
			// Ensure the gaps don't repeat the previous pattern too often.
			const gapWeights = [1.0, 1.05, 0.85, 1.05, 1.0];
			// Slightly discourage leaving the player's current lane open.
			gapWeights[playerLane] *= 0.7;

			// Exclude previous gaps (i.e., lanes that were open last time) with some probability.
			let excludeGapMask = 0;
			if (gameState.spawnerLastPatternMask !== 0 && Math.random() < 0.65) {
				// Previous mask indicates blocked lanes; gaps are the inverse.
				for (let lane = 0; lane < this.LANE_COUNT; lane++) {
					const wasGap = (gameState.spawnerLastPatternMask & (1 << lane)) === 0;
					if (wasGap) excludeGapMask |= 1 << lane;
				}
			}

			const gaps = this.pickWeightedUnique(gapWeights, 2, excludeGapMask);
			let blockedMask = 0;
			for (let lane = 0; lane < this.LANE_COUNT; lane++) {
				if (gaps.includes(lane)) continue;
				blockedMask |= 1 << lane;
			}
			// Safety: always leave at least 1 gap.
			if (blockedMask === (1 << this.LANE_COUNT) - 1) {
				blockedMask &= ~(1 << 2);
			}

			this.spawnRow(gameState, blockedMask, this.SPAWN_Z);
			// Follow-up staggered row with different gaps (forces movement).
			const shiftGaps = gaps.map((g) => (g + 1) % this.LANE_COUNT);
			let blockedMask2 = 0;
			for (let lane = 0; lane < this.LANE_COUNT; lane++) {
				if (shiftGaps.includes(lane)) continue;
				blockedMask2 |= 1 << lane;
			}
			if (blockedMask2 === (1 << this.LANE_COUNT) - 1) {
				blockedMask2 &= ~(1 << 2);
			}
			this.spawnRow(gameState, blockedMask2, this.SPAWN_Z - this.STAGGER_ROW_GAP_Z);

			gameState.spawnerLastPatternMask = blockedMask2;
			return;
		}

		// Default pattern: weighted row that targets neglected lanes and pressures idle players.
		const blockCountRaw = this.getBlockCount(gameState);
		const blockCount = Math.min(blockCountRaw, this.LANE_COUNT - 1);

		// Base weights: center lane equal or higher frequency than edges.
		const baseWeights = [1.0, 1.15, 1.45, 1.15, 1.0];
		const weights = new Array<number>(this.LANE_COUNT).fill(1);
		for (let i = 0; i < this.LANE_COUNT; i++) {
			const sinceBlocked = gameState.timePlayed - gameState.spawnerLastBlockedTimes[i];
			const heat = this.clamp(sinceBlocked / this.LANE_TARGET_TIMEOUT, 0, 2);
			weights[i] = baseWeights[i] * (1 + heat * 1.15);
		}

		// Force-include any lane that has been "too safe" for too long.
		let forcedMask = 0;
		let mostNeglectedLane = 0;
		let mostNeglectedTime = -Infinity;
		for (let i = 0; i < this.LANE_COUNT; i++) {
			const sinceBlocked = gameState.timePlayed - gameState.spawnerLastBlockedTimes[i];
			if (sinceBlocked > mostNeglectedTime) {
				mostNeglectedTime = sinceBlocked;
				mostNeglectedLane = i;
			}
		}
		if (mostNeglectedTime > this.LANE_TARGET_TIMEOUT) {
			forcedMask |= 1 << mostNeglectedLane;
		}

		// Periodically pressure the player's current lane (prevents stationary exploits).
		const pressureCooldown = 1.6;
		const pressureChance = 0.25 + 0.35 * ramp;
		if (
			gameState.timePlayed - gameState.spawnerLastPressureTime >= pressureCooldown &&
			Math.random() < pressureChance
		) {
			forcedMask |= 1 << playerLane;
			gameState.spawnerLastPressureTime = gameState.timePlayed;
		}

		// Choose remaining lanes to block via weighted random.
		let blockedMask = forcedMask;
		const forcedCount =
			(forcedMask & 1) +
			((forcedMask >> 1) & 1) +
			((forcedMask >> 2) & 1) +
			((forcedMask >> 3) & 1) +
			((forcedMask >> 4) & 1);
		const remaining = Math.max(0, blockCount - forcedCount);
		const picked = this.pickWeightedUnique(weights, remaining, forcedMask);
		for (const lane of picked) blockedMask |= 1 << lane;

		// Safety: never block all lanes.
		if (blockedMask === (1 << this.LANE_COUNT) - 1) {
			// Prefer leaving a gap not equal to last lane index (forces weaving).
			let gapLane = 2;
			if (gameState.lastLaneIndex >= 0 && gameState.lastLaneIndex !== 2) gapLane = gameState.lastLaneIndex;
			blockedMask &= ~(1 << gapLane);
		}

		// Update weaving tracker based on chosen primary gap.
		let chosenGap = -1;
		for (let lane = 0; lane < this.LANE_COUNT; lane++) {
			if ((blockedMask & (1 << lane)) === 0) {
				chosenGap = lane;
				break;
			}
		}
		if (chosenGap >= 0) {
			if (chosenGap === gameState.lastLaneIndex) {
				gameState.sameLaneCount += 1;
			} else {
				gameState.lastLaneIndex = chosenGap;
				gameState.sameLaneCount = 0;
			}
		}

		this.spawnRow(gameState, blockedMask, this.SPAWN_Z);
		gameState.spawnerLastPatternMask = blockedMask;
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
