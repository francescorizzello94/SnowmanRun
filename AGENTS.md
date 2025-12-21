# Agent Guidelines (SvelteKit + Threlte)

This project uses SvelteKit and Threlte for a frontend-only 3D game.

## Documentation & MCP usage

- Prefer using the Svelte MCP server to confirm Svelte 5 / SvelteKit APIs when uncertain.
- Use `list-sections` to locate relevant docs, then `get-documentation` for the needed sections.
- Use Context7 for Threlte documentation and patterns (scene graph, useFrame, GLTF loading, instancing).

## Code quality checks

- Use `svelte-autofixer` for `.svelte` components before finalizing them.
- For TypeScript-only modules, ensure types are strict and no unused variables remain.

## Project conventions

- Keep game state and systems in `/src/lib/game` (state, spawner, collision, difficulty).
- Keep Threlte scene components in `/src/lib/scene`.
- Keep UI overlays in `/src/lib/ui`.
- Maintain a single authoritative per-frame update loop (avoid multiple competing loops).

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
