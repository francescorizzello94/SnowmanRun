# Snowman's Great Escape - Implementation Complete ✅

A polished 3D dodging game built with SvelteKit and Threlte featuring **intelligence-based tactical gameplay** with predictive AI and procedural visual effects.

## ✨ Features Implemented

### 🎮 Core Gameplay

- ✅ Third-person camera with smooth spring following and dynamic roll
- ✅ Player (Snowman GLTF) with horizontal movement + jump mechanics
- ✅ Ice-sliding physics with acceleration and friction (0.84 coefficient)
- ✅ Visual tilt and smoothing for kinetic feel
- ✅ **5 distinct snowball archetypes** with unique behaviors:
  - **STANDARD:** Straight-line baseline threat
  - **SEEKER:** Predictive homing with path lock + visual tell (red emissive)
  - **FRACTURER:** Large snowball that splits into 2 fragments
  - **VORTEX:** Sinusoidal oscillation patterns
  - **HEAVY:** Massive slow boulder with expanded hitbox (×2.1)
- ✅ **Anchored difficulty presets** (EASY/NORMAL/HARD/INSANE) with independent curves
- ✅ **Spawner intelligence:** Lane occupancy caps (max 3 blocked), probability tables, pattern sequencing
- ✅ Precise collision detection using squared distance
- ✅ Hit-stop effect on collision (120ms freeze)

### 🎨 Visual Polish

- ✅ **"Snowy Void" aesthetic** — black fog + background for infinite horizon
- ✅ **Procedural snow terrain** (80×150 PlaneGeometry with multi-octave noise)
- ✅ **Real-time trail deformation system:**
  - Gaussian stamping creates groove + asymmetric berms
  - Direction-aware displacement (left/right movement)
  - 7.5-second fade using influence decay
  - Terrain reset hook clears between sessions
- ✅ **Kinetic particle system (SnowSpurt):**
  - 700-particle fixed buffer (zero per-frame allocations)
  - Dual physics: 72% fluffy powder (low gravity), 28% slushy clumps
  - Velocity-scaled emission (speed × 58 particles/s)
  - Additive blending with soft radial falloff
- ✅ **PCFSoftShadowMap rendering:**
  - 2048×2048 shadow maps
  - Tight directional light frustum ([-12, 12, 16, -16])
  - Auto-grounding via Box3 bounds calculation
  - Bias tuning prevents shadow acne (-0.0001)
- ✅ **Multi-light setup:**
  - Ambient (0.5 intensity)
  - Directional (1.3, casts shadows)
  - Rim light (0.35, blue-tinted for edge definition)
- ✅ Smooth camera interpolation with spring physics
- ✅ Dynamic camera roll based on movement velocity

### 🖥️ UI & State Management

- ✅ **LOADING state** — asset loading gate prevents invisible hitbox issues
- ✅ **START screen** with difficulty selector + "Click to Play"
- ✅ **PLAYING HUD** — compact stacked layout (distance + time), scaled 0.85
- ✅ **GAMEOVER screen** with archetype-specific stats:
  - Color-coded breakdown (Seeker: orange, Fracturer: purple, Vortex: cyan, Heavy: red)
  - "You Got Hit!" headline (negative reinforcement tone)
  - New High Score indicator
- ✅ Best score persistence in localStorage
- ✅ Clean, modern UI with smooth animations

### ⚙️ Game Systems

- ✅ **SSR-safe state management:**
  - Svelte 5 Context API (`createGameState()` / `getGameState()`)
  - Orchestrator pattern: GameStateManager owns all subsystems
  - Dependency injection (no singletons)
- ✅ **Reactive boundaries:**
  - UI state: `$state` (distance, time, scores) — reactive
  - Engine state: raw variables (playerX, velocityX) — non-reactive for performance
- ✅ **DifficultyManager:**
  - Per-preset bounded curves (EASY never scales into HARD)
  - Independent spawn interval + speed ranges
  - 60-second ramp time with linear interpolation
- ✅ **SnowballSpawner:**
  - 5-lane dynamic system with random-walk drift (±0.9 amplitude)
  - Profile probability tables per difficulty
  - Lane occupancy caps (max 3 blocked lanes)
  - Weighted lane selection (favors untargeted lanes)
  - Stagger rows with 2.2-unit Z spacing
