import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';

const rootDir = process.cwd();
const buildDir = path.join(rootDir, 'build');
const outPath = path.join(rootDir, 'itch.zip');

if (!fs.existsSync(buildDir)) {
	console.error(`Missing build output at ${buildDir}. Run \"npm run build:itch\" first.`);
	process.exit(1);
}

const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

archive.on('warning', (err) => {
	if (err.code === 'ENOENT') {
		console.warn(err.message);
		return;
	}
	throw err;
});

archive.on('error', (err) => {
	throw err;
});

const done = new Promise((resolve, reject) => {
	output.on('close', resolve);
	output.on('error', reject);
	archive.on('error', reject);
});

archive.pipe(output);

// Put the *contents* of /build at the zip root (itch requires index.html at zip root).
archive.directory(buildDir + path.sep, false);
await archive.finalize();
await done;

console.log(`Wrote ${outPath} (${archive.pointer()} bytes)`);
