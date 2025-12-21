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
  readonly SPAWN_Z = -50; // Spawn far away
  readonly LANES = [-6, -3, 0, 3, 6]; // 5 discrete lanes
  readonly MAX_CONSECUTIVE_SAME_LANE = 2; // Fairness: avoid impossible patterns
  
  // Dependency injection: DifficultyManager instance
  private difficulty: DifficultyManager;
  
  constructor(difficulty: DifficultyManager) {
    this.difficulty = difficulty;
  }
  
  /**
   * Spawn a new snowball using fairness rules
   * Mutates gameState directly for O(1) performance
   */
  spawn(gameState: GameStateManager) {
    // Pick a lane, avoiding too many consecutive in same lane
    let laneIndex: number;
    let attempts = 0;
    
    do {
      laneIndex = Math.floor(Math.random() * this.LANES.length);
      attempts++;
    } while (
      laneIndex === gameState.lastLaneIndex && 
      gameState.sameLaneCount >= this.MAX_CONSECUTIVE_SAME_LANE && 
      attempts < 10
    );
    
    // Update lane tracking (non-reactive state)
    if (laneIndex === gameState.lastLaneIndex) {
      gameState.sameLaneCount++;
    } else {
      gameState.sameLaneCount = 1;
      gameState.lastLaneIndex = laneIndex;
    }
    
    const x = this.LANES[laneIndex];
    gameState.addSnowball(x, this.SPAWN_Z);
  }
  
  /**
   * Check if it's time to spawn based on difficulty
   */
  shouldSpawn(timePlayed: number, lastSpawnTime: number): boolean {
    const interval = this.difficulty.getSpawnInterval(timePlayed);
    return (timePlayed - lastSpawnTime) >= interval;
  }
}
