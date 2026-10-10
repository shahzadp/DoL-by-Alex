/*
 * Capacitor build wrapper.
 *
 * Capacitor does not version the app from the game's own config, and it has no
 * equivalent of Cordova's build.json, so we do that here. Debug builds get a
 * "_debug" applicationId suffix so they install alongside the official app.
 *
 * The android/ project is a real source tree under version control, so every
 * edit made here is reverted afterwards to keep the working tree clean.
 */
const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');

// assume we're in gameRoot/devTools/apkbuilder
const gameRoot = path.resolve('../..');
const androidRoot = path.resolve('android');
const gradleProps = path.resolve(androidRoot, 'app/build.gradle');

const release = !!process.env.BUILD_RELEASE;

if (!fs.existsSync(gradleProps)) {
	throw new Error(`missing ${gradleProps} (run: npx cap add android)`);
}

// refuse to build if the storage origin is about to change
require('./verify_storage_origin');

// version the app from the game's own config, same as the Cordova build did
const versionFile = path.resolve(gameRoot, 'game/01-config/sugarcubeConfig.js');
if (!fs.existsSync(versionFile)) throw new Error(`missing ${versionFile}`);
const versionData = fs.readFileSync(versionFile, 'utf-8');

const versionMatch = versionData.match(/(?<=version: ")\d+(?:\.\d+)*(?=")/);
if (!versionMatch) throw new Error(`could not read a version number from ${versionFile}`);
const version = versionMatch[0];

// versionCode must be a monotonically increasing int <= 2100000000 (Play limit)
const parts = version.split('.').map(n => parseInt(n, 10) || 0);
const [major = 0, minor = 0, patch = 0, build = 0] = parts;
const versionCode = Math.min(major * 1000000 + minor * 10000 + patch * 100 + build, 2100000000);

const originalGradle = fs.readFileSync(gradleProps, 'utf-8');

try {
	let gradle = originalGradle;

	gradle = gradle.replace(
		/(^\s*versionCode\s+)\d+/m,
		`$1${versionCode}`
	);
	gradle = gradle.replace(
		/(^\s*versionName\s+)"[^"]*"/m,
		`$1"${version}"`
	);

	// debug installs alongside the official app rather than replacing it
	if (!release) {
		gradle = gradle.replace(
			/(^\s*applicationId\s+)"([^"]*)"/m,
			(_, prefix, id) => `${prefix}"${id.endsWith('_debug') ? id : id + '_debug'}"`
		);
	}

	if (gradle === originalGradle) throw new Error('no versionCode/versionName/applicationId found in app/build.gradle to update');
	fs.writeFileSync(gradleProps, gradle, 'utf-8');

	console.log(`building ${version} (versionCode ${versionCode})${release ? ' [release]' : ' [debug]'}`);

	const task = release ? 'assembleRelease' : 'assembleDebug';
	if (process.platform === 'win32') {
		execFileSync('cmd.exe', ['/c', 'gradlew.bat', task], { cwd: androidRoot, stdio: 'inherit' });
	} else {
		execFileSync('./gradlew', [task], { cwd: androidRoot, stdio: 'inherit' });
	}

	// move the apk somewhere obvious, matching what the cordova build did
	const variant = release ? 'release' : 'debug';
	const src = path.resolve(androidRoot, `app/build/outputs/apk/${variant}/app-${variant}.apk`);
	if (fs.existsSync(src)) {
		const distDir = path.resolve(gameRoot, 'dist');
		fs.ensureDirSync(distDir);
		const dest = path.resolve(distDir, `Degrees-of-Lewdity-${version}-${variant}.apk`);
		fs.moveSync(src, dest, { overwrite: true });
		console.log(`moved apk to ${dest}`);
	}
} catch (err) {
	console.error(err.message || err);
	process.exitCode = 1;
} finally {
	// leave android/app/build.gradle exactly as we found it
	try { fs.writeFileSync(gradleProps, originalGradle, 'utf-8'); } catch (e) { /* nothing useful to do */ }
}