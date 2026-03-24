<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { getGameState, getQualityContext } from '$lib/game';
  import { onDestroy } from 'svelte';
  import * as THREE from 'three';

  const gameState = getGameState();
  const { settings: Q } = getQualityContext();

  // Quality-aware particle count
  const COUNT = Q.snowfallCount;
  const AREA_WIDTH = 26;
  const AREA_DEPTH = 70;
  const AREA_HEIGHT = 18;

  const positions = new Float32Array(COUNT * 3);
  const speeds = new Float32Array(COUNT);

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function resetParticle(i: number) {
    const base = i * 3;
    positions[base + 0] = rand(-AREA_WIDTH / 2, AREA_WIDTH / 2);
    positions[base + 1] = rand(2, AREA_HEIGHT);
    positions[base + 2] = rand(-AREA_DEPTH, 8);
    speeds[i] = rand(2.0, 5.5);
  }

  for (let i = 0; i < COUNT; i++) resetParticle(i);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const { stop } = useTask((delta) => {
    if (gameState.state !== 'PLAYING') return;
    if (!gameState.snowfallEnabled) return;

    const preset = gameState.difficultyPreset;
    const intensityMul =
      preset === 'INSANE' ? 2.1 :
      preset === 'HARD' ? 1.55 :
      preset === 'NORMAL' ? 1.1 :
      0.9;

    material.opacity = preset === 'INSANE' ? 0.95 : preset === 'HARD' ? 0.85 : 0.75;

    for (let i = 0; i < COUNT; i++) {
      const base = i * 3;
      positions[base + 1] -= speeds[i] * intensityMul * delta;

      // slight drift
      positions[base + 0] += Math.sin((positions[base + 2] + i) * 0.03) * 0.22 * intensityMul * delta;

      if (positions[base + 1] < 0.2) {
        positions[base + 1] = rand(AREA_HEIGHT * 0.8, AREA_HEIGHT);
        positions[base + 0] = rand(-AREA_WIDTH / 2, AREA_WIDTH / 2);
        positions[base + 2] = rand(-AREA_DEPTH, 8);
      }
    }

    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
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
