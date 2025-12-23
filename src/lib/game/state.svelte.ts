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

	// NON-REACTIVE ENGINE STATE (Raw variables - high-frequency updates)
	// CRITICAL: These are updated every frame (60+ times/sec) and MUST remain non-reactive
	// to minimize main-thread jank. Svelte's $state overhead would cause dropped frames.
	playerX: number = 0; // Updated every frame via physics loop
	playerVelocityX: number = 0; // Updated every frame via acceleration

	// Snowball pool - maintained as raw array for O(1) updates
	// CRITICAL: Direct property updates (snowball.z += delta) avoid array searches
	snowballs: Snowball[] = []; // Plain objects, not reactive proxies
	nextSnowballId: number = 1;

	// Timing state - non-reactive for performance
	lastSpawnTime: number = 0;
	lastLaneIndex: number = -1;
	sameLaneCount: number = 0;

	// Spawner runtime state (non-reactive): enables anti-safe-zone logic
	spawnerLaneShiftX: number = 0;
	spawnerLaneShiftV: number = 0;
	spawnerLastBlockedTimes: number[] = [];
	spawnerLastPressureTime: number = 0;
	spawnerLastPatternMask: number = 0;

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

		// Reset engine state
		this.playerX = 0;
		this.playerVelocityX = 0;
		this.snowballs = [];
		this.nextSnowballId = 1;
		this.lastSpawnTime = 0;
		this.lastLaneIndex = -1;
		this.sameLaneCount = 0;
		this.spawnerLaneShiftX = 0;
		this.spawnerLaneShiftV = 0;
		this.spawnerLastBlockedTimes = [];
		this.spawnerLastPressureTime = 0;
		this.spawnerLastPatternMask = 0;

		// Reset reactive UI state
		this.distanceTraveled = 0;
		this.timePlayed = 0;
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
			vortexAmp?: number;
			vortexFreq?: number;
			vortexPhase?: number;
			fractureZ?: number;
			hasFractured?: boolean;
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
