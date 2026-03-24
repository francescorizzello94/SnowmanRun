/**
 * Snowball Spawner System
 * Context-aware, stateless spawning logic with fairness rules
 */

import type { GameStateManager, SnowballProfile } from './state.svelte';
import type { DifficultyManager, DifficultyPreset } from './difficulty.svelte';

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

	// Elite profile weights for weighted random selection
	// Distribution: Vortex (30%), Seeker (26%), Fracturer (27%), Heavy (17%)
	// Note: Sum = 1.00 (0.30 + 0.26 + 0.27 + 0.17)
	readonly VORTEX_WEIGHT = 0.3;
	readonly SEEKER_WEIGHT = 0.26;
	readonly FRACTURER_WEIGHT = 0.27;
	readonly HEAVY_WEIGHT = 0.17;

	// Profile-specific tuning parameters
	// SEEKER: Mid-sized homing snowball that adjusts toward player's position
	readonly SEEKER_SCALE_BASE = 0.95;
	readonly SEEKER_SCALE_VARIATION = 0.25;
	readonly SEEKER_SPEED_MUL = 1.05;
	readonly SEEKER_HOMING_STRENGTH = 0.68; // Fraction of distance to close toward player

	// FRACTURER: Large slow snowball that splits into two faster fragments
	readonly FRACTURER_SCALE_BASE = 1.45;
	readonly FRACTURER_SCALE_VARIATION = 0.35;
	readonly FRACTURER_SPEED_MUL = 0.7; // Slower to compensate for split
	readonly FRACTURER_WOBBLE_MUL = 0.85;
	readonly FRACTURER_HOP_MUL = 0.75;
	readonly FRACTURER_Z_BASE = -13.0; // Distance before player where split occurs
	readonly FRACTURER_Z_VARIATION = 4.0;

	// VORTEX: Oscillating snowball that sways side-to-side
	readonly VORTEX_SCALE_BASE = 0.85;
	readonly VORTEX_SCALE_VARIATION = 0.35;
	readonly VORTEX_SPEED_MUL = 0.95;
	readonly VORTEX_FREQ_BASE = 2.5; // Oscillation frequency
	readonly VORTEX_FREQ_VARIATION = 1.8;
	readonly VORTEX_AMP_MAX = 0.95; // Maximum sway amplitude
	readonly VORTEX_AMP_MARGIN = 0.35; // Safety margin from playable bounds

	// HEAVY: Massive slow boulder with large hitbox
	readonly HEAVY_SCALE_BASE = 2.35;
	readonly HEAVY_SCALE_VARIATION = 0.45;
	readonly HEAVY_SPEED_MUL = 0.55; // Much slower due to size
	readonly HEAVY_COLLISION_RADIUS_MUL = 2.1; // Occupies ~1.5 lanes
	readonly HEAVY_WOBBLE_MUL = 0.55;
	readonly HEAVY_HOP_MUL = 0.18; // Minimal hop for massive object

	// Static weight arrays — zero per-spawn allocation
	private static readonly _baseWeights = [1.0, 1.15, 1.45, 1.15, 1.0];
	private readonly _gapWeights = [1.0, 1.05, 0.85, 1.05, 1.0];
	private readonly _weights = [1.0, 1.0, 1.0, 1.0, 1.0];

	// Dependency injection: DifficultyManager instance
	private difficulty: DifficultyManager;

	// Reusable spawn options object — zero per-lane allocation
	private readonly _spawnOpts: {
		profile: SnowballProfile;
		baseX: number;
		speedMul: number;
		collisionRadiusMul: number;
		wobbleMul: number;
		hopMul: number;
		vortexAmp: number;
		vortexFreq: number;
		vortexPhase: number;
		fractureZ: number;
		hasFractured: boolean;
		seekerLocked: boolean;
	} = {
		profile: 'STANDARD',
		baseX: 0,
		speedMul: 1,
		collisionRadiusMul: 1,
		wobbleMul: 1,
		hopMul: 1,
		vortexAmp: 0,
		vortexFreq: 0,
		vortexPhase: 0,
		fractureZ: -12,
		hasFractured: false,
		seekerLocked: false
	};

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

	// Reusable arrays for pickWeightedUnique — zero per-call allocation
	private readonly _picked: number[] = new Array(5).fill(0);
	private readonly _available: boolean[] = new Array(5).fill(true);
	private _pickedCount = 0;

	private pickWeightedUnique(weights: number[], count: number, excludeMask: number): void {
		this._pickedCount = 0;
		for (let i = 0; i < weights.length; i++) {
			this._available[i] = !(excludeMask & (1 << i));
		}

		for (let k = 0; k < count; k++) {
			let sum = 0;
			for (let i = 0; i < weights.length; i++) {
				if (!this._available[i]) continue;
				sum += Math.max(0, weights[i]);
			}
			if (sum <= 0) break;
			let r = Math.random() * sum;
			let chosen = -1;
			for (let i = 0; i < weights.length; i++) {
				if (!this._available[i]) continue;
				r -= Math.max(0, weights[i]);
				if (r <= 0) {
					chosen = i;
					break;
				}
			}
			if (chosen < 0) break;
			this._available[chosen] = false;
			this._picked[this._pickedCount++] = chosen;
		}
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
		// INSANE: cap at 3 blocked lanes to avoid "unavoidable walls"
		return Math.random() < 0.55 + 0.15 * ramp ? 3 : 2;
	}

	private selectProfileByPreset(preset: DifficultyPreset): SnowballProfile {
		// Probability table (explicit):
		// EASY:    80% Standard, 10% Vortex,  5% Seeker,    5% Fracturer, 0% Heavy
		// NORMAL:  55% Standard, 20% Vortex, 12% Seeker,   10% Fracturer, 3% Heavy
		// HARD:    30% Standard, 25% Vortex, 22% Seeker,   18% Fracturer, 5% Heavy
		// INSANE:  10% Standard, 30% Vortex, 26% Seeker,   27% Fracturer, 7% Heavy
		const r = Math.random();
		if (preset === 'EASY') {
			if (r < 0.8) return 'STANDARD';
			if (r < 0.9) return 'VORTEX';
			if (r < 0.95) return 'SEEKER';
			return 'FRACTURER';
		}
		if (preset === 'HARD') {
			if (r < 0.3) return 'STANDARD';
			if (r < 0.55) return 'VORTEX';
			if (r < 0.77) return 'SEEKER';
			if (r < 0.95) return 'FRACTURER';
			return 'HEAVY';
		}
		if (preset === 'INSANE') {
			if (r < 0.1) return 'STANDARD';
			if (r < 0.4) return 'VORTEX';
			if (r < 0.66) return 'SEEKER';
			if (r < 0.93) return 'FRACTURER';
			return 'HEAVY';
		}
		// NORMAL
		if (r < 0.55) return 'STANDARD';
		if (r < 0.75) return 'VORTEX';
		if (r < 0.87) return 'SEEKER';
		if (r < 0.97) return 'FRACTURER';
		return 'HEAVY';
	}

	/**
	 * Select an elite profile using weighted random selection
	 */
	private selectEliteProfile(): SnowballProfile {
		const r = Math.random();
		const vortexThreshold = this.VORTEX_WEIGHT;
		const seekerThreshold = vortexThreshold + this.SEEKER_WEIGHT;
		const fracturerThreshold = seekerThreshold + this.FRACTURER_WEIGHT;

		if (r < vortexThreshold) return 'VORTEX';
		if (r < seekerThreshold) return 'SEEKER';
		if (r < fracturerThreshold) return 'FRACTURER';
		return 'HEAVY';
	}

	/**
	 * Apply profile-specific parameters to snowball
	 * Centralizes all profile configuration logic
	 */
	// Reusable params object — zero per-call allocation
	private readonly _params = {
		scale: 0,
		speedMul: 1,
		collisionRadiusMul: 1,
		wobbleMul: 1,
		hopMul: 1,
		vortexAmp: 0,
		vortexFreq: 0,
		vortexPhase: 0,
		fractureZ: -12,
		adjustedX: 0
	};

	private applyProfileParams(
		profile: SnowballProfile,
		x: number,
		playerX: number
	): typeof this._params {
		const p = this._params;
		// Reset to STANDARD defaults
		p.scale = this.MIN_SCALE + Math.random() * (this.MAX_SCALE - this.MIN_SCALE);
		p.speedMul = 1.0;
		p.collisionRadiusMul = 1.0;
		p.wobbleMul = 1.0;
		p.hopMul = 1.0;
		p.vortexAmp = 0.0;
		p.vortexFreq = 0.0;
		p.vortexPhase = 0.0;
		p.fractureZ = -12.0;
		p.adjustedX = x;

		if (profile === 'SEEKER') {
			p.scale = this.SEEKER_SCALE_BASE + Math.random() * this.SEEKER_SCALE_VARIATION;
			p.speedMul = this.SEEKER_SPEED_MUL;
			p.adjustedX = this.clamp(
				x + (playerX - x) * this.SEEKER_HOMING_STRENGTH,
				this.PLAYABLE_WIDTH_MIN,
				this.PLAYABLE_WIDTH_MAX
			);
		} else if (profile === 'FRACTURER') {
			p.scale = this.FRACTURER_SCALE_BASE + Math.random() * this.FRACTURER_SCALE_VARIATION;
			p.speedMul = this.FRACTURER_SPEED_MUL;
			p.wobbleMul = this.FRACTURER_WOBBLE_MUL;
			p.hopMul = this.FRACTURER_HOP_MUL;
			p.fractureZ = this.FRACTURER_Z_BASE - Math.random() * this.FRACTURER_Z_VARIATION;
		} else if (profile === 'VORTEX') {
			p.scale = this.VORTEX_SCALE_BASE + Math.random() * this.VORTEX_SCALE_VARIATION;
			p.speedMul = this.VORTEX_SPEED_MUL;
			p.vortexFreq = this.VORTEX_FREQ_BASE + Math.random() * this.VORTEX_FREQ_VARIATION;
			p.vortexPhase = Math.random() * Math.PI * 2;
			const roomLeft = x - this.PLAYABLE_WIDTH_MIN;
			const roomRight = this.PLAYABLE_WIDTH_MAX - x;
			const room = Math.max(0.0, Math.min(roomLeft, roomRight) - this.VORTEX_AMP_MARGIN);
			p.vortexAmp = Math.min(this.VORTEX_AMP_MAX, room);
		} else if (profile === 'HEAVY') {
			p.scale = this.HEAVY_SCALE_BASE + Math.random() * this.HEAVY_SCALE_VARIATION;
			p.speedMul = this.HEAVY_SPEED_MUL;
			p.collisionRadiusMul = this.HEAVY_COLLISION_RADIUS_MUL;
			p.wobbleMul = this.HEAVY_WOBBLE_MUL;
			p.hopMul = this.HEAVY_HOP_MUL;
		}

		return p;
	}

	private spawnRow(gameState: GameStateManager, blockedMask: number, zBase: number) {
		for (let lane = 0; lane < this.LANE_COUNT; lane++) {
			if ((blockedMask & (1 << lane)) === 0) continue;
			gameState.spawnerLastBlockedTimes[lane] = gameState.timePlayed;

			const centerX = this.laneCenterX(gameState, lane);
			const jitterX = (Math.random() * 2 - 1) * this.LANE_JITTER_MAX;
			const x = this.clamp(centerX + jitterX, this.PLAYABLE_WIDTH_MIN, this.PLAYABLE_WIDTH_MAX);
			const z = zBase + (Math.random() * 1.2 - 0.6);

			const ramp = Math.min(gameState.timePlayed / 55, 1);
			const preset = gameState.difficultyPreset;
			const playerX = gameState.playerX;

			// Intelligence-first profile selection (anchored to difficulty)
			let profile: SnowballProfile = this.selectProfileByPreset(preset);
			// Slightly increase special density over time (without changing preset identity)
			if (profile === 'STANDARD' && ramp > 0.4 && Math.random() < 0.22) {
				profile = this.selectProfileByPreset(preset);
				if (profile === 'STANDARD') profile = 'SEEKER';
			}

			// Apply profile-specific parameters
			const params = this.applyProfileParams(profile, x, playerX);

			const rotationY = Math.random() * Math.PI * 2;
			const geometryVariant = Math.floor(Math.random() * this.GEOMETRY_VARIANTS);
			this._spawnOpts.profile = profile;
			this._spawnOpts.baseX = params.adjustedX;
			this._spawnOpts.speedMul = params.speedMul;
			this._spawnOpts.collisionRadiusMul = params.collisionRadiusMul;
			this._spawnOpts.wobbleMul = params.wobbleMul;
			this._spawnOpts.hopMul = params.hopMul;
			this._spawnOpts.vortexAmp = params.vortexAmp;
			this._spawnOpts.vortexFreq = params.vortexFreq;
			this._spawnOpts.vortexPhase = params.vortexPhase;
			this._spawnOpts.fractureZ = params.fractureZ;
			this._spawnOpts.hasFractured = false;
			this._spawnOpts.seekerLocked = false;
			gameState.addSnowball(
				params.adjustedX,
				z,
				params.scale,
				rotationY,
				geometryVariant,
				this._spawnOpts
			);
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
			preset === 'EASY' ? 0.05 : preset === 'NORMAL' ? 0.11 : preset === 'HARD' ? 0.16 : 0.22;
		const staggerChance = baseStaggerChance * (0.7 + 0.6 * ramp);

		if (Math.random() < staggerChance) {
			// Pick two gap lanes, then block everything else (3 snowballs on 5 lanes).
			// Ensure the gaps don't repeat the previous pattern too often.
			this._gapWeights[0] = 1.0;
			this._gapWeights[1] = 1.05;
			this._gapWeights[2] = 0.85;
			this._gapWeights[3] = 1.05;
			this._gapWeights[4] = 1.0;
			// Slightly discourage leaving the player's current lane open.
			this._gapWeights[playerLane] *= 0.7;

			// Exclude previous gaps (i.e., lanes that were open last time) with some probability.
			let excludeGapMask = 0;
			if (gameState.spawnerLastPatternMask !== 0 && Math.random() < 0.65) {
				// Previous mask indicates blocked lanes; gaps are the inverse.
				for (let lane = 0; lane < this.LANE_COUNT; lane++) {
					const wasGap = (gameState.spawnerLastPatternMask & (1 << lane)) === 0;
					if (wasGap) excludeGapMask |= 1 << lane;
				}
			}

			this.pickWeightedUnique(this._gapWeights, 2, excludeGapMask);
			// Build gap bitmask from picked results
			let gapMask = 0;
			for (let k = 0; k < this._pickedCount; k++) gapMask |= 1 << this._picked[k];
			let blockedMask = 0;
			for (let lane = 0; lane < this.LANE_COUNT; lane++) {
				if (gapMask & (1 << lane)) continue;
				blockedMask |= 1 << lane;
			}
			// Safety: always leave at least 1 gap.
			if (blockedMask === (1 << this.LANE_COUNT) - 1) {
				blockedMask &= ~(1 << 2);
			}

			this.spawnRow(gameState, blockedMask, this.SPAWN_Z);
			// Follow-up staggered row with different gaps (forces movement).
			// Shift gap lanes by +1 without allocating a new array
			let shiftGapMask = 0;
			for (let k = 0; k < this._pickedCount; k++) {
				shiftGapMask |= 1 << ((this._picked[k] + 1) % this.LANE_COUNT);
			}
			let blockedMask2 = 0;
			for (let lane = 0; lane < this.LANE_COUNT; lane++) {
				if (shiftGapMask & (1 << lane)) continue;
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
		// Reuse static arrays — zero per-spawn allocation
		for (let i = 0; i < this.LANE_COUNT; i++) {
			this._weights[i] = 1;
		}
		for (let i = 0; i < this.LANE_COUNT; i++) {
			const sinceBlocked = gameState.timePlayed - gameState.spawnerLastBlockedTimes[i];
			const heat = this.clamp(sinceBlocked / this.LANE_TARGET_TIMEOUT, 0, 2);
			this._weights[i] = SnowballSpawner._baseWeights[i] * (1 + heat * 1.15);
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
		this.pickWeightedUnique(this._weights, remaining, forcedMask);
		for (let k = 0; k < this._pickedCount; k++) blockedMask |= 1 << this._picked[k];

		// Safety: never block all lanes.
		if (blockedMask === (1 << this.LANE_COUNT) - 1) {
			// Prefer leaving a gap not equal to last lane index (forces weaving).
			let gapLane = 2;
			if (gameState.lastLaneIndex >= 0 && gameState.lastLaneIndex !== 2)
				gapLane = gameState.lastLaneIndex;
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
