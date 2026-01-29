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
// This is primarily needed when SSR is disabled (SPA), because SvelteKit's generated fallback
// uses root-absolute /_app paths.
html = html
	// href="/_app/..." or src='/_app/...'
	.replace(/(["'])\/_app\//g, '$1./_app/')
	// import("/_app/...")
	.replace(/import\((\s*["'])\/_app\//g, 'import($1./_app/');

fs.writeFileSync(indexHtmlPath, html);

console.log('ITCH PATH FIX OK');
