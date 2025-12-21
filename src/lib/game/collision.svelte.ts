// Collision detection using squared distance (performance-friendly)
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

export const collision = new CollisionDetector();
