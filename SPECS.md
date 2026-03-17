# Snowman's Great Escape — Game Design Specification

## Vision

A polished 3D dodging game emphasizing **high-IQ tactical decision-making** over twitch reflexes. Built with SvelteKit and Threlte, the game challenges players to read predictive AI behaviors and exploit pattern vulnerabilities through strategic positioning and jump timing.

**Design Philosophy:** "Intelligence-based tactical dodge" — difficulty scales through smarter AI rather than overwhelming density.

---

## 1) Scene & Visual Design

### Camera

- **Third-person follow camera** with smooth spring interpolation
- Position: `{ x: playerX, y: 5.2, z: 10.5 }`
- Look-at target: `{ x: playerX, y: 0.8, z: -6 }` (slightly ahead for visibility)
- Dynamic roll based on velocity for kinetic feedback

### Environment ("Snowy Void")

- **Black void aesthetic** — fog and background both `#000000` for clean infinite horizon
- **Procedurally displaced snow ground** (80×150 PlaneGeometry segments)
  - Multi-octave noise for natural drifts
  - Real-time trail deformation system (Gaussian stamping with asymmetric berms)
- **PCFSoftShadowMap** rendering at 2048×2048 resolution
  - Tight directional light frustum for crisp shadows
  - Player model auto-grounded via Box3 bounds calculation
- **Lighting:**
  - Ambient (0.5 intensity)
  - Directional (1.3 intensity, casts shadows)
  - Rim light (0.35 intensity, blue-tinted)

### Visual Effects

- **Snow Trail System:** Procedural deformation mesh following player movement
  - Groove depth + pushed-up berms (direction-aware)
  - 7.5-second fade using Gaussian influence decay
- **Kinetic Particle System (SnowSpurt):** 700-particle buffer with dual physics
  - 72% fluffy powder (low gravity, high drag)
  - 28% slushy clumps (heavy, faster fall)
  - Emission rate scales with velocity (speed × 58 particles/second)
  - Additive blending with soft radial falloff

---

## 2) Player Mechanics

### Snowman Asset

- GLTF model loaded via Threlte
- **Auto-grounding system:** Box3 bounds calculation after scale application
- Shadow casting enabled on all child meshes
- Visual smoothing (lag factor 0.088) for kinetic feel

### Movement

- **Horizontal (X-axis):** Keyboard input (A/D, Arrow Keys)
  - Acceleration: `52 units/s²`
  - Friction: `0.84` (creates ice-sliding feel)
  - Bounds: `±6.2` units
  - Visual tilt: `0.19 rad` based on velocity
- **Vertical (Jump):** Spacebar
  - Impulse: `4.75` units/s
  - Cooldown: `0.35s`
  - Gravity: `9.8 m/s²`

---

## 3) Obstacle System (Snowball Archetypes)

### Core Design

**Philosophy:** Each archetype requires different counter-strategies (positional reads vs. timing dodges vs. pattern exploitation).

**Rendering:**

- 3 procedural Voronoi-displaced geometry variants (visual variation)
- Shared PBR snow material + seeker-specific red emissive variant
- Scale range: `0.5–1.3` (standard) with archetype-specific multipliers

### Archetype Catalog

#### 1. STANDARD (Baseline Threat)

- **Behavior:** Straight-line movement at constant speed
- **Counter:** Basic positional dodge
- **Frequency:** Common at EASY (80%), rare at INSANE (10%)

#### 2. SEEKER (Predictive Hunter) 🎯

- **Behavior:**
  - Calculates player intercept point using lead time (tToPlayer = distance / speed)
  - Predicted target: `playerX + playerVelocityX × leadTime`
  - Exponential smoothing: `α = 1 - e^(-3.6Δt)` for natural steering
  - **Path Lock:** Stops adjusting at Z = -15 (commitment distance)
- **Visual Tell:** Red emissive material + yaw jitter (±0.12 rad @ 8Hz)
- **Counter:** Bait early, dodge late (exploit lock distance), or jump over
- **Stats:** Scale 0.95, Speed ×1.05
- **Frequency:** Scales from 5% (EASY) to 26% (INSANE)

