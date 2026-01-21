<script lang="ts">
	import { createGameState } from '$lib/game';
	import HUD from '$lib/ui/HUD.svelte';
	import GameOverOverlay from '$lib/ui/GameOverOverlay.svelte';

	export type MobileUiHarnessMode = 'HUD' | 'GAMEOVER';

	let { mode = 'HUD' } = $props<{ mode?: MobileUiHarnessMode }>();

	const gameState = createGameState();

	$effect(() => {
		if (mode === 'HUD') {
			gameState.state = 'PLAYING';
			gameState.distanceTraveled = 123.4;
			gameState.timePlayed = 56.7;
			gameState.difficultyPreset = 'NORMAL';
			gameState.snowfallEnabled = true;
		}

		if (mode === 'GAMEOVER') {
			gameState.state = 'GAMEOVER';
			gameState.distanceTraveled = 987.6;
			gameState.timePlayed = 123.4;
			gameState.bestScore = 999.9;
			gameState.dodgedSeekers = 12;
			gameState.dodgedFracturers = 8;
			gameState.dodgedVortex = 6;
			gameState.dodgedHeavies = 4;
		}
	});
</script>

<HUD />
<GameOverOverlay />
