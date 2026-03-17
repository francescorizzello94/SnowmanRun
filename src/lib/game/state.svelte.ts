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
 * Rank-Based Progression System
 *
 * Players earn ranks based on survival time. Each rank-up:
 * - Shows a visual prestige indicator in the HUD
 *
 * Note: Rank-ups do not grant invulnerability; dash/jump handle survivability.
 */
export const RANKS = [
	{ name: 'NEWCOMER', threshold: 0, color: '#888888' },
	{ name: 'SURVIVOR', threshold: 15, color: '#4a9eff' },
	{ name: 'FROST WALKER', threshold: 30, color: '#31d3ff' },
	{ name: 'BLIZZARD RUNNER', threshold: 60, color: '#b07cff' },
	{ name: 'AVALANCHE MASTER', threshold: 90, color: '#ffd34d' },
	{ name: 'WINTER LEGEND', threshold: 120, color: '#ff6a3d' }
] as const;

export type RankName = (typeof RANKS)[number]['name'];

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

const MAX_SNOWBALLS = 100;

type SnowballSpawnOptions = {
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
};

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

	// Rank-Based Progression (reactive, UI-affecting)
	currentRankIndex = $state(0);

	// NON-REACTIVE ENGINE STATE (Raw variables - high-frequency updates)
	// CRITICAL: These are updated every frame (60+ times/sec) and MUST remain non-reactive
	// to minimize main-thread jank. Svelte's $state overhead would cause dropped frames.
	playerX: number = 0; // Updated every frame via physics loop
	playerVelocityX: number = 0; // Updated every frame via acceleration
	playerZ: number = 0; // Forward offset for dash (updated in authoritative loop)

	// Forward dash tuning (non-reactive constants)
	private readonly BASE_FORWARD_SPEED = 10; // meters per second (distance tracker)
	private readonly DASH_DISTANCE_STEP = 150; // meters between auto-dashes
	private readonly DASH_DURATION = 2.7; // seconds
	private readonly DASH_SPEED_MULT = 2.0; // multiplier applied to forward speed
	private readonly DASH_Z_OFFSET = -1.6; // forward shove along -Z (visual + collision)

	// Dash state (non-reactive)
	dashStartTime: number = -1e9;
	dashEndTime: number = -1e9;
	lastDashDistance: number = 0;

	// INPUT INTENT (non-reactive)
	// Keyboard + touch should both write to these fields.
	// The render/physics loop reads them without triggering reactivity.
	private digitalLeftHeld: boolean = false;
	private digitalRightHeld: boolean = false;
	private analogActive: boolean = false;
	private analogAxisX: number = 0; // [-1, 1]

	setDigitalLeftHeld(held: boolean) {
		this.digitalLeftHeld = held;
	}

	setDigitalRightHeld(held: boolean) {
		this.digitalRightHeld = held;
	}

	setAnalogAxisX(axis: number) {
		this.analogActive = true;
		this.analogAxisX = Math.max(-1, Math.min(1, axis));
	}

	clearAnalogAxis() {
		this.analogActive = false;
		this.analogAxisX = 0;
	}

	getMoveAxisX(): number {
		if (this.analogActive) return this.analogAxisX;
		const left = this.digitalLeftHeld ? 1 : 0;
		const right = this.digitalRightHeld ? 1 : 0;
		return right - left;
	}

	// Snowball pool - maintained as raw array for O(1) updates
	// CRITICAL: Direct property updates (snowball.z += delta) avoid array searches
	snowballs: Snowball[]; // Fixed-size plain-object pool, not reactive proxies
	nextSnowballId: number = 1;
	private nextSnowballPoolIndex: number = 0;
	private hasLoggedSnowballPoolExhaustion: boolean = false;

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

	// Frost Phase state (non-reactive, high-frequency)
	// Automatic invulnerability triggered by rank progression
	frostPhaseStartTime: number = -1e9;
	frostPhaseEndTime: number = -1e9;

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
		this.snowballs = this.createSnowballPool();

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
		this.playerZ = 0;
		this.digitalLeftHeld = false;
		this.digitalRightHeld = false;
		this.analogActive = false;
		this.analogAxisX = 0;
		this.resetSnowballPool();
		this.nextSnowballId = 1;
		this.nextSnowballPoolIndex = 0;
		this.hasLoggedSnowballPoolExhaustion = false;
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

		// Reset dash state
		this.dashStartTime = -1e9;
		this.dashEndTime = -1e9;
		this.lastDashDistance = 0;

		// Reset Frost Phase state
		this.frostPhaseStartTime = -1e9;
		this.frostPhaseEndTime = -1e9;

		// Reset reactive UI state
		this.milestoneText = null;
		this.milestoneExpiresAt = 0;
		this.dodgedSeekers = 0;
		this.dodgedFracturers = 0;
		this.dodgedVortex = 0;
		this.dodgedHeavies = 0;
		this.currentRankIndex = 0;
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

	/**
	 * Forward Dash System (automatic, distance-based)
	 * Trigger: every DASH_DISTANCE_STEP meters
	 * Effect: temporary forward speed boost + forward shove on Z
	 */
	private startDash(now: number): void {
		if (this.isDashActive(now)) return;
		this.dashStartTime = now;
		this.dashEndTime = now + this.DASH_DURATION;
		this.queueMilestone('DASH!', 0.65);
	}

	checkDashTrigger(distance: number, now: number = this.timePlayed): void {
		const step = this.DASH_DISTANCE_STEP;
		const next = Math.floor(distance / step) * step;
		if (next >= step && next > this.lastDashDistance) {
			this.lastDashDistance = next;
			this.startDash(now);
		}
	}

	isDashActive(now: number = this.timePlayed): boolean {
		return now >= this.dashStartTime && now < this.dashEndTime;
	}

	getDashProgress(now: number = this.timePlayed): number {
		if (!this.isDashActive(now)) return 0;
		const duration = this.dashEndTime - this.dashStartTime;
		const elapsed = now - this.dashStartTime;
		return Math.max(0, Math.min(1, elapsed / Math.max(0.001, duration)));
	}

	getDashIntensity(now: number = this.timePlayed): number {
		const p = this.getDashProgress(now);
		return Math.sin(Math.PI * p);
	}

	getDashSpeedMultiplier(now: number = this.timePlayed): number {
		const intensity = this.getDashIntensity(now);
		return 1 + (this.DASH_SPEED_MULT - 1) * intensity;
	}

	getForwardSpeed(now: number = this.timePlayed): number {
		return this.BASE_FORWARD_SPEED * this.getDashSpeedMultiplier(now);
	}

	getDashZOffset(now: number = this.timePlayed): number {
		return this.DASH_Z_OFFSET * this.getDashIntensity(now);
	}

	updateDashState(now: number = this.timePlayed, distance: number = this.distanceTraveled): void {
		this.checkDashTrigger(distance, now);
		this.playerZ = this.getDashZOffset(now);
	}

	/**
	 * Frost Phase - Automatic Invulnerability System
	 *
	 * Triggered AUTOMATICALLY upon rank-up, providing brief protection
	 * against ALL snowballs (including Heavies, unlike jump).
	 * The player has no control over activation - it's a reward for survival.
	 *
	 * Duration: 2.5s invulnerability
	 * Visual: Ice crystallization effect on player model
	 */

	isFrostPhaseActive(now: number = this.timePlayed): boolean {
		return now >= this.frostPhaseStartTime && now < this.frostPhaseEndTime;
	}

	getFrostPhaseProgress(now: number = this.timePlayed): number {
		if (!this.isFrostPhaseActive(now)) return 0;
		const duration = this.frostPhaseEndTime - this.frostPhaseStartTime;
		const elapsed = now - this.frostPhaseStartTime;
		return Math.max(0, Math.min(1, elapsed / duration));
	}

	/**
	 * Rank Progression Check
	 * Called from the game loop to check for rank-ups.
	 */
	checkRankProgression(now: number = this.timePlayed) {
		const timeSurvived = now;

		// Find the highest rank achieved
		let newRankIndex = 0;
		for (let i = RANKS.length - 1; i >= 0; i--) {
			if (timeSurvived >= RANKS[i].threshold) {
				newRankIndex = i;
				break;
			}
		}

		// Rank up: show milestone
		if (newRankIndex > this.currentRankIndex) {
			const newRank = RANKS[newRankIndex];
			this.currentRankIndex = newRankIndex;
			this.queueMilestone(`RANK UP: ${newRank.name}`, 1.2);
		}
	}

	getCurrentRank(): (typeof RANKS)[number] {
		return RANKS[this.currentRankIndex];
	}

	setDifficultyPreset(preset: DifficultyPreset) {
		this.difficultyPreset = preset;
	}

	toggleSnowfall() {
		this.snowfallEnabled = !this.snowfallEnabled;
	}

	endGame() {
		this.state = 'GAMEOVER';
		this.playerZ = 0;

		// Persist best score (environment-gated)
		if (this.distanceTraveled > this.bestScore) {
			this.bestScore = this.distanceTraveled;
			if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
				localStorage.setItem('snowman-best-score', this.bestScore.toString());
			}
		}
	}

	private createSnowballPool(): Snowball[] {
		const snowballs = new Array<Snowball>(MAX_SNOWBALLS);
		for (let i = 0; i < MAX_SNOWBALLS; i += 1) {
			snowballs[i] = this.createSnowballSlot();
		}
		return snowballs;
	}

	private createSnowballSlot(): Snowball {
		return {
			id: 0,
			x: 0,
			baseX: 0,
			z: 0,
			groundY: 0,
			active: false,
			scale: 0,
			rollAngle: 0,
			rotationY: 0,
			geometryVariant: 0,
			profile: 'STANDARD',
			parentFracturerId: undefined,
			speedMul: 0,
			collisionRadiusMul: 0,
			wobbleMul: 0,
			hopMul: 0,
			vortexAmp: 0,
			vortexFreq: 0,
			vortexPhase: 0,
			fractureZ: 0,
			hasFractured: false,
			seekerLocked: undefined,
			wobbleOffsetX: 0,
			wobbleOffsetZ: 0,
			hopPhase: 0,
			hopFreq: 0
		};
	}

	private resetSnowballSlot(snowball: Snowball): void {
		snowball.id = 0;
		snowball.x = 0;
		snowball.baseX = 0;
		snowball.z = 0;
		snowball.groundY = 0;
		snowball.active = false;
		snowball.scale = 0;
		snowball.rollAngle = 0;
		snowball.rotationY = 0;
		snowball.geometryVariant = 0;
		snowball.profile = 'STANDARD';
		snowball.parentFracturerId = undefined;
		snowball.speedMul = 0;
		snowball.collisionRadiusMul = 0;
		snowball.wobbleMul = 0;
		snowball.hopMul = 0;
		snowball.vortexAmp = 0;
		snowball.vortexFreq = 0;
		snowball.vortexPhase = 0;
		snowball.fractureZ = 0;
		snowball.hasFractured = false;
		snowball.seekerLocked = undefined;
		snowball.wobbleOffsetX = 0;
		snowball.wobbleOffsetZ = 0;
		snowball.hopPhase = 0;
		snowball.hopFreq = 0;
	}

	private resetSnowballPool(): void {
		for (let i = 0; i < this.snowballs.length; i += 1) {
			this.resetSnowballSlot(this.snowballs[i]);
		}
	}

	private acquireSnowballSlot(): Snowball | null {
		const poolSize = this.snowballs.length;
		for (let attempt = 0; attempt < poolSize; attempt += 1) {
			const index = (this.nextSnowballPoolIndex + attempt) % poolSize;
			const snowball = this.snowballs[index];
			if (!snowball.active) {
				this.nextSnowballPoolIndex = (index + 1) % poolSize;
				return snowball;
			}
		}

		if (!this.hasLoggedSnowballPoolExhaustion && typeof console !== 'undefined') {
			console.warn(`[GameStateManager] Snowball pool exhausted (${MAX_SNOWBALLS}). Spawn skipped.`);
			this.hasLoggedSnowballPoolExhaustion = true;
		}

		return null;
	}

	/**
	 * Activate a pre-allocated snowball slot from the fixed pool.
	 * Performance: O(n) scan over a fixed-size array, zero heap allocation.
	 * Returns the activated slot, or null if the pool is exhausted.
	 */
	addSnowball(
		x: number,
		z: number,
		scale: number,
		rotationY: number,
		geometryVariant: number,
		options?: SnowballSpawnOptions
	): Snowball | null {
		const snowball = this.acquireSnowballSlot();
		if (!snowball) return null;

		this.hasLoggedSnowballPoolExhaustion = false;
		snowball.id = this.nextSnowballId++;
		snowball.x = x;
		snowball.baseX = options?.baseX ?? x;
		snowball.z = z;
		snowball.groundY = 0;
		snowball.active = true;
		snowball.scale = scale;
		snowball.rollAngle = 0;
		snowball.rotationY = rotationY;
		snowball.geometryVariant = geometryVariant;
		snowball.profile = options?.profile ?? 'STANDARD';
		snowball.parentFracturerId = options?.parentFracturerId;
		snowball.speedMul = options?.speedMul ?? 1.0;
		snowball.collisionRadiusMul = options?.collisionRadiusMul ?? 1.0;
		snowball.wobbleMul = options?.wobbleMul ?? 1.0;
		snowball.hopMul = options?.hopMul ?? 1.0;
		snowball.vortexAmp = options?.vortexAmp ?? 0.0;
		snowball.vortexFreq = options?.vortexFreq ?? 0.0;
		snowball.vortexPhase = options?.vortexPhase ?? 0.0;
		snowball.fractureZ = options?.fractureZ ?? -12.0;
		snowball.hasFractured = options?.hasFractured ?? false;
		snowball.seekerLocked = options?.seekerLocked;
		snowball.wobbleOffsetX = (Math.random() * 2 - 1) * 0.18;
		snowball.wobbleOffsetZ = (Math.random() * 2 - 1) * 0.14;
		snowball.hopPhase = Math.random() * Math.PI * 2;
		snowball.hopFreq = 7.0 + Math.random() * 7.0;
		return snowball;
	}

	/**
	 * Deactivate a snowball slot by id without mutating pool structure.
	 */
	removeSnowball(id: number) {
		for (let i = 0; i < this.snowballs.length; i += 1) {
			const snowball = this.snowballs[i];
			if (snowball.active && snowball.id === id) {
				this.resetSnowballSlot(snowball);
				return;
			}
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
		this.resetSnowballSlot(snowball);
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