- ✅ **CollisionDetector:**
  - O(1) squared distance check
  - Profile-specific radii (Heavy: ×2.1, others: base 0.6)
- ✅ **Predictive Seeker AI:**
  - Intercept calculation: `predictedX = playerX + playerVelocityX × leadTime`
  - Exponential smoothing: `α = 1 - e^(-3.6Δt)`
  - Path lock at Z = -15 (commitment distance)
  - Visual tell: red emissive material + yaw jitter (±0.12 rad @ 8Hz)
- ✅ All systems modular with clean separation of concerns

## 📁 Project Structure

```
src/
├── lib/
│   ├── game/              # Game logic systems (SSR-safe)
│   │   ├── state.svelte.ts       # GameStateManager orchestrator
│   │   ├── difficulty.svelte.ts  # Per-preset difficulty curves
│   │   ├── spawner.svelte.ts     # Lane-based spawning with intelligence
│   │   ├── collision.svelte.ts   # Collision detection
│   │   └── index.ts              # Module exports
│   ├── scene/             # Threlte 3D components
│   │   ├── GameScene.svelte      # Main scene container
│   │   ├── Camera.svelte         # Follow camera with spring smoothing
│   │   ├── Player.svelte         # Snowman GLTF with input + physics
│   │   ├── Snowballs.svelte      # Archetype rendering + AI behaviors
│   │   ├── Environment.svelte    # Lights, fog, shadow configuration
│   │   ├── SnowGround.svelte     # Procedural terrain + trail system
│   │   ├── SnowSpurt.svelte      # Kinetic particle system
│   │   └── Snowfall.svelte       # Ambient falling snow
│   └── ui/                # Overlay UI components
│       ├── StartOverlay.svelte   # Start screen + difficulty selector
│       ├── HUD.svelte            # In-game metrics (compact layout)
│       └── GameOverOverlay.svelte # Post-game stats (color-coded)
└── routes/
    └── +page.svelte       # Main game page
```

## 🎯 Key Implementation Details

### State Management (Svelte 5 + SSR-Safety)

- **Context API pattern:** `setContext('gameState', gameState)` in layout, `getContext()` in components
- **No global singletons:** Each request/session gets isolated state instance
- **Reactive boundaries:**
  - `$state` for UI-bound values (distance, time, scores)
  - Raw variables for high-frequency physics (playerX, velocityX, snowballs)
- **Lifecycle management:** `onDestroy(() => stop())` prevents memory leaks

### Physics Loop

- **Single authoritative `useTask` loop** in Snowballs.svelte
- **Delta-time decoupling:** Frame-rate independent updates
- **O(1) direct property updates** via object references (no array searches)
- **Backward iteration** when removing items during loop
- Handles spawning, archetype behaviors, collision, and cleanup

### Fixed-Size Pooling & Render Invalidation (Performance)

The runtime now uses a preallocated fixed-size object pool for `snowballs` to eliminate heap allocations in the rAF hot-path. Key implementation notes:

- A constant `MAX_SNOWBALLS` defines the pool size; the array is allocated at game start and never structurally mutated during gameplay (no `.push()`, `.splice()`).
- Each slot is a plain JS `Snowball` object with numeric defaults and `active: boolean`. Slots are reset in-place when deactivated to preserve object shapes and optimize hidden classes.
- `addSnowball()` acquires an inactive slot and returns the activated slot (or `null` if exhausted). Callers must handle spawn failures deterministically.
- The renderer's template is invalidated using a separate low-frequency `renderTick` (e.g. 30Hz) and the template is keyed on this tick; the pool objects themselves remain unproxied to avoid Svelte runtime overhead.

Benefits:

- Eliminates transient allocations per frame that create GC pressure.
- Keeps per-frame work O(1) and predictable, improving 60+ FPS stability.
- Preserves deterministic game behavior by returning spawn success/failure to callers (useful for fracture bookkeeping).

### Camera System

- **Smooth following** using Svelte motion springs
- Position: `{ x: playerX, y: 5.2, z: 10.5 }`
- Look-at target: `{ x: playerX, y: 0.8, z: -6 }` (slightly ahead for visibility)
- **Dynamic roll:** Calculated from velocity for kinetic feedback

### Player Controls