#### 3. FRACTURER (Split Bomb) 💥

- **Behavior:**
  - Large slow snowball approaching
  - Splits into 2 fragments at Z = -13 ± variation
  - Fragments spawn at ±1.5 units lateral offset
  - Fragment speed: 1.4× parent speed
- **Counter:** Position between fragments before split, or jump the formation
- **Stats:** Scale 1.45, Speed ×0.7 (compensates for split)
- **Frequency:** Scales from 5% (EASY) to 27% (INSANE)

#### 4. VORTEX (Oscillator) 🌀

- **Behavior:**
  - Sinusoidal path: `x = baseX + sin(freq × age + phase) × amplitude`
  - Frequency: `2.5 ± 1.8 Hz`
  - Amplitude: `0.95` units (respects playable bounds)
- **Counter:** Track oscillation timing, dodge into safe zones
- **Stats:** Scale 0.85, Speed ×0.95
- **Frequency:** Scales from 10% (EASY) to 30% (INSANE)

#### 5. HEAVY (Boulder) 🪨

- **Behavior:**
  - Massive slow-moving obstacle
  - Occupies ~1.5 lanes (collision radius ×2.1)
  - Minimal visual wobble (heavy feel)
- **Counter:** Early repositioning (cannot be out-maneuvered late), or jump
- **Stats:** Scale 2.35, Speed ×0.55, Hitbox ×2.1
- **Frequency:** Scales from 0% (EASY) to 7% (INSANE)

---

## 4) Difficulty System (Anchored Presets)

### Design Principle

**Each preset maintains identity throughout the session** — EASY never escalates into HARD behavior, preventing frustration from unexpected difficulty spikes.

### Preset Curves (Independent Bounds)

| Preset     | Spawn Interval | Speed Range | Profile Mix             |
| ---------- | -------------- | ----------- | ----------------------- |
| **EASY**   | 1.7s → 0.95s   | 7.5 → 14.5  | 80% Standard, 20% Elite |
| **NORMAL** | 1.5s → 0.7s    | 8.0 → 19.5  | 55% Standard, 45% Elite |
| **HARD**   | 1.25s → 0.55s  | 8.5 → 23.5  | 30% Standard, 70% Elite |
| **INSANE** | 1.05s → 0.45s  | 9.0 → 28.5  | 10% Standard, 90% Elite |

All curves ramp over **60 seconds** (linear interpolation).

### Spawner Intelligence

- **Lane Occupancy Cap:** Maximum 3 blocked lanes simultaneously (even on INSANE)
  - Prevents impossible "walls" that violate fairness
  - Forces strategic pattern design over brute density
- **Dynamic Lane Drift:** Random-walk lane shift (±0.9 amplitude) creates organic variation
- **Pattern Sequencing:** Weighted lane selection favors untargeted lanes (timeout: 2.75s)
- **Stagger Rows:** Vertical spacing of 2.2 units for multiple simultaneous threats

---

## 5) Collision & Game States

### Collision Detection

- **Algorithm:** Squared distance check (performance-optimized)
  - `(dx² + dz²) < (r₁ + r₂)²`
- **Radii:**
  - Player: `0.5` units
  - Standard snowball: `0.6` units
  - Heavy snowball: `0.6 × 2.1 = 1.26` units
- **Hit-Stop:** 120ms freeze on collision for impact feedback

### State Machine

1. **LOADING:** Asset loading gate (prevents invisible hitbox issues)
2. **START:** "Click to Play" overlay with difficulty selector
3. **PLAYING:** Active gameplay with HUD
4. **GAMEOVER:** Post-game stats with archetype breakdown

---

## 6) UI/UX Design

### HUD (In-Game)

- **Compact stat card** (scaled 0.85, stacked layout)
  - Distance traveled (meters)
  - Time elapsed (seconds)
- **Difficulty controls** (Change Preset / Restart buttons)

### Game Over Screen

