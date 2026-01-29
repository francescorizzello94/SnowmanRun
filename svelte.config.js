import netlify from '@sveltejs/adapter-netlify';
import staticAdapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const buildTarget = process.env.BUILD_TARGET ?? 'netlify';
const isItch = buildTarget === 'itch';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// REQUIRED: itch.io serves games under subpaths (often in an iframe)
		...(isItch ? { paths: { relative: true } } : {}),

		adapter: isItch
			? staticAdapter({
					// Enables client-side routing refresh/deep-links (now or later)
					fallback: 'index.html',
					pages: 'build',
					assets: 'build',
					strict: false
				})
			: netlify()
	}
};

export default config;
