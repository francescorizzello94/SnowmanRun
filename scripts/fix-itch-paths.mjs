import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
	console.error(`ITCH PATH FIX FAIL: ${message}`);
	process.exit(1);
}

const rootDir = process.cwd();
const indexHtmlPath = path.join(rootDir, 'build', 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
	fail(`Missing ${indexHtmlPath}. Run \"npm run build:itch\" first.`);
}

let html = fs.readFileSync(indexHtmlPath, 'utf8');

// Ensure the SvelteKit client entrypoints are relative so the game works under itch.io subpaths.
// Even with kit.paths.relative = true, adapter-static's SPA fallback page currently emits
// root-absolute /_app URLs in build/index.html (modulepreloads + dynamic imports).
// Keep this script small and easy to delete if/when SvelteKit fixes fallback HTML generation.
html = html
	// href="/_app/..." or src='/_app/...'
	.replace(/(["'])\/_app\//g, '$1./_app/')
	// import("/_app/...")
	.replace(/import\((\s*["'])\/_app\//g, 'import($1./_app/');

fs.writeFileSync(indexHtmlPath, html);

console.log('ITCH PATH FIX OK');
