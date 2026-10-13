/*
 * Create (or adopt) the release signing keystore.
 *
 *   npm run keystore:new      create a brand new key
 *   npm run keystore:adopt    reuse the key the Capacitor build already uses
 *
 * WHY ADOPTING MATTERS: the key is what makes an app "the same app" to Android.
 * An update signed by a different key is rejected outright, and the player is
 * left on the old build with no way to install yours. So the Flutter app must
 * be signed by exactly the key that signed the Capacitor app, or every existing
 * install is orphaned. keystore:adopt copies that key across; it does not
 * generate a new one.
 *
 * Lose the key entirely and you cannot ship an update to anyone who installed
 * your build, so back it up somewhere outside this repo. It is deliberately
 * gitignored, which means git cannot help you here.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const androidRoot = path.resolve('android');
const propsFile = path.resolve(androidRoot, 'key.properties');
const ALIAS = 'dol-release';
const VALIDITY_DAYS = 10950; // 30 years; Play requires the key to outlive the app
const KEY_SIZE = 4096;

/*
 * Where the Capacitor builder kept its key, if it still exists.
 *
 * The key itself was adopted into android/ and the Capacitor tree has since been
 * removed, so this normally resolves to nothing. It is kept as a last-ditch
 * recovery path: if key.properties were ever lost but a copy of the old key
 * survived somewhere, finding it beats being unable to update the app at all.
 * Losing this key means every existing install can never be replaced again.
 */
const legacyAndroidRoot = path.resolve('../apkbuilder/android');

/*
 * Ambiguous glyphs (0/O, 1/l/I) removed: this password gets typed by hand.
 *
 * Also no '-', '=' or '#'. A leading '-' makes keytool parse the password as
 * an option and it silently produces a keystore you cannot open while still
 * exiting 0. '=' is the key/value separator in the properties file and '#'
 * starts a comment in it, so keeping them out means the password can never need
 * escaping downstream. (MEMORY.md trap 10.)
 */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@%^_+';
const FIRST_CHAR = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function readProps(file) {
	if (!fs.existsSync(file)) return null;
	return Object.fromEntries(
		fs
			.readFileSync(file, 'utf-8')
			.split(/\r?\n/)
			.filter((l) => l.trim() && !l.trim().startsWith('#'))
			.map((l) => {
				const i = l.indexOf('=');
				return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
			})
	);
}

if (fs.existsSync(propsFile)) {
	console.error(
		`refusing to overwrite an existing keystore (${propsFile}).\n` +
			'Android will refuse an update signed by a different key, so replacing it\n' +
			'orphans every installed copy. If you really mean to, delete key.properties\n' +
			'and the .jks yourself, and tell anyone who installed the app.'
	);
	process.exit(1);
}

if (process.argv.includes('--adopt')) {
	adoptLegacyKeystore();
} else {
	createKeystore();
}

function adoptLegacyKeystore() {
	const legacyProps = path.resolve(legacyAndroidRoot, 'keystore.properties');
	const legacy = readProps(legacyProps);
	if (!legacy) {
		console.error(
			`nothing to adopt: ${legacyProps} not found.\n` +
				'That is expected if you have never made a Capacitor release. Run\n' +
				'"npm run keystore:new" in that case -- but note that a fresh key cannot\n' +
				'update an app already installed from the Capacitor build.'
		);
		process.exit(1);
	}

	const storeFile = legacy.storeFile;
	if (!storeFile) {
		console.error(`${legacyProps} has no storeFile; refusing to guess.`);
		process.exit(1);
	}

	// storeFile in the Capacitor layout is relative to apkbuilder/android/,
	// because that build.gradle resolves it with rootProject.file(). Resolve it
	// the same way here, so a bare filename and a nested path both work.
	const legacyKeystore = path.resolve(legacyAndroidRoot, storeFile);
	if (!fs.existsSync(legacyKeystore)) {
		console.error(`keystore named in ${legacyProps} does not exist: ${legacyKeystore}`);
		process.exit(1);
	}

	const dest = path.resolve(androidRoot, 'dol-release.jks');
	fs.copyFileSync(legacyKeystore, dest);

	fs.writeFileSync(
		propsFile,
		[
			'# Release signing credentials, adopted from the Capacitor build. Never commit.',
			'#',
			'# This must stay the same key the Capacitor app was signed with, or Android',
			'# will refuse the Flutter build as an update and existing installs will not',
			'# be able to move over to it.',
			'storeFile=dol-release.jks',
			`storePassword=${legacy.storePassword}`,
			`keyAlias=${legacy.keyAlias || ALIAS}`,
			`keyPassword=${legacy.keyPassword}`,
			'',
		].join('\n'),
		{ mode: 0o600 }
	);

	verifyKeystore(dest, legacy.storePassword, legacy.keyAlias || ALIAS);

	console.log(`
adopted the existing release key
  from ${legacyKeystore}
  to   ${dest}

Both the Capacitor and Flutter builds are now signed by the same key, so the
Flutter apk will install as an update over the Capacitor one.

Back both up somewhere that is NOT this repository.
`);
}

