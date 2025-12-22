# Asset Placeholder

This file indicates where the snowman GLTF model should be placed.

## Expected Location
`/static/models/snowman.gltf` or `/static/models/snowman.glb`

## Notes
- The Player component will fall back to a simple 3-sphere snowman if the GLTF is not found
- If you want to add a custom GLTF model, place it at `/static/models/snowman.gltf`
- Adjust the scale in Player.svelte if needed (currently set to 1.5)
