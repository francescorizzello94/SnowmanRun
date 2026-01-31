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

function exitWithZipError(message, err) {
	console.error(`ITCH ZIP FAIL: ${message}`);
	if (err) console.error(err);
	process.exit(1);
}

try {
	const output = fs.createWriteStream(outPath);
	const archive = archiver('zip', { zlib: { level: 9 } });

	const done = new Promise((resolve, reject) => {
		output.once('close', resolve);
		output.once('error', (err) => reject(new Error(`Failed writing ${outPath}`, { cause: err })));
		archive.once('error', (err) =>
			reject(new Error('archiver error while creating zip', { cause: err }))
		);
	});

	archive.on('warning', (err) => {
		if (err?.code === 'ENOENT') {
			console.warn(`ITCH ZIP WARN: ${err.message}`);
			return;
		}
		// Treat unexpected warnings as failures so CI/packaging doesn't silently produce a bad zip.
		archive.emit('error', err);
	});

	archive.pipe(output);

	// Put the *contents* of /build at the zip root (itch requires index.html at zip root).
	archive.directory(buildDir + path.sep, false);
	await archive.finalize();
	await done;

	console.log(`Wrote ${outPath} (${archive.pointer()} bytes)`);
} catch (err) {
	exitWithZipError('Zip creation failed.', err);
}
