<script lang="ts">
	import { onMount } from 'svelte';
	import { getGameState } from '$lib/game';

	const gameState = getGameState();

	let isMobile = $state(false);
	let isPortrait = $state(false);
	let dismissed = $state(false);

	function update() {
		if (typeof window === 'undefined') return;
		isMobile = window.matchMedia('(pointer: coarse), (hover: none)').matches;
		isPortrait = window.innerHeight > window.innerWidth;
	}

	function dismiss() {
		dismissed = true;
	}

	onMount(() => {
		update();
		if (typeof window === 'undefined') return;

		const onResize = () => update();
		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onResize);
		};
	});
</script>

{#if isMobile && isPortrait && !dismissed && (gameState.state === 'START' || gameState.state === 'PLAYING')}
	<div class="overlay" aria-label="Rotate device prompt">
		<div class="panel" role="dialog" aria-modal="false">
			<div class="title">Better in landscape</div>
			<div class="body">Rotate your phone for easier steering.</div>
			<div class="actions">
				<button type="button" class="btn secondary" onclick={dismiss}>Play anyway</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 55;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		pointer-events: none;
		padding: calc(0.75rem + env(safe-area-inset-top))
			calc(0.75rem + env(safe-area-inset-right))
			calc(0.75rem + env(safe-area-inset-bottom))
			calc(0.75rem + env(safe-area-inset-left));
	}

	.panel {
		pointer-events: auto;
		margin-top: calc(0.5rem + env(safe-area-inset-top));
		width: min(26rem, 100%);
		background: rgba(0, 0, 0, 0.62);
		color: #fff;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 14px;
		backdrop-filter: blur(10px);
		box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
		padding: 0.85rem 1rem;
	}

	.title {
		font-weight: 900;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		font-size: 0.95rem;
	}

	.body {
		margin-top: 0.25rem;
		color: rgba(255, 255, 255, 0.88);
		font-weight: 600;
	}

	.actions {
		margin-top: 0.6rem;
		display: flex;
		justify-content: flex-end;
	}

	.btn {
		-webkit-tap-highlight-color: transparent;
		border-radius: 12px;
		border: 1px solid rgba(255, 255, 255, 0.22);
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
		padding: 0.45rem 0.7rem;
		font-weight: 800;
		cursor: pointer;
	}

	.btn:active {
		transform: scale(0.98);
	}

	@media (orientation: landscape) {
		.overlay {
			display: none;
		}
	}
</style>
