# Snowman’s Great Escape — Frontend-only Threlte/SvelteKit

## Goal

A small, polished third-person dodging game. Player controls a Snowman (GLTF) moving left/right to dodge incoming snowballs. Visual appeal + “game feel” are prioritized over scope.

---

## 1) Scene Setup & Perspective

### Camera

- Third-person follow camera.
- Position offset (initial): behind + above player (e.g. x: playerX, y: 5, z: 10).
- Smooth follow: interpolate camera position towards target (use `useFrame` + lerp OR Svelte spring).
- Smooth lookAt: camera looks at a point slightly ahead of player (e.g. x: playerX, y: playerY + 1, z: playerZ + 4) with smoothing.

### World

- Plane: large white ground plane.
- Fog: add scene fog (white or light blue) to hide the “end of world” and sell depth.
- Lighting: ambient + directional (soft, wintery). Optional rim light for readability.

---

## 2) Player (Snowman Asset)

### Asset Loading

- Load Snowman `.gltf/.glb` via Threlte GLTF helper (e.g. `<GLTF />` or `useGltf`).
- Ensure scale and pivot feel correct for movement/collision.

### Movement

- Axis: X-axis only.
- Input: A/D and ArrowLeft/ArrowRight.
- Use an “intent target” pattern:
  - Maintain `targetX` driven by input and clamped to bounds (e.g. [-maxX, maxX]).
  - Visual position follows via spring for smooth sliding.
- Optional upgrade (recommended): acceleration + friction for “ice” feel:
  - `vx += input * accel * dt`
  - `vx *= friction`
  - `targetX += vx * dt`
- Tilt polish: when moving left/right, add slight Z-axis tilt, return to 0 when idle.

---

## 3) Projectile System (Obstacles)

### Data Model

- Maintain `snowballs: Array<{ id: number; x: number; z: number; active: boolean }>`.

### Spawning

- Spawn at z = far behind/forward (depending on coordinate choice, e.g. z = -50).
- Random x within bounds or discrete lanes.
- Difficulty scaling over time:
  - Spawn interval decreases gradually (min clamp, e.g. 250ms).
  - Snowball speed increases gradually.
- Fairness rule (avoid impossible patterns):
  - Prevent too many consecutive spawns in same lane (e.g. max 2 consecutive).

### Movement & Cleanup

- In `useFrame`, move each active snowball: `z += speed * dt`.
- Remove/recycle when it passes player (e.g. z > 15).

### Performance (choose one)

- Baseline: plain array + individual meshes (OK for small counts).
- Preferred: object pooling OR instanced mesh for snowballs to avoid churn.

---

## 4) Collision Detection (Frontend-only)

- In `useFrame`, check collisions between player and each snowball.
- Use squared distance (performance-friendly):
  - `(dx*dx + dz*dz) < (rSum*rSum)`
- Use scale-aware radii:
  - `rSum = snowmanRadius + snowballRadius`

On collision:

- Trigger hit-stop (~120ms freeze) then GAMEOVER state.
- Visual feedback: canvas shake OR white-out “splat” overlay.

---

## 5) UI & State

### Game States

- START: “Click to Play” overlay.
- PLAYING: HUD with Distance/Time traveled.
- GAMEOVER: show final score + restart button.

### Persistence

- Save best score to `localStorage`.
- Compare at GAMEOVER and display “New High Score” indicator if applicable.

### Accessibility & Motion

- Respect `prefers-reduced-motion`:
  - disable heavy shake/flash or provide minimal alternative.

---

## 6) “Game Feel” Polish (small but high impact)

- Camera roll/tilt slightly based on movement velocity.
- Add subtle ambient audio (wind) + collision “thump”.
- Optional: scrolling ground texture or moving particles to sell forward motion.

---

## 7) Implementation Milestones

1. Environment: Threlte canvas, lights, fog, ground plane.
2. Player: load Snowman GLTF, clamp movement, smooth motion.
3. Follow camera: smooth position + smooth lookAt target.
4. Snowballs: spawn system + movement + cleanup/pooling.
5. Collision: radii-based check + GAMEOVER transition + hit-stop.
6. HUD: overlays for START/PLAYING/GAMEOVER + best score.
7. Polish pass: camera roll, splat overlay, audio, tuning constants.
8. Dev toggles: quick debug overlay (speed, spawn interval, count).
