/**
 * Collision Detection System
 *
 * Specification Compliance:
 * - Pure logic using squared distance for performance (avoids expensive sqrt)
 * - No internal state - all data passed as parameters
 * - Operates on raw numeric values for minimal overhead in physics loop
 * - Grace margin applied to hitboxes for fair player experience
 * - Scoped to GameStateManager instance to prevent cross-request contamination
 */
export class CollisionDetector {
	// Visual radii (what the player sees)
	readonly SNOWMAN_VISUAL_RADIUS = 1.0;
	readonly SNOWBALL_VISUAL_RADIUS = 0.6;

	// Collision radii (smaller than visual for fair "grace margin")
	// Using 75% of visual size prevents frustrating pixel-perfect hits
	readonly COLLISION_GRACE = 0.75;
	readonly SNOWMAN_RADIUS = 1.0 * 0.75; // 0.75
	readonly SNOWBALL_RADIUS = 0.6 * 0.75; // 0.45

	checkCollision(
		playerX: number,
		playerZ: number,
		snowballX: number,
		snowballZ: number,
		snowballScale: number = 1.0,
		snowballRadiusMul: number = 1.0
	): boolean {
		const dx = playerX - snowballX;
		const dz = playerZ - snowballZ;
		const distSq = dx * dx + dz * dz;

		// Visual-physics synchronization: scale affects collision radius
		const scaledSnowballRadius = this.SNOWBALL_RADIUS * snowballScale * snowballRadiusMul;
		const rSum = this.SNOWMAN_RADIUS + scaledSnowballRadius;
		const rSumSq = rSum * rSum;

		return distSq < rSumSq;
	}

	// Get visual radius for debug rendering
	getVisualSnowmanRadius(): number {
		return this.SNOWMAN_VISUAL_RADIUS;
	}

	getVisualSnowballRadius(): number {
		return this.SNOWBALL_VISUAL_RADIUS;
	}
}
