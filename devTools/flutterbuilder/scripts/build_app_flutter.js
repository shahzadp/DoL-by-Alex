/*
 * Flutter build wrapper.
 *
 * Flutter takes the version from the command line (--build-name / --build-code)
 * rather than from a checked-in file, so unlike the Cordova and Capacitor
 * builds there is nothing to rewrite and revert. This script reads the game's
 * own version, converts it to a versionCode the way the previous builds did,
 * invokes Flutter, verifies the result and drops the apk in dist/.
 *
 * The versionCode formula is unchanged from build_app_capacitor.js on purpose:
 * it has to keep increasing across builds, or an upgrade over an
 * already-installed app is rejected. Note in particular that it is *not* simply
 * the previous number plus one -- it is derived from the version, so a release
 * built from a different source tree can still collide. Bump
 * game/01-config/sugarcubeConfig.js before shipping.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// assume we're in gameRoot/devTools/flutterbuilder
const gameRoot = path.resolve('../..');
const androidRoot = path.resolve('android');
const release = !!process.env.BUILD_RELEASE;

/**
 * Locate the Android SDK.
 *
 * Flutter itself reads android/local.properties, and so does Gradle, so that is
 * the authoritative answer. The env vars are the fallback, and the last resort
 * is devTools/androidsdk, since this repo has exactly one SDK on the machine.
 *
 * That directory used to be devTools/apkbuilder/androidsdk -- it was created
 * for the Capacitor builder and outlived it. It was moved rather than deleted
 * when the Capacitor tree went: sdkmanager crashes on this machine
 * (MEMORY.md), so re-installing build-tools 36 and the NDK is a genuinely
 * painful way to learn that the SDK had been thrown away with the app code.
 */
function androidSdk() {
	const localProps = path.resolve(androidRoot, 'local.properties');
	if (fs.existsSync(localProps)) {
		const m = fs
			.readFileSync(localProps, 'utf-8')
			.match(/^\s*sdk\.dir\s*=\s*(.+?)\s*$/m);
		if (m) return m[1].replace(/\\/g, '\\').replace(/\\\\/g, '\\');
	}
	if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
	if (process.env.ANDROID_SDK_ROOT) return process.env.ANDROID_SDK_ROOT;

	const shared = path.resolve('../androidsdk');
	if (fs.existsSync(shared)) return shared;
	throw new Error('cannot find the Android SDK: set ANDROID_HOME or run "flutter doctor --android-licenses"');
}

/*
 * Run apksigner to prove the apk really is signed.
 *
 * Checking for META-INF/*.SF would be the cheap option but is wrong here: the
 * release config signs v2+v3 only, and those live in the apk signing block,
 * not in META-INF. An unsigned apk and a v1-only apk are both invisible to a
 * file listing.
 *
 * Invoked as `java -cp apksigner.jar` rather than through apksigner.bat: the
 * .bat has to be run via cmd.exe /c, which re-splits its arguments on spaces
 * and mangles any path containing them (MEMORY.md trap 9).
 */
function verifySignature(apk) {
	const buildTools = path.resolve(androidSdk(), 'build-tools');
	if (!fs.existsSync(buildTools)) {
		throw new Error(`cannot verify signature: no build-tools under ${buildTools}`);
	}
	// Newest first: an older apksigner may not understand newer signing schemes
	// and would report them as absent, failing a perfectly good build.
	const signer = fs
		.readdirSync(buildTools)
		.sort((a, b) => compareBuildTools(b, a))
		.map((v) => path.resolve(buildTools, v, 'lib', 'apksigner.jar'))
		.find(fs.existsSync);
	if (!signer) throw new Error(`cannot verify signature: no apksigner.jar under ${buildTools}`);

	const java = path.join(
		process.env.JAVA_HOME || path.dirname(process.execPath),
		'bin',
		process.platform === 'win32' ? 'java.exe' : 'java'
	);

	let out;
	try {
		// --verbose is what makes apksigner print the per-scheme verdicts; without
		// it exits 0 on success but says nothing about which schemes applied.
		out = execFileSync(
			java,
			['-cp', signer, 'com.android.apksigner.ApkSignerTool', 'verify', '--verbose', '--print-certs', apk],
			{ stdio: 'pipe' }
		).toString();
	} catch (e) {
		throw new Error(`apksigner rejected ${apk}:\n${(e.stdout || '').toString()}${e.stderr || ''}`);
	}

	// The schemes this project actually signs with; see the signingConfigs block.
	for (const scheme of ['v2', 'v3']) {
		if (!new RegExp(`Verified using ${scheme} scheme[^:]*:\\s*true`).test(out)) {
			throw new Error(`${apk} is not signed with the required ${scheme} scheme:\n${out.trim()}`);
		}
	}

	const dn = out.match(/Signer #1 certificate DN:\s*(.+)/);
	console.log(`signature verified (v2+v3) as ${dn ? dn[1].trim() : 'unknown'}`);
}

// build-tools directories are "35.0.0"-shaped; sort numerically, not lexically,
// or 9.0.0 sorts above 35.0.0 and we pick the wrong one.
function compareBuildTools(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d;
	}
	return 0;
}

