# Game Tuning Guide

This document outlines where to find tuning constants for gameplay adjustments.

## Player Movement

**Location:** `src/lib/scene/Player.svelte`

- `MAX_X = 7` - Maximum left/right movement bounds
- `MOVE_SPEED = 12` - Kinematic horizontal speed (instant response)
- `VISUAL_LERP_SPEED = 24` - How quickly rendered X follows logical X
- `TILT_AMOUNT = 0.08` - Visual tilt when moving
- `Z_LERP_SPEED = 18` - Dash forward smoothing

**Jump timing location:** `src/lib/game/state.svelte.ts` (`tryStartJump()`)

- `JUMP_DURATION = 0.55`
- `JUMP_COOLDOWN = 0.55`
- `PRE_GRACE = 0.08`
- `POST_GRACE = 0.08`

## Difficulty Scaling (Per-Preset)

**Location:** `src/lib/game/difficulty.svelte.ts`

Each difficulty preset has independent bounds (EASY never ramps into HARD behavior):

### EASY

- Spawn interval: `1.7s → 0.95s` over 60 seconds
- Speed: `7.5 → 14.5` units/second

### NORMAL

- Spawn interval: `1.5s → 0.7s` over 60 seconds
- Speed: `8.0 → 19.5` units/second

### HARD

- Spawn interval: `1.25s → 0.55s` over 60 seconds
- Speed: `8.5 → 23.5` units/second

### INSANE

- Spawn interval: `1.05s → 0.45s` over 60 seconds
- Speed: `9.0 → 28.5` units/second

## Spawning & Layout

**Location:** `src/lib/game/spawner.svelte.ts`

- `SPAWN_Z = -60` - How far away snowballs spawn
- `LANE_COUNT = 5` - Number of discrete lanes
- `PLAYABLE_WIDTH = -7.0 to 7.0` - Game area bounds
- `LANE_SHIFT_MAX = 0.9` - Dynamic lane drift amplitude
- `LANE_JITTER_MAX = 0.22` - Per-snowball micro offset
- `STAGGER_ROW_GAP_Z = 2.2` - Distance between staggered rows
- `MAX_BLOCKED_LANES = 3` - Maximum simultaneous lane occupancy (even on INSANE)

## Pooling & Capacity

- `MAX_SNOWBALLS = 100` - Default preallocated pool size (adjust in `src/lib/game/state.svelte.ts`).
- If you increase `MAX_SNOWBALLS`, keep an eye on memory vs. peak concurrency; larger pools reduce spawn failures at the cost of resident memory.
- `addSnowball()` now returns the activated slot or `null` when pool exhausted — callers should handle `null` to preserve deterministic game bookkeeping (e.g., fracturer fragment tracking).

### Snowball Profile Probabilities (per difficulty)

**EASY:**

- Standard: 80%, Vortex: 10%, Seeker: 5%, Fracturer: 5%, Heavy: 0%

**NORMAL:**

- Standard: 55%, Vortex: 20%, Seeker: 12%, Fracturer: 10%, Heavy: 3%

**HARD:**

- Standard: 30%, Vortex: 25%, Seeker: 22%, Fracturer: 18%, Heavy: 5%

**INSANE:**

- Standard: 10%, Vortex: 30%, Seeker: 26%, Fracturer: 27%, Heavy: 7%

### Elite Profile Parameters

**SEEKER (Predictive Homing):**

- `SEEKER_SCALE_BASE = 0.95` - Base size
- `SEEKER_SPEED_MUL = 1.05` - Speed multiplier
- `SEEKER_HOMING_STRENGTH = 0.68` - Intercept smoothing factor
- `SEEKER_LOCK_DISTANCE = 15.0` - Z distance where path locks
- Lead calculation with exponential smoothing (α = 1 - e^(-3.6Δt))

**FRACTURER (Splits on approach):**

- `FRACTURER_SCALE_BASE = 1.45` - Large initial size
- `FRACTURER_SPEED_MUL = 0.7` - Slower to compensate for split
- `FRACTURER_Z_BASE = -13.0` - Split trigger distance
- Split creates 2 fragments at ±1.5 units, 1.4× speed