- **Input:** A/D and Arrow Keys for horizontal movement, Spacebar for jump
- **Ice-skating physics:**
  - `vx += input × accel × dt`
  - `vx *= friction` (0.84 coefficient)
  - `x += vx × dt`
  - Clamped to ±6.2 bounds
- **Jump mechanics:**
  - Impulse: 4.75 units/s
  - Cooldown: 0.35s
  - Gravity: 9.8 m/s²
- **Visual smoothing:** Exponential lag (factor 0.088) for kinetic feel
- **Tilt:** 0.19 rad based on velocity

### Spawning Strategy (Intelligence-Based)

- **5-lane dynamic system:**
  - Base lanes computed from playable bounds (-7.0 to 7.0)
  - Random-walk drift (±0.9 amplitude) for organic variation
  - Per-snowball jitter (±0.22) breaks perfect tracks
- **Profile selection via probability table:**
  - EASY: 80% Standard, 20% Elite mix
  - INSANE: 10% Standard, 90% Elite mix (heavy Seeker/Fracturer/Vortex)
- **Lane occupancy cap:** Maximum 3 blocked lanes simultaneously
  - Prevents impossible "walls" even on INSANE
  - Forces strategic pattern design over brute density
- **Weighted lane selection:** Favors untargeted lanes (timeout: 2.75s)
- **Pattern sequencing:** Stagger rows with 2.2-unit Z spacing

### Archetype Behaviors

#### SEEKER (Predictive Hunter)

```typescript
// Calculate intercept point with player velocity lead
const tToPlayer = toPlayer / speed;
const leadT = tToPlayer * 0.85;
const predictedX = playerX + playerVelocityX * leadT;

// Exponential smoothing for natural steering
const a = 1 - Math.exp(-3.6 * delta);
ball.vx = THREE.MathUtils.lerp(ball.vx, predictedX - ball.x, a);

// Path lock at commitment distance
if (toPlayer <= 15) ball.seekerLocked = true;
```

#### FRACTURER (Split Bomb)

```typescript
// Split trigger at Z = -13 ± variation
if (ball.z >= -13 && !ball.hasSplit) {
	// Create 2 fragments at ±1.5 lateral offset
	// Fragment speed: 1.4× parent speed
	spawnFragment(ball.x - 1.5, ball.speed * 1.4);
	spawnFragment(ball.x + 1.5, ball.speed * 1.4);
	ball.hasSplit = true;
}
```

#### VORTEX (Oscillator)

```typescript
// Sinusoidal path with phase randomization
const osc = Math.sin(ball.freq * ball.age + ball.phase) * ball.amp;
ball.x = ball.baseX + osc;
```

### Trail Deformation System

```typescript
// Gaussian stamping with asymmetric berms
function addTrailPoint(worldX, worldZ, now) {
  const dir = Math.sign(playerVelocityX); // Direction awareness
  const strength = Math.min(1, speed / 10);
  trail.push({ x, y, t: now, strength, dir });
}

function applyTrail() {
  for (const vertex of groundVertices) {
    for (const stamp of trail) {
      const dx = vertex.x - stamp.x;
      const dy = vertex.y - stamp.y;
      const d2 = dx*dx + dy*dy;

      // Gaussian groove
      const groove = Math.exp(-d2 / (2 * sigma²)) * TRACK_DEPTH;

      // Asymmetric berms (pushed snow on movement direction)
      const perpDist = Math.abs(dx);
      if (perpDist > TRACK_HALF_WIDTH) {
        const berm = gaussian(...) * BERM_HEIGHT * stamp.dir;
        vertex.z += berm;
      }

      vertex.z -= groove * stamp.strength * fade;
    }
  }
}
```

### Particle System (SnowSpurt)

- **Fixed buffer approach:** 700 particles pre-allocated
- **Dual physics behaviors:**
  - 72% powder: `gravity × 0.55-0.8`, `drag × 2.6-4.0`
  - 28% clumps: `gravity × 1.15-1.55`, `drag × 1.2-2.0`
- **Velocity-scaled emission:**
  ```typescript
  const emitRate = speed * 58; // particles per second
  emitAcc += emitRate * delta;
  while (emitAcc >= 1) {
  	spawnOne(now);
  	emitAcc -= 1;
  }
  ```
