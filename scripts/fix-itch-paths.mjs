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
//
// This is a targeted post-build workaround and intentionally regex-based (no HTML parser).
// It may need adjustment if SvelteKit changes the fallback output format.
html = html
	// href="/_app/..." or src='/_app/...'
	.replace(/(["'])\/_app\//g, '$1./_app/')
	// import("/_app/...")
	.replace(/import(\s*)\((\s*["'])\/_app\//g, 'import$1($2./_app/');

fs.writeFileSync(indexHtmlPath, html);

console.log('ITCH PATH FIX OK');