**VORTEX (Side-to-side oscillation):**

- `VORTEX_SCALE_BASE = 0.85` - Smaller, faster
- `VORTEX_FREQ_BASE = 2.5` - Oscillation frequency (Hz)
- `VORTEX_AMP_MAX = 0.95` - Maximum sway amplitude
- Sinusoidal path with phase randomization

**HEAVY (Massive slow boulder):**

- `HEAVY_SCALE_BASE = 2.35` - Largest visual size
- `HEAVY_SPEED_MUL = 0.55` - Much slower
- `HEAVY_COLLISION_RADIUS_MUL = 2.1` - Occupies ~1.5 lanes

## Collision

**Location:** `src/lib/game/collision.svelte.ts`

- `COLLISION_GRACE = 0.75` - Gameplay fairness margin
- `SNOWMAN_RADIUS = 0.75` - Effective player collision radius (`1.0 × 0.75`)
- `SNOWBALL_RADIUS = 0.45` - Effective standard snowball radius (`0.6 × 0.75`)
- Heavy snowballs: `snowball radius × 2.1` via profile-specific multiplier

## Visual Effects

**Location:** `src/lib/scene/SnowGround.svelte` (Trail System)

- `TRACK_DEPTH = 0.055` - Groove depth
- `BERM_HEIGHT = 0.035` - Pushed-up snow on sides
- `FADE_SECONDS = 7.5` - Trail lifetime
- `STAMP_SPACING = 0.18` - Distance between stamps
- `UPDATE_HZ = Q.terrainTrailHz` - Geometry update rate (LOW: 0 / MEDIUM: 12 / HIGH: 18)
- Gaussian deformation with asymmetric berms (direction-aware)

**Location:** `src/lib/scene/SnowSpurt.svelte` (Particles)

- `COUNT = Q.snowSpurtCount` - Fixed particle buffer size (LOW: 80 / MEDIUM: 400 / HIGH: 700)
- `GRAVITY = 9.5` - Downward acceleration
- Emission rate: `speed × 58` particles/second
- Two physics behaviors: 72% fluffy powder (low gravity), 28% slushy clumps
- Additive blending on HIGH tier (`Q.snowSpurtAdditive`)

**Location:** `src/lib/scene/Environment.svelte` (Shadows/Lighting)

- Shadow type: `PCFSoftShadowMap` on HIGH, `BasicShadowMap` otherwise
- Shadow map resolution: quality-tier controlled (`Q.shadowMapSize`)
	- LOW: `0` (disabled)
	- MEDIUM: `512`
	- HIGH: `1024`
- Directional light frustum: `[-12, 12, 16, -16]` (tightened)
- `shadow.bias = -0.0001` - Prevents acne
- Fog color: `#000000` (matches background for clean horizon)

**Location:** `src/lib/scene/Snowballs.svelte`

- `CLEANUP_Z = 1.5` - When to remove passed snowballs
- `HIT_STOP_DURATION = 0.12` - Freeze duration on collision
- Seeker visual tell: elite profile badge sprites (label + color)

## Camera

**Location:** `src/lib/scene/Camera.svelte`

- Position target: `{ x: playerX, y: 5, z: 10 + playerZ }`
- Look-at target: `{ x: playerX, y: 1, z: -4 + playerZ }`
- Smooth following via Svelte motion springs
- Dynamic roll based on velocity

## Tips

- **Gameplay feel:** Adjust `MOVE_SPEED`, `MAX_X`, `VISUAL_LERP_SPEED`, and `TILT_AMOUNT` in `Player.svelte`
- **Jump feel:** Adjust `JUMP_DURATION`, `JUMP_COOLDOWN`, `PRE_GRACE`, and `POST_GRACE` in `state.svelte.ts`
- **Difficulty curves:** Each preset is independent - modify bounds in `presetCurve()` to change endgame intensity
- **Lane density:** MAX_BLOCKED_LANES caps simultaneous obstacles (prevents impossible walls)
- **Profile distribution:** Edit probability tables in `selectProfileByPreset()` for different archetype mixes
- **Visual polish:** Trail depth/berm height affects snow realism, particle emission rate scales with movement energy