- **Custom shader with soft falloff:**
  ```glsl
  float r2 = dot(gl_PointCoord - 0.5, gl_PointCoord - 0.5);
  float soft = smoothstep(0.42, 0.0, r2);
  gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * soft);
  ```

### Shadow System

- **PCFSoftShadowMap** for smooth edges (vs. basic hard shadows)
- **2048×2048 resolution** balances quality and performance
- **Tight frustum bounds** ([-12, 12, 16, -16]) eliminates wasted resolution
- **Auto-grounding algorithm:**
  ```typescript
  function placeModelOnGround(gltf: GLTF) {
  	const box = new THREE.Box3().setFromObject(gltf.scene);
  	box.min.multiplyScalar(SCALE);
  	box.max.multiplyScalar(SCALE);
  	const minY = box.min.y;
  	gltf.scene.position.y = GROUND_Y - minY - GROUND_SINK;
  }
  ```
- **Shadow traversal:** `receiveShadow` and `castShadow` enabled on all meshes

### Difficulty Scaling (Anchored Presets)

Each preset has **independent bounds** to maintain identity:

```typescript
private presetCurve(preset: DifficultyPreset) {
  switch (preset) {
    case 'EASY':
      return { spawnInitial: 1.7, spawnMin: 0.95, speedInitial: 7.5, speedMax: 14.5 };
    case 'INSANE':
      return { spawnInitial: 1.05, spawnMin: 0.45, speedInitial: 9.0, speedMax: 28.5 };
    // ...
  }
}

// Linear interpolation over 60 seconds
const t = Math.min(timePlayed / 60, 1);
return curve.spawnInitial - (curve.spawnInitial - curve.spawnMin) * t;
```

**Design rationale:** Prevents EASY from escalating into HARD speeds over time.

## 🔧 Performance Optimizations

### Rendering

- **Instanced geometry:** 3 shared Voronoi-displaced buffers (visual variation without duplication)
- **Material sharing:** 2 materials total (snow + seeker emissive)
- **Shadow optimization:** Tight frustum eliminates wasted shadow map resolution
- **Fixed particle buffer:** Zero per-frame allocations (700 particles pre-allocated)
- **Lazy geometry creation:** Voronoi displacement computed on-demand

### Physics

- **O(1) direct updates:** `ball.x += ball.vx * delta` (no array searches)
- **Backward iteration:** Remove items during iteration without index shift issues
- **Non-reactive state:** High-frequency updates outside Svelte reactivity system
- **Terrain throttling:** Trail updates at 18Hz (not per-frame)
- **Early-out checks:** Collision only tested when `ball.z > -3`

### Memory Management

- **Material disposal:** `onDestroy` hooks prevent memory leaks
- **Terrain reset hook:** Clears trail array between sessions
- **Asset loading gate:** LOADING state ensures GLTF ready before PLAYING

## 🚀 Deployment

- **Build target:** Static SvelteKit app (`adapter-static`)
- **Deploy platform:** Netlify (configured via netlify.toml)
- **Asset handling:** GLTF models in `/static/models`
- **Build command:** `npm run build`
- **Preview:** `npm run preview`

## 📊 Game Metrics Tracked

- Distance traveled (meters)
- Time survived (seconds)
- Archetype-specific dodges:
  - Seekers dodged
  - Fracturers dodged
  - Vortexes dodged
  - Heavys dodged
- Best score (persisted to localStorage)

## 🎨 Visual Style

- **Color Palette:**
  - Snow: Pure white (#ffffff) with PBR material
  - Void: Absolute black (#000000)
  - Seeker tell: Red emissive (#ff0000)
  - UI accents: Archetype-specific (orange/purple/cyan/red)
- **Material System:**
  - MeshPhysicalMaterial for snow (roughness 0.72, clearcoat 0.7)
  - Fresnel edge glow via custom shader (unused in current build)
  - Red emissive variant for Seeker visual tell

## 📖 Documentation

- **[SPECS.md](./SPECS.md):** Complete game design specification
- **[ARCHITECTURE.md](./ARCHITECTURE.md):** SSR-safety, performance patterns, reactivity boundaries
- **[TUNING.md](./TUNING.md):** All gameplay constants and tuning parameters
- **[AGENTS.md](./AGENTS.md):** AI assistant guidelines for future development
