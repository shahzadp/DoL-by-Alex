/*
 * Assemble assets/web/ (the Flutter asset bundle) from the compiled game.
 *
 * Deliberately does NOT rewrite saveAs() in the html:
 * www/flutter_additions.js defines that global before the game loads, which is
 * far less fragile than the regex replacement the Cordova build used.
 *
 * Uses only node's own `fs`. The Capacitor build leaned on fs-extra, which was
 * never a declared dependency (it arrived transitively via @capacitor/cli), so
 * this does without it.
 */
const fs = require('fs');
const path = require('path');

// assume we're in gameDir/devTools/flutterbuilder
const gameRoot = path.resolve('../..');
const sourceName = 'Degrees of Lewdity.html';

// Must match WebAssetServer.assetRoot in lib/src/web_asset_server.dart.
const webDir = path.resolve('assets/web');
const targetName = 'index.html';

const sourceHtml = path.resolve(gameRoot, sourceName);
if (!fs.existsSync(sourceHtml)) {
	throw new Error(`game is not compiled: ${sourceHtml} not found (run compile.bat first)`);
}

// fail fast if the storage origin is about to change
require('./verify_storage_origin');

fs.mkdirSync(webDir, { recursive: true });

// our native glue
fs.copyFileSync(path.resolve('www/flutter_additions.js'), path.resolve(webDir, 'flutter_additions.js'));

/*
 * Sync img/ without recopying 18k unchanged files every build.
 * Preserve timestamps so the check below can skip them.
 */
const sourceImg = path.resolve(gameRoot, 'img');
const targetImg = path.resolve(webDir, 'img');

/*
 * WebP re-encoding. See scripts/convert_images_to_webp.py for why the files keep
 * their .png names and why lossless rather than lossy.
 */
const webpEnabled = (process.env.DOL_WEBP || 'on') !== 'off';

let copied = 0,
	skipped = 0,
	removed = 0;

