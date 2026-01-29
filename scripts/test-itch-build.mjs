import fs from 'node:fs';
import path from 'node:path';

function fail(message) {
	console.error(`ITCH BUILD TEST FAIL: ${message}`);
	process.exit(1);
}

function warn(message) {
	console.warn(`ITCH BUILD TEST WARN: ${message}`);
}

const rootDir = process.cwd();
const buildDir = path.join(rootDir, 'build');
const indexHtmlPath = path.join(buildDir, 'index.html');

if (!fs.existsSync(buildDir))
	fail(`Missing build output directory: ${buildDir}. Run \"npm run build:itch\" first.`);
if (!fs.existsSync(indexHtmlPath))
	fail(`Missing ${indexHtmlPath}. Static adapter should emit index.html.`);

// Basic expected outputs
const appDir = path.join(buildDir, '_app');
if (!fs.existsSync(appDir))
	fail('Missing build/_app directory. Static build assets were not emitted.');

const gltfPath = path.join(buildDir, 'snowman_scene.gltf');
if (!fs.existsSync(gltfPath))
	warn(
		'Missing build/snowman_scene.gltf. If the game loads it at runtime, itch will fail to load the player model.'
	);

const html = fs.readFileSync(indexHtmlPath, 'utf8');

// Root-absolute URLs are the classic itch subpath failure mode.
// We consider href/src attributes that start with a single '/'.
// - allow protocol-relative URLs (//...)
// - allow data URLs
// - allow absolute http(s)
const rootAbsoluteAttr = /\b(?:src|href)\s*=\s*(["'])\/(?!\/)([^"']+)\1/g;

const offenders = new Set();
let match;
while ((match = rootAbsoluteAttr.exec(html)) !== null) {
	const captured = match[2];
	if (typeof captured !== 'string' || captured.length === 0) continue;
	const value = `/${captured}`;
	if (
		value.startsWith('/_app/') ||
		value.startsWith('/models/') ||
		value.startsWith('/snowman_scene.gltf')
	) {
		offenders.add(value);
	}
}

if (offenders.size > 0) {
	fail(
		`index.html contains root-absolute asset URLs that can break on itch subpaths: ${[...offenders].join(', ')}. ` +
			'Use SvelteKit-relative paths (kit.paths.relative) and $app/paths helpers (asset/resolve).'
	);
}

console.log('ITCH BUILD TEST PASS');
