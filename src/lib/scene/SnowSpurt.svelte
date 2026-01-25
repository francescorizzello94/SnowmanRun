<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { onDestroy } from 'svelte';
  import { getGameState } from '$lib/game';
  import * as THREE from 'three';

  const gameState = getGameState();

  // World-space reference (must match SnowGround + Player grounding)
  const GROUND_Y = -0.01;

  // Fixed-size particle buffer (no per-frame allocations)
  const COUNT = 700;

  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const age = new Float32Array(COUNT);
  const life = new Float32Array(COUNT);
  const scale = new Float32Array(COUNT);
  const alpha = new Float32Array(COUNT);
  const gravityMul = new Float32Array(COUNT);
  const drag = new Float32Array(COUNT);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Additive reads as airy powder; we keep alpha discipline below so it doesn't wash out.
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSize: { value: 28.0 },
    },
    vertexShader: `
      attribute float aScale;
      attribute float aAlpha;
      uniform float uSize;
      varying float vAlpha;

      void main() {
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // basic size attenuation
        float atten = 1.0 / max(0.001, -mvPosition.z);
        gl_PointSize = uSize * aScale * atten;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vAlpha;

      void main() {
        // Soft round particle
        vec2 p = gl_PointCoord - vec2(0.5);
        float r2 = dot(p, p);
        // Wider falloff = fluffier edge
        float soft = smoothstep(0.42, 0.0, r2);
        float a = vAlpha * soft;
        if (a < 0.01) discard;
        // Slightly brighter core under additive blending.
        gl_FragColor = vec4(1.0, 1.0, 1.0, a);
      }
    `,
  });

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  let cursor = 0;
  let emitAcc = 0;

  function spawnOne(now: number) {
    const i = cursor;
    cursor = (cursor + 1) % COUNT;

    const speed = Math.abs(gameState.playerVelocityX);
    const dir = Math.sign(gameState.playerVelocityX) || 0;

    const base = i * 3;

    // Spawn just behind the player (toward camera) so it reads as a "trail".
    positions[base + 0] = gameState.playerX + rand(-0.25, 0.25);
    positions[base + 1] = GROUND_Y + rand(0.02, 0.09);
    positions[base + 2] = gameState.playerZ + rand(0.35, 0.75);

    // Two "feels": fluffy powder (hangs) + slushy clumps (heavier, fall faster)
    const isPowder = Math.random() < 0.72;

    // Initial spurt velocity (energetic + velocity-scaled)
    // Requirement: upward spurt ~ 2..4
    const vy = (2 + Math.random() * 2) * (isPowder ? 1.1 : 0.85);
    const spread = (1.05 + speed * 0.14) * (isPowder ? 1.0 : 0.75);
    const vx = (dir * (1.35 + speed * 0.10)) + rand(-spread, spread);
    const vz = rand(-0.35, 0.35);

    velocities[base + 0] = vx;
    velocities[base + 1] = vy;
    velocities[base + 2] = vz;

    age[i] = 0;
    life[i] = isPowder ? rand(0.65, 0.95) : rand(0.45, 0.70);

    // Start larger and more visible
    scale[i] = isPowder ? rand(1.05, 1.65) : rand(0.95, 1.35);
    alpha[i] = isPowder ? 0.9 : 1.0;

    // Powder hangs (lower gravity, higher drag); slush drops faster.
    gravityMul[i] = isPowder ? rand(0.55, 0.8) : rand(1.15, 1.55);
    drag[i] = isPowder ? rand(2.6, 4.0) : rand(1.2, 2.0);
  }

  const GRAVITY = 9.5;

  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') return;

    const speed = Math.abs(gameState.playerVelocityX);

    // Emission scales with player speed
    if (speed > 0.15) {
      // Denser emission for a more energetic, "vehicle dash" feel.
      const rate = speed * 58;
      emitAcc += rate * delta;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        spawnOne(gameState.timePlayed);
      }
    } else {
      emitAcc = 0;
    }

    for (let i = 0; i < COUNT; i++) {
      if (age[i] >= life[i]) {
        alpha[i] = 0;
        continue;
      }

      const base = i * 3;

      age[i] += delta;
      const t = Math.min(1, age[i] / life[i]);

      // Gravity arc
      velocities[base + 1] -= GRAVITY * gravityMul[i] * delta;

      // Air drag (powder slows quickly, slush a bit less)
      const d = drag[i];
      const dragXZ = Math.exp(-d * delta);
      const dragY = Math.exp(-(d * 0.55) * delta);
      velocities[base + 0] *= dragXZ;
      velocities[base + 2] *= dragXZ;
      velocities[base + 1] *= dragY;

      positions[base + 0] += velocities[base + 0] * delta;
      positions[base + 1] += velocities[base + 1] * delta;
      positions[base + 2] += velocities[base + 2] * delta;

      // Settling: kill when reaching snow surface
      if (positions[base + 1] <= GROUND_Y + 0.01) {
        age[i] = life[i];
        alpha[i] = 0;
        continue;
      }

      // Fade + shrink: keep strong at start, then vanish quickly near the end.
      const fade = 1 - t;
      alpha[i] = Math.min(alpha[i], fade * fade * 1.15);
      scale[i] = Math.max(0, scale[i] * (0.985 - 0.02 * t));
    }

    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aScale as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
  });

  onDestroy(() => {
    stop();
    geometry.dispose();
    material.dispose();
  });
</script>

<T.Points>
  <T is={geometry} />
  <T is={material} />
</T.Points>
