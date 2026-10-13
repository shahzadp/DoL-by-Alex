/*
 * Guard the WebView origin, which is what partitions localStorage.
 *
 * Saves live in localStorage. The origin is hardcoded as kStorageOrigin in
 * lib/src/storage_origin.dart, so changing it gives every existing player an
 * empty save and orphans their data irrecoverably -- with no runtime error to
 * show for it. The Capacitor build guarded the equivalent pair of values in
 * capacitor.config.json; this is the same guard pointed at the Dart constant.
 *
 * This failure is invisible at runtime, so catch it at build time instead.
 */
const fs = require('fs');
const path = require('path');

const originFile = path.resolve('lib/src/storage_origin.dart');
const lockFile = path.resolve('storage-origin.json');
const gradleFile = path.resolve('android/app/build.gradle.kts');
const kotlinRoot = path.resolve('android/app/src/main/kotlin');

function read(file) {
	if (!fs.existsSync(file)) throw new Error(`missing ${file}`);
	return fs.readFileSync(file, 'utf-8');
}

/** Pull a `const String name = '...';` out of the Dart source. */
function dartConst(source, name) {
	const m = source.match(new RegExp(`const String ${name} = '([^']*)';`));
	if (!m) throw new Error(`could not find "const String ${name}" in ${originFile}`);
	return m[1];
}

/** Pull a `const int name = 123;` out of the Dart source. */
function dartInt(source, name) {
	const m = source.match(new RegExp(`const int ${name} = (\\d+);`));
	if (!m) throw new Error(`could not find "const int ${name}" in ${originFile}`);
	return parseInt(m[1], 10);
}

const originSource = read(originFile);
const lock = JSON.parse(read(lockFile));

const drift = [];
const check = (key, actual, expected) => {
	if (actual !== expected) drift.push(`  ${key}: ${JSON.stringify(actual)} (locked value is ${JSON.stringify(expected)})`);
};

check('scheme', dartConst(originSource, 'kStorageOriginScheme'), lock.androidScheme);
check('host', dartConst(originSource, 'kStorageOriginHost'), lock.hostname);

// The origin is scheme + host + port, so the port is part of the identity even
// though https makes 443 implicit. WebAssetServer.serves() compares it, and a
// drift here would silently serve the game under a different origin.
check('port', dartInt(originSource, 'kStorageOriginPort'), lock.port ?? 443);

if (drift.length === 0) {
	console.log(`storage origin ok: ${lock.androidScheme}://${lock.hostname}`);
} else if (process.env.DOL_ALLOW_ORIGIN_CHANGE) {
	console.warn('WARNING: DOL_ALLOW_ORIGIN_CHANGE is set; the WebView origin has changed.');
	console.warn('Any save made under the old origin is now unreachable.');
	console.warn('Changed:');
	console.warn(drift.join('\n'));
} else {
	console.error(
		'Refusing to build: the WebView origin no longer matches storage-origin.json.\n\n' +
			drift.join('\n') +
			'\n\nThe game keeps saves in localStorage, which is partitioned by origin. Changing\n' +
			'the origin does not migrate anything -- it just makes every existing save\n' +
			'unreachable. Players would silently start a new game with no saves.\n\n' +
			'If you really intend this, re-run with DOL_ALLOW_ORIGIN_CHANGE=1 and update\n' +
			'storage-origin.json in the same commit.'
	);
	process.exit(1);
}

// appId is the other half of the on-disk identity: changing it installs a
// different app, so the old app (and its saves) stays behind uninstalled.
if (process.env.DOL_ALLOW_APPID_CHANGE !== '1') {
	const gradle = read(gradleFile);
	const m = gradle.match(/applicationId\s*=\s*"([^"]+)"/);
	if (!m) {
		console.error(`Refusing to build: no applicationId found in ${gradleFile}`);
		process.exit(1);
	}
	if (m[1] !== lock.appId) {
		console.error(
			`Refusing to build: appId changed from ${lock.appId} to ${m[1]}.\n` +
				'Android treats this as a different app, so users keep the old one and never\n' +
				'see the new build. If that is intended, set DOL_ALLOW_APPID_CHANGE=1 and\n' +
				'update storage-origin.json in the same commit.'
		);
		process.exit(1);
	}
}

/*
 * WebView data directory.
 *
 * localStorage for a given origin lives in <app data>/app_webview by default.
 * Calling WebView.setDataDirectorySuffix() moves it, which orphans every save
 * just as thoroughly as changing the origin does -- and unlike the origin
 * there is no single line to pin, so this is checked by scanning for the call.
 */
function kotlinFiles(dir) {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const p = path.resolve(dir, e.name);
		if (e.isDirectory()) return kotlinFiles(p);
		return e.name.endsWith('.kt') ? [p] : [];
	});
}

const offenders = kotlinFiles(kotlinRoot).filter((f) => /setDataDirectorySuffix/.test(fs.readFileSync(f, 'utf-8')));
if (offenders.length > 0 && process.env.DOL_ALLOW_ORIGIN_CHANGE !== '1') {
	console.error(
		'Refusing to build: WebView.setDataDirectorySuffix() found in\n' +
			offenders.map((f) => `  ${f}`).join('\n') +
			'\n\nThat moves the WebView data directory, so localStorage written by the\n' +
			'previous app becomes unreachable and every player starts with an empty save.\n' +
			'Remove the call, or set DOL_ALLOW_ORIGIN_CHANGE=1 if you truly mean to\n' +
			'invalidate existing saves.'
	);
	process.exit(1);
}