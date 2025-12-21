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

## Performance rules

- Avoid recreating meshes every frame.
- Prefer pooling or instancing for repeated objects (snowballs).
- Keep allocations out of the per-frame path where possible.

## Deliverables

When implementing features, provide:

- a minimal working baseline first
- then polish pass (camera, feel, UI)
- plus a short note on where tuning constants live