- **Headline:** "You Got Hit!" (negative reinforcement tone)
- **Archetype Stats:** Color-coded breakdown
  - Seeker dodges: Orange (`#ff6a3d`)
  - Fracturer dodges: Purple (`#a78bfa`)
  - Vortex dodges: Cyan (`#22d3ee`)
  - Heavy dodges: Red (`#ef4444`)
- **Persistence:** Best score saved to localStorage
- **New High Score indicator** if applicable

---

## 7) Performance Optimization

### Rendering Pipeline

- **Instanced Geometry:** 3 shared Voronoi-displaced buffers
- **Material Sharing:** 2 materials total (snow + seeker emissive)
- **Shadow Optimization:** Tight frustum + 2048 resolution
- **Fixed Particle Buffer:** 700-particle limit (no per-frame allocations)

### Physics Loop

- **Delta-Time Decoupling:** Frame-rate independent updates
- **O(1) Updates:** Direct property mutation via references
- **Non-Reactive Engine State:** High-frequency updates outside Svelte reactivity
  - Reactive: UI state (distance, time, scores)
  - Non-reactive: Physics (playerX, velocityX, snowball arrays)

#### Fixed-Size Pooling & Render Invalidation

- Pools: High-frequency entities (snowballs, particles) use preallocated fixed-size pools with `active` toggles. Avoid structural array mutations in the rAF loop.
- Template invalidation: Drive Svelte updates using a low-frequency `renderTick` (e.g., 30Hz) and `#key renderTick` to re-evaluate the rendering block without proxying the pool array.
- Fracture spawning: Always capture parent slot fields needed for fragment spawn (geometryVariant, scale, baseX, id, z) before deactivating the parent slot to avoid stale data.

Benefits: Reduced GC pressure, more stable 60+ FPS, deterministic fragment bookkeeping under pool pressure.

### Asset Loading

- **Lazy Geometry Creation:** Voronoi displacement computed on-demand
- **Material Disposal:** Cleanup hooks prevent memory leaks
- **Terrain Reset Hook:** Clears trail deformation between sessions

---

## 8) Implementation Status

### ✅ Completed Features

- [x] Third-person camera with spring smoothing + dynamic roll
- [x] Snowman GLTF with auto-grounding + shadow system
- [x] Ice-sliding physics (acceleration + friction)
- [x] Jump mechanics with cooldown
- [x] Procedural snow terrain with real-time trail deformation
- [x] Kinetic particle system (velocity-scaled emission)
- [x] 5 distinct snowball archetypes with unique behaviors
- [x] Predictive Seeker AI with path lock + visual tell
- [x] Fracturer split mechanic
- [x] Vortex oscillation patterns
- [x] Heavy boulder with expanded hitbox
- [x] Difficulty anchoring (per-preset bounded curves)
- [x] Spawner intelligence (lane caps, probability tables, pattern sequencing)
- [x] PCFSoftShadowMap rendering (2048 resolution)
- [x] Black void aesthetic (fog + background)
- [x] Compact HUD with stacked metrics
- [x] Color-coded Game Over stats
- [x] Best score persistence
- [x] SSR-safe state management (Svelte Context API)
- [x] Performance optimization (O(1) updates, fixed buffers)

### Design Iteration Highlights

1. **Initial Concept:** Basic dodging with density scaling
2. **Visual Polish Pass:** Shadows, trail system, particles
3. **AI Revolution:** Shift from "high-density" to "high-intelligence" model
   - Predictive intercept for Seekers
   - Per-preset difficulty anchoring
   - Lane occupancy caps
   - Probability-based profile distribution

---

## 9) Tuning Philosophy

See [TUNING.md](./TUNING.md) for comprehensive constant reference.

**Key Design Levers:**

- **Gameplay Feel:** Friction/acceleration balance creates "ice skating" physics
- **Difficulty Identity:** Per-preset bounds prevent unwanted escalation
- **AI Sophistication:** Seeker lock distance, oscillation frequency, split timing
- **Visual Fidelity:** Shadow frustum, particle count, trail update rate
- **Fairness:** Lane caps, spawn intervals, cooldown timers
