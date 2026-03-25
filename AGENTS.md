# Agent Guidelines (SvelteKit + Threlte)

This project uses SvelteKit and Threlte for a frontend-only 3D game.

## Documentation & MCP usage

- Prefer using the Svelte MCP server to confirm Svelte 5 / SvelteKit APIs when uncertain.
- Use `list-sections` to locate relevant docs, then `get-documentation` for the needed sections.
- Use Context7 for Threlte documentation and patterns (scene graph, useFrame, GLTF loading, instancing).

**Performance Note — Object Pooling & Render Invalidation**

- Use a preallocated fixed-size object pool for high-frequency entities (e.g. snowballs) to avoid heap allocations in the `requestAnimationFrame` hot path. Allocate slots once at startup (e.g. `MAX_SNOWBALLS = 100`) and reuse by toggling an `active` flag.
- Do not call `new`, `.push()`, `.splice()`, or return fresh arrays inside the per-frame loop. Mutate the properties of pooled plain objects instead.
- Keep the pool and pooled objects as plain JS objects (no Svelte `$state` proxies) — read them directly from Threlte render tasks and write active slots into shared instanced rendering data each frame.
- Ensure you capture any parent-slot fields needed for immediate follow-up logic (e.g. fracture fragment spawns) before you reset/deactivate the parent slot.

Why: This pattern eliminates transient allocations that cause V8 GC pauses during animation frames. It also preserves engine performance by keeping high-frequency state non-reactive while still allowing the UI to refresh at controlled intervals.

## Code quality checks

- Use `svelte-autofixer` for `.svelte` components before finalizing them.
- For TypeScript-only modules, ensure types are strict and no unused variables remain.

## Project conventions

- Keep game state and systems in `/src/lib/game` (state, spawner, collision, difficulty).
- Keep Threlte scene components in `/src/lib/scene`.
- Keep UI overlays in `/src/lib/ui`.
- Maintain a single authoritative gameplay update loop for spawning/obstacles/collision; keep other per-frame loops narrowly scoped to visuals, particles, terrain, and camera.

## Architecture principles

- **SSR-Safe State**: Use Svelte Context API (`createGameState()` / `getGameState()`) instead of global singletons
- **Orchestrator Pattern**: `GameStateManager` instantiates and owns all subsystems (Difficulty, Spawner, Collision)
- **Dependency Injection**: Subsystems receive dependencies via constructor, never import singletons
- **Reactive Boundaries**: Separate UI state (`$state`) from engine state (raw variables)
  - Reactive: `state`, `distanceTraveled`, `timePlayed`, `bestScore` (shown in DOM)
  - Non-reactive: `playerX`, `playerVelocityX`, `snowballs` (high-frequency Canvas updates)
- **Access via Registry**: Components access subsystems through gameState (e.g., `gameState.difficulty.getSpeed()`)
- **Module Cleanliness**: `.svelte.ts` files export classes/factories, never pre-instantiated singletons
- **Asset Loading Gates**: Game starts in LOADING state, transitions to START only when assets ready, preventing invisible hitbox issues
- **Lifecycle Management**: Always cleanup resources with `onDestroy(() => stop())`

## Performance rules

- Avoid recreating meshes every frame.
- Prefer pooling or instancing for repeated objects (snowballs).
- Keep allocations out of the per-frame path where possible.
- Use O(1) direct property updates instead of O(n) array searches in hot paths.
- Iterate backwards when removing items during iteration.

## Deliverables

When implementing features, provide:

- a minimal working baseline first
- then polish pass (camera, feel, UI)
- plus a short note on where tuning constants live
