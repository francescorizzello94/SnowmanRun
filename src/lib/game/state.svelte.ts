/**
 * Game State Management - SSR-Safe Context-Based Architecture
 *
 * Specification Compliance:
 * - Request-safe state isolation via Svelte Context API
 * - Granular reactivity: UI state ($state) vs Engine state (raw)
 * - Performance-optimized with O(1) updates via direct references
 * - High-frequency updates remain strictly non-reactive (raw properties) to minimize main-thread jank
 * - Snowball interface treated as plain object for O(1) direct-reference updates within physics loop
 * - All subsystems scoped to Manager instance to prevent cross-request contamination
 */

import { getContext, setContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { DifficultyManager, type DifficultyPreset } from './difficulty.svelte';
import { SnowballSpawner } from './spawner.svelte';
import { CollisionDetector } from './collision.svelte';

export type GameState = 'LOADING' | 'START' | 'PLAYING' | 'GAMEOVER' | 'ERROR';

export type SnowballProfile = 'STANDARD' | 'SEEKER' | 'FRACTURER' | 'VORTEX' | 'HEAVY' | 'FRAGMENT';

/**
 * Snowball Data Structure
 *
 * Specification Compliance:
 * - Plain object interface (not a class) for minimal overhead
 * - Enables O(1) direct-reference updates in physics loop (snowball.z += speed * delta)
 * - All properties are mutable primitives for maximum performance
 * - No reactive wrappers to avoid main-thread jank during high-frequency updates
 */
export interface Snowball {
	id: number;
	x: number;
	baseX: number;
	z: number;
	groundY: number; // Terrain-snapped Y position from raycast
	active: boolean;
	scale: number; // Procedural variation: 0.4 to 1.2
	rollAngle: number; // Cumulative rotation from simulated rolling
	rotationY: number; // Visual variation: random rotation on Y axis (facing direction)
	geometryVariant: number; // 0, 1, or 2 - index into geometry variants array
	profile: SnowballProfile;

	// Derivative behavior metadata (non-reactive, used for stats bookkeeping)
	parentFracturerId?: number;

	// Motion and behavior modifiers
	speedMul: number;
	collisionRadiusMul: number;
	wobbleMul: number;
	hopMul: number;

	// Vortex profile params
	vortexAmp: number;
	vortexFreq: number;
	vortexPhase: number;

	// Fracturer profile params
	fractureZ: number;
	hasFractured: boolean;

	// Seeker profile params
	seekerLocked?: boolean;

	// Visual-only motion parameters (kept non-reactive)
	wobbleOffsetX: number;
	wobbleOffsetZ: number;
	hopPhase: number;
	hopFreq: number;
}

const GAME_STATE_KEY = Symbol('game-state');

/**
 * Game State Manager
 * Orchestrator Pattern: Instantiates and manages all subsystems
 * Separates reactive UI state from non-reactive engine state for optimal performance
 */
export class GameStateManager {
	// SUBSYSTEMS (Instantiated per game state - SSR-safe)
	readonly difficulty: DifficultyManager;
	readonly spawner: SnowballSpawner;
	readonly collision: CollisionDetector;

	// REACTIVE UI STATE (Svelte $state - for DOM rendering)
	// Only values that directly affect UI rendering should be reactive
	state = $state<GameState>('LOADING');
	distanceTraveled = $state(0);
	timePlayed = $state(0);
	bestScore = $state(0);
	errorMessage = $state<string | null>(null);
	difficultyPreset = $state<DifficultyPreset>('NORMAL');
	snowfallEnabled = $state(true);

	// Milestone feedback (reactive, UI-only)
	// Non-blocking overlay messages for distance/time survival milestones.
	milestoneText = $state<string | null>(null);
	milestoneExpiresAt = $state(0);

	// Final stats (reactive, shown on GAMEOVER)
	dodgedSeekers = $state(0);
	dodgedFracturers = $state(0);
	dodgedVortex = $state(0);
	dodgedHeavies = $state(0);

	// Power-up charges (reactive, shown in HUD)
	frostBurstCharges = $state(0);

	// NON-REACTIVE ENGINE STATE (Raw variables - high-frequency updates)
	// CRITICAL: These are updated every frame (60+ times/sec) and MUST remain non-reactive
	// to minimize main-thread jank. Svelte's $state overhead would cause dropped frames.
	playerX: number = 0; // Updated every frame via physics loop
	playerVelocityX: number = 0; // Updated every frame via acceleration

	// Snowball pool - maintained as raw array for O(1) updates
	// CRITICAL: Direct property updates (snowball.z += delta) avoid array searches
	snowballs: Snowball[] = []; // Plain objects, not reactive proxies
	nextSnowballId: number = 1;

	// Fracturer encounter bookkeeping (non-reactive)
	// FRACTURER parents are removed when they split, so we count them as "dodged"
	// only if all resulting fragments pass the player without collision.
	fracturerEncounters: SvelteMap<number, number> = new SvelteMap();

	// Timing state - non-reactive for performance
	lastSpawnTime: number = 0;
	lastLaneIndex: number = -1;
	sameLaneCount: number = 0;

	// Jump state (non-reactive, read by render + collision loop)
	// Arc timings drive visuals (Player.svelte)
	jumpStartTime: number = -1e9;
	jumpEndTime: number = -1e9;
	// Invulnerability timings drive collision gating (Snowballs.svelte)
	jumpInvulnStartTime: number = -1e9;
	jumpInvulnEndTime: number = -1e9;
	jumpCooldownEndTime: number = 0;

	// Frost Burst milestone tracking + event trigger
	lastFrostBurstAwardIndex: number = 0;
	frostBurstSeq: number = 0;
	frostBurstTime: number = 0;
	frostBurstX: number = 0;
	frostBurstZ: number = 0;

	// Milestone tracking (non-reactive, driven by the single per-frame loop)
	lastDistanceMilestone: number = 0;
	lastTimeMilestoneIndex: number = 0;
	private milestoneQueue: Array<{ text: string; duration: number }> = [];

	// Spawner runtime state (non-reactive): enables anti-safe-zone logic
	spawnerLaneShiftX: number = 0;
	spawnerLaneShiftV: number = 0;
	spawnerLastBlockedTimes: number[] = [];
	spawnerLastPressureTime: number = 0;
	spawnerLastPatternMask: number = 0;

	// Terrain reset hook (registered by the ground component)
	private resetTerrainHook: (() => void) | null = null;

	constructor() {
		// Initialize subsystems with dependency injection
		this.difficulty = new DifficultyManager();
		this.spawner = new SnowballSpawner(this.difficulty);
		this.collision = new CollisionDetector();

		// Environment-gated persistent storage access
		if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('snowman-best-score');
			if (saved) {
				this.bestScore = parseFloat(saved);
			}
		}
	}

	setReady() {
		if (this.state === 'LOADING') {
			this.state = 'START';
		}
	}

	setError(message: string) {
		this.state = 'ERROR';
		this.errorMessage = message;
	}

	startGame() {
		if (this.state !== 'START' && this.state !== 'GAMEOVER') return;
		this.state = 'PLAYING';

		// Reset reactive run counters FIRST so any per-frame systems that depend on
		// time/distance start at a consistent origin.
		this.distanceTraveled = 0;
		this.timePlayed = 0;

		// Hard reset terrain state for a clean new session.
		// (Ground component clears trail markers + restores base noise.)
		this.resetTerrainHook?.();

		// Reset engine state
		this.playerX = 0;
		this.playerVelocityX = 0;
		this.snowballs = [];
		this.nextSnowballId = 1;
		this.fracturerEncounters = new SvelteMap();
		this.lastSpawnTime = 0;
		this.lastLaneIndex = -1;
		this.sameLaneCount = 0;
		this.spawnerLaneShiftX = 0;
		this.spawnerLaneShiftV = 0;
		this.spawnerLastBlockedTimes = [];
		this.spawnerLastPressureTime = 0;
		this.spawnerLastPatternMask = 0;
		this.lastDistanceMilestone = 0;
		this.lastTimeMilestoneIndex = 0;
		this.milestoneQueue = [];
		this.jumpStartTime = -1e9;
		this.jumpEndTime = -1e9;
		this.jumpInvulnStartTime = -1e9;
		this.jumpInvulnEndTime = -1e9;
		this.jumpCooldownEndTime = 0;
		this.lastFrostBurstAwardIndex = 0;
		this.frostBurstSeq = 0;
		this.frostBurstTime = 0;
		this.frostBurstX = 0;
		this.frostBurstZ = 0;

		// Reset reactive UI state
		this.milestoneText = null;
		this.milestoneExpiresAt = 0;
		this.dodgedSeekers = 0;
		this.dodgedFracturers = 0;
		this.dodgedVortex = 0;
		this.dodgedHeavies = 0;
		this.frostBurstCharges = 0;
	}

	registerTerrainResetHook(fn: () => void) {
		this.resetTerrainHook = fn;
	}

	unregisterTerrainResetHook(fn: () => void) {
		if (this.resetTerrainHook === fn) this.resetTerrainHook = null;
	}

	queueMilestone(text: string, duration: number = 0.85) {
		this.milestoneQueue.push({ text, duration });
		this.tickMilestones();
	}

	// Called from the authoritative per-frame loop.
	tickMilestones(now: number = this.timePlayed) {
		// If one is still active, keep it.
		if (this.milestoneText && now < this.milestoneExpiresAt) return;

		// Expired: clear and show next if queued.
		this.milestoneText = null;
		if (this.milestoneQueue.length === 0) return;
		const next = this.milestoneQueue.shift();
		if (!next) return;
		this.milestoneText = next.text;
		this.milestoneExpiresAt = now + next.duration;
	}

	recordDodge(profile: SnowballProfile) {
		// Keep STANDARD plain and FRAGMENT as a derivative behavior.
		if (profile === 'STANDARD' || profile === 'FRAGMENT') return;
		if (profile === 'SEEKER') this.dodgedSeekers += 1;
		else if (profile === 'FRACTURER') this.dodgedFracturers += 1;
		else if (profile === 'VORTEX') this.dodgedVortex += 1;
		else if (profile === 'HEAVY') this.dodgedHeavies += 1;
	}

	registerFracturerSplit(parentFracturerId: number, fragmentCount: number) {
		if (fragmentCount <= 0) return;
		this.fracturerEncounters.set(parentFracturerId, fragmentCount);
	}

	recordFracturerFragmentPassed(parentFracturerId: number) {
		const remaining = this.fracturerEncounters.get(parentFracturerId);
		if (remaining === undefined) return;
		const nextRemaining = remaining - 1;
		if (nextRemaining <= 0) {
			this.fracturerEncounters.delete(parentFracturerId);
			this.recordDodge('FRACTURER');
		} else {
			this.fracturerEncounters.set(parentFracturerId, nextRemaining);
		}
	}

	tryStartJump(now: number = this.timePlayed) {
		if (this.state !== 'PLAYING') return;
		if (now < this.jumpCooldownEndTime) return;

		// Tuned for confidence: small pre/post grace so you can jump slightly early
		// and still clear a standard snowball without pixel-perfect timing.
		const JUMP_DURATION = 0.55;
		const JUMP_COOLDOWN = 0.55;
		const PRE_GRACE = 0.08;
		const POST_GRACE = 0.08;
		this.jumpStartTime = now;
		this.jumpEndTime = now + JUMP_DURATION;
		this.jumpInvulnStartTime = now - PRE_GRACE;
		this.jumpInvulnEndTime = now + JUMP_DURATION + POST_GRACE;
		this.jumpCooldownEndTime = now + JUMP_COOLDOWN;
	}

	cancelJump(now: number = this.timePlayed) {
		// Immediate landing: stop arc and remove invulnerability.
		this.jumpEndTime = Math.min(this.jumpEndTime, now);
		this.jumpInvulnEndTime = Math.min(this.jumpInvulnEndTime, now);
	}

	tryActivateFrostBurst(playerX: number, playerZ: number, now: number = this.timePlayed) {
		if (this.state !== 'PLAYING') return;
		if (this.frostBurstCharges <= 0) return;
		this.frostBurstCharges -= 1;
		this.frostBurstSeq += 1;
		this.frostBurstTime = now;
		this.frostBurstX = playerX;
		this.frostBurstZ = playerZ;
		this.queueMilestone('FROST BURST!');
	}

	setDifficultyPreset(preset: DifficultyPreset) {
		this.difficultyPreset = preset;
	}

	toggleSnowfall() {
		this.snowfallEnabled = !this.snowfallEnabled;
	}

	endGame() {
		this.state = 'GAMEOVER';

		// Persist best score (environment-gated)
		if (this.distanceTraveled > this.bestScore) {
			this.bestScore = this.distanceTraveled;
			if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
				localStorage.setItem('snowman-best-score', this.bestScore.toString());
			}
		}
	}

	/**
	 * Add snowball to pool
	 * Performance: O(1) array push
	 * Procedural Variation: Randomizes scale, rotation, and geometry variant
	 */
	addSnowball(
		x: number,
		z: number,
		scale: number,
		rotationY: number,
		geometryVariant: number,
		options?: {
			profile?: SnowballProfile;
			speedMul?: number;
			collisionRadiusMul?: number;
			wobbleMul?: number;
			hopMul?: number;
			baseX?: number;
			parentFracturerId?: number;
			vortexAmp?: number;
			vortexFreq?: number;
			vortexPhase?: number;
			fractureZ?: number;
			hasFractured?: boolean;
			seekerLocked?: boolean;
		}
	) {
		this.snowballs.push({
			id: this.nextSnowballId++,
			x,
			baseX: options?.baseX ?? x,
			z,
			groundY: 0, // Will be set by terrain snapping
			active: true,
			scale,
			rollAngle: 0, // Starting rotation
			rotationY,
			geometryVariant,
			profile: options?.profile ?? 'STANDARD',
			parentFracturerId: options?.parentFracturerId,
			speedMul: options?.speedMul ?? 1.0,
			collisionRadiusMul: options?.collisionRadiusMul ?? 1.0,
			wobbleMul: options?.wobbleMul ?? 1.0,
			hopMul: options?.hopMul ?? 1.0,
			vortexAmp: options?.vortexAmp ?? 0.0,
			vortexFreq: options?.vortexFreq ?? 0.0,
			vortexPhase: options?.vortexPhase ?? 0.0,
			fractureZ: options?.fractureZ ?? -12.0,
			hasFractured: options?.hasFractured ?? false,
			wobbleOffsetX: (Math.random() * 2 - 1) * 0.18,
			wobbleOffsetZ: (Math.random() * 2 - 1) * 0.14,
			hopPhase: Math.random() * Math.PI * 2,
			hopFreq: 7.0 + Math.random() * 7.0
		});
	}

	/**
	 * Remove snowball from pool
	 * Performance: O(n) but called infrequently (only on cleanup)
	 */
	removeSnowball(id: number) {
		const index = this.snowballs.findIndex((s) => s.id === id);
		if (index >= 0) {
			this.snowballs.splice(index, 1);
		}
	}

	/**
	 * Update snowball position directly (O(1) via reference)
	 * This is called every frame, so we maintain direct reference
	 */
	updateSnowballDirect(snowball: Snowball, z: number) {
		snowball.z = z;
	}

	/**
	 * Deactivate snowball (O(1) via reference)
	 */
	deactivateSnowballDirect(snowball: Snowball) {
		snowball.active = false;
	}
}

/**
 * CONTEXT API: Create and inject game state manager
 * This ensures SSR-safe, request-scoped state isolation
 */
export function createGameState(): GameStateManager {
	const state = new GameStateManager();
	setContext(GAME_STATE_KEY, state);
	return state;
}

/**
 * CONTEXT API: Retrieve game state manager
 * Dependency injection pattern for clean testing and component decoupling
 */
export function getGameState(): GameStateManager {
	const state = getContext<GameStateManager>(GAME_STATE_KEY);
	if (!state) {
		throw new Error(
			'Game state not found in context. Did you forget to call createGameState() in a parent component?'
		);
	}
	return state;
}
