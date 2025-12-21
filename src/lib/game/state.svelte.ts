/**
 * Game State Management - SSR-Safe Context-Based Architecture
 *
 * Specification Compliance:
 * - Request-safe state isolation via Svelte Context API
 * - Granular reactivity: UI state ($state) vs Engine state (raw)
 * - Performance-optimized with O(1) updates via direct references
 */

import { getContext, setContext } from 'svelte';

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

export interface Snowball {
	id: number;
	x: number;
	z: number;
	active: boolean;
}

const GAME_STATE_KEY = Symbol('game-state');

/**
 * Game State Manager
 * Separates reactive UI state from non-reactive engine state for optimal performance
 */
export class GameStateManager {
	// REACTIVE UI STATE (Svelte $state - for DOM rendering)
	// Only values that directly affect UI rendering should be reactive
	state = $state<GameState>('START');
	distanceTraveled = $state(0);
	timePlayed = $state(0);
	bestScore = $state(0);

	// NON-REACTIVE ENGINE STATE (Raw variables - high-frequency updates)
	// These are updated every frame and don't need Svelte reactivity overhead
	playerX: number = 0;
	targetX: number = 0;
	playerVelocityX: number = 0;

	// Snowball pool - maintained as raw array for O(1) updates
	snowballs: Snowball[] = [];
	nextSnowballId: number = 1;

	// Timing state
	lastSpawnTime: number = 0;
	lastLaneIndex: number = -1;
	sameLaneCount: number = 0;

	constructor() {
		// Environment-gated persistent storage access
		if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
			const saved = localStorage.getItem('snowman-best-score');
			if (saved) {
				this.bestScore = parseFloat(saved);
			}
		}
	}

	startGame() {
		this.state = 'PLAYING';

		// Reset engine state
		this.playerX = 0;
		this.targetX = 0;
		this.playerVelocityX = 0;
		this.snowballs = [];
		this.nextSnowballId = 1;
		this.lastSpawnTime = 0;
		this.lastLaneIndex = -1;
		this.sameLaneCount = 0;

		// Reset reactive UI state
		this.distanceTraveled = 0;
		this.timePlayed = 0;
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
	 */
	addSnowball(x: number, z: number) {
		this.snowballs.push({
			id: this.nextSnowballId++,
			x,
			z,
			active: true
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