function syncDir(src, dest) {
	if (!fs.existsSync(src)) {
		console.warn(`syncDir: source missing, skipping ${src}`);
		return;
	}
	fs.mkdirSync(dest, { recursive: true });
	const srcFiles = fs.readdirSync(src);
	const destFiles = fs.readdirSync(dest);

	for (const file of destFiles) {
		if (!srcFiles.includes(file)) {
			fs.rmSync(path.resolve(dest, file), { recursive: true, force: true });
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
		/*
		 * PNGs are re-encoded as lossless WebP in place, and that step owns them.
		 *
		 * They must not be copied here. The skip test below compares source and
		 * destination mtime, but a converted file's mtime is the conversion time,
		 * not the source's, so it would never match: every build would copy the
		 * pristine PNG back over the WebP bytes and then re-convert, making the
		 * conversion cost ~2 minutes on every single build instead of once. The
		 * converter keeps its own manifest for exactly this reason.
		 */
		if (webpEnabled && file.toLowerCase().endsWith('.png')) {
			skipped++;
			continue;
		}
		// .mtimeMs can have sub-ms precision that copy does not round-trip
		const same = fs.existsSync(d) && Math.round(fs.statSync(s).mtimeMs) === Math.round(fs.statSync(d).mtimeMs);
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

/*
 * Re-encode the pngs as lossless WebP, in place.
 *
 * Set DOL_WEBP=off to ship the original pngs; the sync above then owns them like
 * any other file. Worth keeping as a switch, because "the artwork looks wrong
 * and I need to bisect" is a situation where a one-line revert is worth more
 * than a clean design.
 */
if (webpEnabled) {
	const converter = path.resolve('scripts/convert_images_to_webp.py');
	if (!fs.existsSync(converter)) {
		throw new Error(`missing ${converter}`);
	}
	const python = process.env.PYTHON || 'python';
	try {
		// stdio inherited: 18,593 files take a while and silence would look like
		// a hang.
		require('child_process').execFileSync(python, [converter, sourceImg, targetImg], {
			cwd: __dirname,
			stdio: 'inherit',
		});
	} catch (e) {
		throw new Error(
			`webp conversion failed (${e.message}). Install Pillow -- pip install Pillow -- ` +
				'or set DOL_WEBP=off to ship the original pngs.'
		);
	}
}

// inject our glue ahead of the game's first script
const anchor = '<script ';
const injection = ['<script src="flutter_additions.js"></script>', '<script '].join('\n');

const raw = fs.readFileSync(sourceHtml, 'utf-8');
if (!raw.includes(anchor)) {
	throw new Error(`could not find a <script> tag to inject flutter_additions.js into ${sourceHtml}`);
}

// NOTE: the replacement MUST be a function. A string replacement would expand
// $&, $` and $' in the *inserted* text -- harmless here only because the needle
// is short, but this is the same footgun that once corrupted 3.8 MB of story
// text (see MEMORY.md trap 5). See also verifyInjection below.
const injected = raw.replace(anchor, () => injection);

/*
 * Cheap proof the injection actually happened, and happened exactly once.
 *
 * A silent no-op here would ship an app whose export button downloads to a
 * browser download manager instead of opening the system dialog, with nothing
 * in the build log to say why.
 */
const added = injected.length - raw.length;
if (added !== injection.length - anchor.length) {
	throw new Error(`injection did not apply cleanly to ${sourceHtml} (size delta ${added})`);
}

fs.writeFileSync(path.resolve(webDir, targetName), injected, 'utf-8');
console.log(`wrote ${path.resolve(webDir, targetName)}`);

/*
 * Generate the img/ asset entries in pubspec.yaml.
 *
 * Flutter's asset directory entries are NOT recursive: `- assets/web/img/`
 * bundles only the files sitting directly in img/, which is three stray build
 * files and none of the 18,740 images. The game then loads with no artwork and
 * no error anywhere, which is the worst possible failure mode for this change.
 *
 * So every directory in the tree gets its own entry. That is ~2,300 lines of
 * pubspec, generated here rather than maintained by hand.
 *
 * The guard at the end is the part that matters: it compares the number of
 * entries written against the number of directories found and fails loudly on a
 * mismatch, so a partial or stale list can never ship.
 */
const pubspecFile = path.resolve('pubspec.yaml');
const BEGIN_MARK = '# BEGIN generated img assets';
const END_MARK = '# END generated img assets';

// Package-relative, because pubspec asset paths are resolved against the package
// root, not the filesystem. Must match WebAssetServer.assetRoot + '/img'.
const ASSET_IMG_DIR = 'assets/web/img';

function listDirectories(root) {
	const out = [];
	const walk = (rel) => {
		const abs = rel ? path.resolve(root, rel) : root;
		for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const childRel = rel ? `${rel}/${entry.name}` : entry.name;
			out.push(childRel);
			walk(childRel);
		}
	};
	walk('');
	return out.sort();
}

const dirs = listDirectories(sourceImg);
if (dirs.length === 0) {
	throw new Error(`found no directories under ${sourceImg}; refusing to write an empty asset list`);
}

const generated = [
	`    ${BEGIN_MARK}`,
	...dirs.map((d) => `    - ${ASSET_IMG_DIR}/${d}/`),
	`    ${END_MARK}`,
].join('\n');

const pubspec = fs.readFileSync(pubspecFile, 'utf-8');
const begin = pubspec.indexOf(BEGIN_MARK);
const end = pubspec.indexOf(END_MARK);
if (begin < 0 || end < 0 || end < begin) {
	throw new Error(`could not find the ${BEGIN_MARK} / ${END_MARK} markers in ${pubspecFile}`);
}

const updated =
	pubspec.slice(0, begin) + generated + pubspec.slice(end + END_MARK.length);

if (updated !== pubspec) {
	fs.writeFileSync(pubspecFile, updated, 'utf-8');
	console.log(`pubspec: wrote ${dirs.length} img asset entries`);
} else {
	console.log(`pubspec: ${dirs.length} img asset entries already up to date`);
}

/*
 * Guard: re-read what we just wrote and make sure every directory is covered.
 *
 * A silent partial list here means the app ships without artwork, and nothing
 * in the build output would reveal it. Cheap to check, so always check.
 */
const written = fs.readFileSync(pubspecFile, 'utf-8');
const block = written.slice(written.indexOf(BEGIN_MARK), written.indexOf(END_MARK));
const listed = new Set(
	block
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2).trim())
);
const missing = dirs.filter((d) => !listed.has(`${ASSET_IMG_DIR}/${d}/`));
if (missing.length > 0) {
	throw new Error(
		`pubspec asset list is missing ${missing.length} director${missing.length === 1 ? 'y' : 'ies'} ` +
			`under ${sourceImg}, e.g. ${missing.slice(0, 3).join(', ')}`
	);
}
console.log(`img: ${dirs.length} directories covered by pubspec asset entries`);