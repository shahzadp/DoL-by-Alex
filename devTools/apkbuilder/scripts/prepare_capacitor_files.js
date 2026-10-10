/*
 * Assemble capwww/ (the Capacitor webDir) from the compiled game.
 *
 * Deliberately does NOT rewrite saveAs() in the html: www/capacitor_additions.js
 * defines that global before the game loads, which is far less fragile than the
 * regex replacement the Cordova build used.
 */
const fs = require('fs-extra');
const path = require('path');

// assume we're in gameDir/devTools/apkbuilder
const gameRoot = path.resolve('../..');
const sourceName = 'Degrees of Lewdity.html';
const webDir = path.resolve('capwww');
const targetName = 'index.html';

const sourceHtml = path.resolve(gameRoot, sourceName);
if (!fs.existsSync(sourceHtml)) {
	throw new Error(`game is not compiled: ${sourceHtml} not found (run compile.bat first)`);
}

// fail fast if the storage origin is about to change
require('./verify_storage_origin');

fs.ensureDirSync(webDir);

// copy capacitor's browser runtime next to the game
const capJs = path.resolve('node_modules/@capacitor/core/dist/capacitor.js');
if (!fs.existsSync(capJs)) throw new Error(`missing ${capJs} (run npm install)`);
fs.copyFileSync(capJs, path.resolve(webDir, 'capacitor.js'));

// copy our native glue
fs.copyFileSync(path.resolve('www/capacitor_additions.js'), path.resolve(webDir, 'capacitor_additions.js'));

/*
 * Sync img/ without recopying 18k unchanged files every build.
 * Preserve timestamps so the check below can skip them.
 */
const sourceImg = path.resolve(gameRoot, 'img');
const targetImg = path.resolve(webDir, 'img');
let copied = 0, skipped = 0, removed = 0;

function syncDir(src, dest) {
	if (!fs.existsSync(src)) {
		console.warn(`syncCopy: source missing, skipping ${src}`);
		return;
	}
	fs.ensureDirSync(dest);
	const srcFiles = fs.readdirSync(src);
	const destFiles = fs.readdirSync(dest);

	for (const file of destFiles) {
		if (!srcFiles.includes(file)) {
			fs.removeSync(path.resolve(dest, file));
			removed++;
		}
	}

	for (const file of srcFiles) {
		const s = path.resolve(src, file);
		const d = path.resolve(dest, file);
		if (fs.statSync(s).isDirectory()) {
			syncDir(s, d);
			continue;
		}
		// .mtimeMs can have sub-ms precision that copy does not round-trip
		const same = fs.existsSync(d) &&
			Math.round(fs.statSync(s).mtimeMs) === Math.round(fs.statSync(d).mtimeMs);
		if (same) {
			skipped++;
		} else {
			fs.copyFileSync(s, d);
			copied++;
		}
	}
}
syncDir(sourceImg, targetImg);
console.log(`img: copied ${copied}, skipped ${skipped}, removed ${removed}`);

// inject the capacitor runtime + glue ahead of the game's first script
const anchor = '<script ';
const injection = [
	'<script src="capacitor.js" type="module"></script>',
	'<script src="capacitor_additions.js"></script>',
	'<script '
].join('\n');

const raw = fs.readFileSync(sourceHtml, 'utf-8');
if (!raw.includes(anchor)) {
	throw new Error(`could not find a <script> tag to inject capacitor scripts into ${sourceHtml}`);
}
fs.writeFileSync(path.resolve(webDir, targetName), raw.replace(anchor, injection), 'utf-8');
console.log(`wrote ${path.resolve(webDir, targetName)}`);