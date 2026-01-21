<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getGameState } from '$lib/game';

	const gameState = getGameState();

	let isMobile = $state(false);

	let activePointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let jumped = false;

	const AXIS_DEADZONE_PX = 8;
	const AXIS_FULL_SCALE_PX = 80;
	const JUMP_SWIPE_PX = 38;

	function updateIsMobile() {
		if (typeof window === 'undefined') return;
		isMobile = window.matchMedia('(pointer: coarse), (hover: none)').matches;
	}

	function clamp(v: number, min: number, max: number) {
		return Math.max(min, Math.min(max, v));
	}

	function capturePointer(e: PointerEvent) {
		if (!(e.currentTarget instanceof HTMLElement)) return;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// Ignore: some browsers may throw if capture isn't allowed.
		}
	}

	function onPointerDown(e: PointerEvent) {
		if (gameState.state !== 'PLAYING') return;
		if (activePointerId !== null) return;

		e.preventDefault();
		activePointerId = e.pointerId;
		startX = e.clientX;
		startY = e.clientY;
		jumped = false;

		capturePointer(e);
		gameState.setAnalogAxisX(0);
	}

	function onPointerMove(e: PointerEvent) {
		if (gameState.state !== 'PLAYING') return;
		if (activePointerId !== e.pointerId) return;

		e.preventDefault();
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;

		// Horizontal drag maps to analog movement.
		let axis = 0;
		if (Math.abs(dx) >= AXIS_DEADZONE_PX) {
			axis = clamp(dx / AXIS_FULL_SCALE_PX, -1, 1);
		}
		gameState.setAnalogAxisX(axis);

		// Upward swipe triggers jump (once per gesture).
		if (!jumped && dy <= -JUMP_SWIPE_PX && Math.abs(dy) > Math.abs(dx) * 0.9) {
			jumped = true;
			gameState.tryStartJump();
		}
	}

	function endGesture() {
		activePointerId = null;
		jumped = false;
		gameState.clearAnalogAxis();
	}

	function onPointerUp(e: PointerEvent) {
		if (activePointerId !== e.pointerId) return;
		e.preventDefault();
		endGesture();
	}

	function onPointerCancel(e: PointerEvent) {
		if (activePointerId !== e.pointerId) return;
		e.preventDefault();
		endGesture();
	}

	// If a run ends while a pointer is still down, some browsers won't dispatch
	// a clean pointerup/cancel. Clear any stuck gesture so the next run works.
	$effect(() => {
		if (gameState.state !== 'PLAYING') {
			endGesture();
		}
	});

	onMount(() => {
		updateIsMobile();
		if (typeof window === 'undefined') return;

		const mql = window.matchMedia('(pointer: coarse), (hover: none)');
		const onChange = () => updateIsMobile();
		mql.addEventListener('change', onChange);

		const onBlur = () => endGesture();
		const onVisibility = () => {
			if (document.visibilityState !== 'visible') endGesture();
		};
		window.addEventListener('blur', onBlur);
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			mql.removeEventListener('change', onChange);
			window.removeEventListener('blur', onBlur);
			document.removeEventListener('visibilitychange', onVisibility);
		};
	});

	onDestroy(() => {
		endGesture();
		gameState.setDigitalLeftHeld(false);
		gameState.setDigitalRightHeld(false);
	});
</script>

{#if isMobile && gameState.state === 'PLAYING'}
	<div
		class="gesture-layer"
		aria-label="Touch gestures"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerCancel}
	>
		<div class="gesture-zone" aria-hidden="true"></div>
	</div>
{/if}

<style>
	.gesture-layer {
		position: fixed;
		inset: 0;
		z-index: 5;
		pointer-events: auto;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}

	.gesture-zone {
		position: absolute;
		inset: 0;
		background: transparent;
	}

	@media (pointer: fine) and (hover: hover) {
		.gesture-layer {
			display: none;
		}
	}
</style>