// refuse to build if the storage origin is about to change
require('./verify_storage_origin');

// An unsigned release APK installs nowhere and looks fine right up until it
// does not, so fail here instead of shipping one.
const keystoreProps = path.resolve(androidRoot, 'key.properties');
if (release && !fs.existsSync(keystoreProps)) {
	throw new Error(
		`release build requested but ${keystoreProps} is missing.\n` +
			'Create one with: npm run keystore:new\n' +
			'Back the resulting .jks up outside this repo -- losing it means you can\n' +
			'never publish an update to an app already on a device.'
	);
}

// version the app from the game's own config, same as the Cordova build did
const versionFile = path.resolve(gameRoot, 'game/01-config/sugarcubeConfig.js');
if (!fs.existsSync(versionFile)) throw new Error(`missing ${versionFile}`);
const versionData = fs.readFileSync(versionFile, 'utf-8');

const versionMatch = versionData.match(/(?<=version: ")\d+(?:\.\d+)*(?=")/);
if (!versionMatch) throw new Error(`could not read a version number from ${versionFile}`);
const version = versionMatch[0];

// versionCode must be a monotonically increasing int <= 2100000000 (Play limit)
const parts = version.split('.').map((n) => parseInt(n, 10) || 0);
const [major = 0, minor = 0, patch = 0, build = 0] = parts;
const versionCode = Math.min(major * 1000000 + minor * 10000 + patch * 100 + build, 2100000000);

try {
	console.log(`building ${version} (versionCode ${versionCode})${release ? ' [release]' : ' [debug]'}`);

	const variant = release ? 'release' : 'debug';
	const args = [
		'build',
		'apk',
		`--${variant}`,
		// --build-name is the four-part version string; it lands in the apk
		// manifest as versionName, which Android accepts verbatim.
		`--build-name=${version}`,
		// --build-number (not --build-code) is versionCode.
		`--build-number=${versionCode}`,
	];
	// The debug build gets a ".debug" applicationId suffix from the gradle
	// build type, so it installs alongside the official app instead of
	// replacing it. See android/app/build.gradle.kts.

	// shell:true is required on Windows to reach flutter.bat. Args are simple
	// --key=value pairs with no spaces, so cmd's re-splitting (MEMORY.md trap
	// 9) cannot mangle them.
	execFileSync('flutter', args, { cwd: __dirname, stdio: 'inherit', shell: process.platform === 'win32' });

	const src = path.resolve('build/app/outputs/flutter-apk', `app-${variant}.apk`);
	if (!fs.existsSync(src)) {
		throw new Error(`flutter reported success but produced no apk at ${src}`);
	}

	// Gradle will happily emit an unsigned release apk; prove otherwise rather
	// than trusting the signing block, since v1 is off and there is no
	// META-INF/*.SF to look for.
	if (release) verifySignature(src);

	const distDir = path.resolve(gameRoot, 'dist');
	fs.mkdirSync(distDir, { recursive: true });
	const dest = path.resolve(distDir, `DoL-by-Alex-${version}-${variant}.apk`);
	fs.copyFileSync(src, dest);

	const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
	console.log(`copied apk to ${dest} (${mb} MB)`);
} catch (err) {
	console.error(err.message || err);
	process.exitCode = 1;
}