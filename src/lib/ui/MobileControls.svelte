<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { getGameState } from '$lib/game';

	const gameState = getGameState();

	let isMobile = $state(false);

	function updateIsMobile() {
		if (typeof window === 'undefined') return;
		isMobile = window.matchMedia('(pointer: coarse), (hover: none)').matches;
	}

	function holdLeft(held: boolean) {
		gameState.setDigitalLeftHeld(held);
	}

	function holdRight(held: boolean) {
		gameState.setDigitalRightHeld(held);
	}

	function capturePointer(e: PointerEvent) {
		if (!(e.currentTarget instanceof HTMLElement)) return;
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// Ignore: some browsers may throw if capture isn't allowed.
		}
	}

	function jump() {
		gameState.tryStartJump();
	}

	function frostBurst() {
		gameState.tryActivateFrostBurst(gameState.playerX, 0);
	}

	onMount(() => {
		updateIsMobile();
		if (typeof window === 'undefined') return;

		const mql = window.matchMedia('(pointer: coarse), (hover: none)');
		const onChange = () => updateIsMobile();
		mql.addEventListener('change', onChange);
		return () => mql.removeEventListener('change', onChange);
	});

	onDestroy(() => {
		gameState.setDigitalLeftHeld(false);
		gameState.setDigitalRightHeld(false);
		gameState.clearAnalogAxis();
	});
</script>

{#if isMobile && gameState.state === 'PLAYING'}
	<div class="touch" aria-label="Touch controls">
		<div class="left">
			<button
				type="button"
				class="btn dir"
				aria-label="Move left"
				onpointerdown={(e) => {
					e.preventDefault();
					capturePointer(e);
					holdLeft(true);
				}}
				onpointerup={(e) => {
					e.preventDefault();
					holdLeft(false);
				}}
				onpointercancel={(e) => {
					e.preventDefault();
					holdLeft(false);
				}}
				onpointerleave={(e) => {
					e.preventDefault();
					holdLeft(false);
				}}
			>
				◀
			</button>
		</div>

		<div class="right">
			<button
				type="button"
				class="btn dir"
				aria-label="Move right"
				onpointerdown={(e) => {
					e.preventDefault();
					capturePointer(e);
					holdRight(true);
				}}
				onpointerup={(e) => {
					e.preventDefault();
					holdRight(false);
				}}
				onpointercancel={(e) => {
					e.preventDefault();
					holdRight(false);
				}}
				onpointerleave={(e) => {
					e.preventDefault();
					holdRight(false);
				}}
			>
				▶
			</button>
		</div>

		<div class="actions">
			<button
				type="button"
				class="btn action jump"
				aria-label="Jump"
				onpointerdown={(e) => {
					e.preventDefault();
					jump();
				}}
			>
				Jump
			</button>

			<button
				type="button"
				class="btn action frost"
				aria-label="Frost burst"
				disabled={gameState.frostBurstCharges <= 0}
				onpointerdown={(e) => {
					e.preventDefault();
					frostBurst();
				}}
			>
				Burst
				{#if gameState.frostBurstCharges > 0}
					<span class="badge" aria-label="Frost burst charges">{gameState.frostBurstCharges}</span>
				{/if}
			</button>
		</div>
	</div>
{/if}

<style>
	.touch {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 60;
		pointer-events: none;
		padding: calc(0.9rem + env(safe-area-inset-bottom))
			calc(0.9rem + env(safe-area-inset-right))
			calc(0.9rem + env(safe-area-inset-bottom))
			calc(0.9rem + env(safe-area-inset-left));
	}

	.left,
	.right,
	.actions {
		pointer-events: auto;
		position: absolute;
		bottom: calc(0.6rem + env(safe-area-inset-bottom));
	}

	.left {
		left: calc(0.6rem + env(safe-area-inset-left));
	}

	.right {
		right: calc(0.6rem + env(safe-area-inset-right));
	}

	.actions {
		right: calc(0.6rem + env(safe-area-inset-right));
		bottom: calc(5.2rem + env(safe-area-inset-bottom));
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.btn {
		-webkit-tap-highlight-color: transparent;
		touch-action: none;
		user-select: none;
		border: 1px solid rgba(255, 255, 255, 0.22);
		background: rgba(0, 0, 0, 0.42);
		color: #fff;
		border-radius: 18px;
		backdrop-filter: blur(10px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
	}

	.btn.dir {
		width: 4.6rem;
		height: 4.6rem;
		font-size: 1.75rem;
		font-weight: 900;
	}

	.btn.action {
		width: 6.4rem;
		min-height: 3.2rem;
		padding: 0.65rem 1rem;
		font-size: 1.05rem;
		font-weight: 900;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.btn:active {
		transform: scale(0.98);
		background: rgba(0, 0, 0, 0.55);
	}

	.btn:disabled {
		opacity: 0.45;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.6rem;
		height: 1.6rem;
		padding: 0 0.35rem;
		border-radius: 999px;
		background: rgba(49, 211, 255, 0.25);
		border: 1px solid rgba(49, 211, 255, 0.35);
		font-size: 0.95rem;
		font-weight: 900;
	}

	@media (pointer: fine) and (hover: hover) {
		.touch {
			display: none;
		}
	}
</style>
