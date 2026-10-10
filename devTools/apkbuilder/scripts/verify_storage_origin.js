/*
 * Guard the WebView origin, which is what partitions localStorage.
 *
 * Saves live in localStorage. The origin is derived from server.hostname and
 * server.androidScheme in capacitor.config.json, so changing either one gives
 * every existing player an empty save and orphans their data irrecoverably.
 * That failure is invisible at runtime, so catch it at build time instead.
 */
const fs = require('fs');
const path = require('path');

const configFile = path.resolve('capacitor.config.json');
const lockFile = path.resolve('storage-origin.json');

if (!fs.existsSync(configFile)) throw new Error(`missing ${configFile}`);
if (!fs.existsSync(lockFile)) throw new Error(`missing ${lockFile}`);

const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
const lock = JSON.parse(fs.readFileSync(lockFile, 'utf-8'));
const server = config.server || {};

const drift = [];
for (const key of ['hostname', 'androidScheme']) {
	if (server[key] !== lock[key]) drift.push(`  ${key}: ${JSON.stringify(server[key])} (locked value is ${JSON.stringify(lock[key])})`);
}

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
		drift.join('\n') + '\n\n' +
		'The game keeps saves in localStorage, which is partitioned by origin. Changing\n' +
		'the origin does not migrate anything -- it just makes every existing save\n' +
		'unreachable. Players would silently start a new game with no saves.\n\n' +
		'If you really intend this, re-run with DOL_ALLOW_ORIGIN_CHANGE=1 and update\n' +
		'storage-origin.json in the same commit.'
	);
	process.exit(1);
}

// appId is the other half of the on-disk identity: changing it installs a
// different app, so the old app (and its saves) stays behind uninstalled.
if (process.env.DOL_ALLOW_APPID_CHANGE !== '1' && lock.appId && config.appId !== lock.appId) {
	console.error(
		`Refusing to build: appId changed from ${lock.appId} to ${config.appId}.\n` +
		'Android treats this as a different app, so users keep the old one and never\n' +
		'see the new build. If that is intended, set DOL_ALLOW_APPID_CHANGE=1 and\n' +
		'update storage-origin.json in the same commit.'
	);
	process.exit(1);
}