function createKeystore() {
	function randomPassword(length) {
		// Rejection-free modulo is fine here: the alphabets are 60/58 chars and a
		// byte gives 256, so the bias is ~1/256 of a position and this is a local
		// file, not a shared-secret protocol.
		const pick = (alphabet) => alphabet[crypto.randomBytes(1)[0] % alphabet.length];
		// Leading character is restricted, everything else is uniform.
		const out = [pick(FIRST_CHAR)];
		for (let i = 1; i < length; i++) out.push(pick(ALPHABET));
		return out.join('');
	}

	// keytool ships with the JDK, which the Android build already requires.
	const keytool = path.join(
		process.env.JAVA_HOME || path.dirname(process.execPath),
		'bin',
		process.platform === 'win32' ? 'keytool.exe' : 'keytool'
	);
	if (!fs.existsSync(keytool)) {
		throw new Error(`keytool not found at ${keytool}; set JAVA_HOME to a JDK`);
	}

	const storePassword = randomPassword(28);
	// One password for both keeps key.properties simple; the fields are separate
	// in the format so a distinct key password stays possible.
	const keyPassword = storePassword;
	const dname = 'CN=DoL by Alex, OU=Release, O=DoL by Alex, L=Unknown, ST=Unknown, C=US';

	// Keystore lives beside key.properties, because build.gradle.kts resolves
	// storeFile with rootProject.file() -- i.e. relative to android/, not
	// android/app/. Keeping the two in one directory means storeFile is a plain
	// filename with no path segment that can drift out of sync with where the
	// file actually is. (This exact mistake cost a failed build before; see
	// MEMORY.md.)
	const keystoreFile = path.resolve(androidRoot, 'dol-release.jks');

	console.log(`generating a ${KEY_SIZE}-bit RSA key in ${keystoreFile}`);
	console.log('this takes a few seconds\n');

	execFileSync(
		keytool,
		[
			'-genkeypair',
			'-keystore',
			keystoreFile,
			// PKCS12, not JKS: JKS is a Sun-proprietary format and keytool warns
			// about it on every run. PKCS12 has been the JDK default since 9.
			'-storetype',
			'PKCS12',
			'-storepass',
			storePassword,
			'-keypass',
			keyPassword,
			'-alias',
			ALIAS,
			'-keyalg',
			'RSA',
			'-keysize',
			String(KEY_SIZE),
			'-validity',
			String(VALIDITY_DAYS),
			'-dname',
			dname,
		],
		{ stdio: 'inherit' }
	);

	fs.writeFileSync(
		propsFile,
		[
			'# Release signing credentials. Never commit this file.',
			`storeFile=${path.basename(keystoreFile)}`,
			`storePassword=${storePassword}`,
			`keyAlias=${ALIAS}`,
			`keyPassword=${keyPassword}`,
			'',
		].join('\n'),
		{ mode: 0o600 }
	);

	verifyKeystore(keystoreFile, storePassword, ALIAS);

	console.log(`
wrote ${propsFile} and verified it reopens

  storePassword = ${storePassword}
  keyPassword   = ${keyPassword}

Both are the same value, stored in ${propsFile}. That file and ${keystoreFile}
are gitignored -- back both up somewhere that is NOT this repository.

Note: this is a NEW key. It cannot update an app already installed from the
Capacitor build. Use "npm run keystore:adopt" instead if you have one out there.
`);
}

/*
 * Open the keystore again and pull the entry, before claiming success.
 *
 * keytool exits 0 even when it has misread the password as an option, leaving a
 * keystore on disk that nothing can open -- and the only symptom would be a
 * failed release build much later. Reading it back is the only real proof.
 */
function verifyKeystore(keystoreFile, storePassword, alias) {
	const keytool = path.join(
		process.env.JAVA_HOME || path.dirname(process.execPath),
		'bin',
		process.platform === 'win32' ? 'keytool.exe' : 'keytool'
	);
	try {
		const out = execFileSync(
			keytool,
			['-list', '-keystore', keystoreFile, '-storepass', storePassword, '-alias', alias],
			{ stdio: 'pipe' }
		).toString();
		if (!out.includes(alias)) throw new Error(`alias ${alias} not listed`);
		if (fs.statSync(keystoreFile).size < 1000) throw new Error('keystore is implausibly small');
	} catch (e) {
		console.error(
			'\nthe keystore was written but cannot be opened with the recorded\n' +
				'password. Delete it and report this; do not try to build with it.\n' +
				(e.stderr || e.stdout || e.message || '').toString()
		);
		process.exit(1);
	}
}