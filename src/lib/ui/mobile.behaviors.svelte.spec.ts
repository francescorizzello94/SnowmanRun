import { page } from 'vitest/browser';
import { describe, expect, it, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import MobileUiHarness from './__tests__/MobileUiHarness.svelte';

async function setViewport(width: number, height: number) {
	await page.viewport(width, height);
}

async function forceCoarsePointerMatchMedia() {
	const original = window.matchMedia.bind(window);
	window.matchMedia = (query: string) => {
		const matches =
			query.includes('pointer: coarse') || query.includes('hover: none') || original(query).matches;

		return {
			matches,
			media: query,
			onchange: null,
			addEventListener() {},
			removeEventListener() {},
			addListener() {},
			removeListener() {},
			dispatchEvent() {
				return false;
			}
		} as MediaQueryList;
	};
}

beforeEach(async () => {
	document.body.innerHTML = '';
});

describe('mobile UI behaviors', () => {
	it('HUD shrinks on narrow screens', async () => {
		await setViewport(390, 740);
		render(MobileUiHarness, { mode: 'HUD' });
		await expect.element(page.getByText('Distance')).toBeInTheDocument();

		const valueEl = document.querySelector('.hud .value') as HTMLElement | null;
		if (!valueEl) throw new Error('Expected HUD value element');
		const fontSizePx = parseFloat(getComputedStyle(valueEl).fontSize);

		// Desktop HUD uses 1.55rem; mobile media query sets ~1.05rem.
		expect(fontSizePx).toBeLessThanOrEqual(19);

		const hudEl = document.querySelector('.hud') as HTMLElement | null;
		if (!hudEl) throw new Error('Expected HUD root');
		const transform = getComputedStyle(hudEl).transform;

		expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
	});

	it('Rotate prompt appears in portrait on mobile and can be dismissed', async () => {
		await forceCoarsePointerMatchMedia();
		await setViewport(390, 780); // portrait
		render(MobileUiHarness, { mode: 'ROTATE' });

		const prompt = page.getByText('Better in landscape');
		await expect.element(prompt).toBeInTheDocument();

		const playAnyway = page.getByRole('button', { name: 'Play anyway' });
		await playAnyway.click();

		await expect.element(prompt).not.toBeInTheDocument();
	});

	it('Rotate prompt hides in landscape on mobile', async () => {
		await forceCoarsePointerMatchMedia();
		await setViewport(780, 390); // landscape
		render(MobileUiHarness, { mode: 'ROTATE' });

		const prompt = page.getByText('Better in landscape');
		await expect.element(prompt).not.toBeInTheDocument();
	});

	it('Game over screen is scrollable on small screens', async () => {
		await setViewport(360, 420);
		render(MobileUiHarness, { mode: 'GAMEOVER' });
		await expect.element(page.getByRole('heading', { name: 'You Got Hit!' })).toBeInTheDocument();

		const content = document.querySelector('.gameover-overlay .content') as HTMLElement | null;
		if (!content) throw new Error('Expected gameover content');
		const style = getComputedStyle(content);
		const overflowY = style.overflowY;

		expect(['auto', 'scroll'].includes(overflowY)).toBe(true);
		expect(content.scrollHeight).toBeGreaterThan(content.clientHeight);

		content.scrollTo({ top: 200 });
		expect(content.scrollTop).toBeGreaterThan(0);
	});
});
