# Game Tuning Guide

This document outlines where to find tuning constants for gameplay adjustments.

## Player Movement

**Location:** `src/lib/scene/Player.svelte`

- `MAX_X = 6` - Maximum left/right movement bounds
- `ACCELERATION = 50` - How quickly player accelerates
- `FRICTION = 0.88` - Friction coefficient (lower = more sliding)
- `TILT_AMOUNT = 0.15` - Visual tilt when moving

## Difficulty Scaling

**Location:** `src/lib/game/difficulty.svelte.ts`

- `INITIAL_SPAWN_INTERVAL = 2.0` - Starting time between snowballs (seconds)
- `MIN_SPAWN_INTERVAL = 0.4` - Minimum time between snowballs (seconds)
- `INITIAL_SPEED = 6` - Starting snowball speed (units/second)
- `MAX_SPEED = 18` - Maximum snowball speed (units/second)
- `DIFFICULTY_RAMP_TIME = 90` - Time to reach max difficulty (seconds)

## Spawning & Layout

**Location:** `src/lib/game/spawner.svelte.ts`

- `SPAWN_Z = -50` - How far away snowballs spawn
- `LANES = [-6, -3, 0, 3, 6]` - Available spawn lanes
- `MAX_CONSECUTIVE_SAME_LANE = 2` - Fairness: prevent impossible patterns

## Collision

**Location:** `src/lib/game/collision.svelte.ts`

- `SNOWMAN_RADIUS = 1.0` - Player collision radius
- `SNOWBALL_RADIUS = 0.6` - Snowball collision radius

## Visual Polish

**Location:** `src/lib/scene/Snowballs.svelte`

- `CLEANUP_Z = 15` - When to remove passed snowballs
- `HIT_STOP_DURATION = 0.12` - Freeze duration on collision (seconds)

**Location:** `src/lib/scene/Camera.svelte`

- Camera position: `x: playerX, y: 5, z: 10`
- Look-at target: `x: playerX, y: 1, z: -4`
- Spring stiffness/damping values for smoothness

## Tips

- Lower friction = more "icy" feel
- Increase MAX_SPEED for harder endgame
- Adjust LANES array to change game width
- Modify spawn interval for pacing changes
