/**
 * Collision Detection System
 *
 * Specification Compliance:
 * - Pure logic using squared distance for performance (avoids expensive sqrt)
 * - No internal state - all data passed as parameters
 * - Operates on raw numeric values for minimal overhead in physics loop
 * - Scoped to GameStateManager instance to prevent cross-request contamination
 */
export class CollisionDetector {
	// Tuning constants - radii in world units
	readonly SNOWMAN_RADIUS = 1.0;
	readonly SNOWBALL_RADIUS = 0.6;

	checkCollision(playerX: number, playerZ: number, snowballX: number, snowballZ: number): boolean {
		const dx = playerX - snowballX;
		const dz = playerZ - snowballZ;
		const distSq = dx * dx + dz * dz;

		const rSum = this.SNOWMAN_RADIUS + this.SNOWBALL_RADIUS;
		const rSumSq = rSum * rSum;

		return distSq < rSumSq;
	}
}
