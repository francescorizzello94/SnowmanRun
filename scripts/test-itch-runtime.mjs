import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const rootDir = process.cwd();
const buildDir = path.join(rootDir, 'build');
const nestedPrefix = '/html/16852483';

function fail(message) {
	console.error(`ITCH RUNTIME TEST FAIL: ${message}`);
	process.exit(1);
}

function getMimeType(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case '.html':
			return 'text/html; charset=utf-8';
		case '.js':
			return 'application/javascript; charset=utf-8';
		case '.css':
			return 'text/css; charset=utf-8';
		case '.json':
			return 'application/json; charset=utf-8';
		case '.map':
			return 'application/json; charset=utf-8';
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.webp':
			return 'image/webp';
		case '.svg':
			return 'image/svg+xml';
		case '.gltf':
			return 'model/gltf+json';
		case '.glb':
			return 'model/gltf-binary';
		case '.bin':
			return 'application/octet-stream';
		default:
			return 'application/octet-stream';
	}
}

function normalizeAndMapToBuildPath(urlPathname) {
	const normalized = urlPathname.replace(/\\/g, '/');

	let innerPath;
	if (normalized === '/' || normalized === '/index.html') {
		innerPath = '/index.html';
	} else if (normalized === nestedPrefix || normalized === `${nestedPrefix}/`) {
		innerPath = '/index.html';
	} else if (normalized.startsWith(`${nestedPrefix}/`)) {
		innerPath = normalized.slice(nestedPrefix.length);
	} else {
		innerPath = normalized;
	}

	const resolved = path.resolve(buildDir, `.${innerPath}`);
	const buildResolved = path.resolve(buildDir);
	if (!resolved.startsWith(buildResolved)) return null;
	return resolved;
}

if (!fs.existsSync(buildDir)) {
	fail(`Missing build output directory: ${buildDir}. Run "npm run build:itch" first.`);
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url ?? '/', 'http://localhost');
	const resolved = normalizeAndMapToBuildPath(url.pathname);
	if (!resolved) {
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Not found');
		return;
	}

	if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
		res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
		res.end('Not found');
		return;
	}

	res.writeHead(200, { 'Content-Type': getMimeType(resolved) });
	fs.createReadStream(resolved).pipe(res);
});

const testCases = ['/', '/index.html', `${nestedPrefix}/`, `${nestedPrefix}/index.html`];

let browser;

try {
	const port = await new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				reject(new Error('Failed to determine server address'));
				return;
			}
			resolve(address.port);
		});
	});

	browser = await chromium.launch({ headless: true });

	for (const testCasePath of testCases) {
		const page = await browser.newPage();
		const routeErrors = [];

		page.on('console', (message) => {
			const text = message.text();
			if (/Not found:\s*\/|SvelteKitError: Not found:/i.test(text)) {
				routeErrors.push(`console:${text}`);
			}
		});

		page.on('pageerror', (error) => {
			const text = String(error?.message ?? error);
			if (/Not found:\s*\/|SvelteKitError: Not found:/i.test(text)) {
				routeErrors.push(`pageerror:${text}`);
			}
		});

		page.on('response', (response) => {
			const url = response.url();
			if (url.includes('snowman_scene.gltf') && ![200, 304].includes(response.status())) {
				routeErrors.push(`response:${response.status()} ${url}`);
			}
		});

		const url = `http://127.0.0.1:${port}${testCasePath}`;
		await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

		await page.waitForTimeout(2000);

		const bodyText = (await page.locator('body').innerText()).toLowerCase();
		if (bodyText.includes('not found')) {
			routeErrors.push('dom: body contains "not found"');
		}

		await page.close();

		if (routeErrors.length > 0) {
			fail(`Route boot failed for ${testCasePath}: ${routeErrors.join(' | ')}`);
		}
	}

	console.log('ITCH RUNTIME TEST PASS');
} catch (error) {
	fail(error instanceof Error ? error.message : String(error));
} finally {
	if (browser) await browser.close();
	await new Promise((resolve) => server.close(() => resolve()));
}
