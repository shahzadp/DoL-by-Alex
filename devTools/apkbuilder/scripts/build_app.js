/**
 * build wrapper
 */
(async () => {
	const cordova = require('cordova');
	const read = require('read');
	const fs = require('fs-extra');
	const path = require('path');
	const xml = require('cordova-common').xmlHelpers;

	// assume we're in gameRoot/devTools/apkbuilder
	const gameRoot = path.resolve("../..");

	// config.xml is rewritten for every build (version + package name).
	// keep the original so we can put it back afterwards and leave the git tree clean.
	const configFile = path.resolve("config.xml");
	const originalConfig = fs.readFileSync(configFile, "utf-8");

	const release = process.env.BUILD_RELEASE;

	try {
		// read version info from gameRoot/game/01-config/sugarcubeConfig.js
		const versionFile = path.resolve(gameRoot, "game/01-config/sugarcubeConfig.js");
		if (!fs.existsSync(versionFile)) throw new Error(`Cannot find ${versionFile}`);
		const versionData = fs.readFileSync(versionFile).toString();
		// extract the dotted version from 'version: "0.X.Y.Z",'
		const versionMatch = versionData.match(/(?<=version: ")\d+(?:\.\d+)*(?=")/);
		if (!versionMatch) throw new Error(`Could not read a version number from ${versionFile}`);
		const version = versionMatch[0];

		// An Android build needs a specific StartConfig (see "Changing the build version
		// and type" in the top-level README.md). Building with the desktop settings
		// produces a silently misconfigured app, so fail here with an explanation.
		const expected = { enableImages: "true", enableLinkNumberify: "false" };
		const wrong = Object.keys(expected).filter(key => {
			const m = versionData.match(new RegExp(`^\\s*${key}:\\s*(true|false)`, "m"));
			return !m || m[1] !== expected[key];
		});
		if (wrong.length) {
			throw new Error(
				`game/01-config/sugarcubeConfig.js is not configured for an Android build.\n` +
				`  wrong: ${wrong.join(", ")}\n` +
				`  need:  ${Object.entries(expected).map(([k, v]) => `${k}: ${v}`).join(", ")}\n` +
				`See "Changing the build version and type" in the top-level README.md, then re-run.`
			);
		}

		// adjust config.xml
		const configData = xml.parseElementtreeSync(configFile);
		// update version
		configData.getroot().attrib.version = version;
		// update package name for debug and release builds
		let targetName = configData.getroot().attrib['android-packageName'];
		if (release && targetName.endsWith("_debug")) targetName = targetName.slice(0, -6);
		else if (!release && !targetName.endsWith("_debug")) targetName += "_debug";
		configData.getroot().attrib['android-packageName'] = targetName;
		fs.writeFileSync(configFile, configData.write({indent: 4}), "utf-8");

		// update android manifest
		const manifestFile = path.resolve('platforms/android/app/src/main/AndroidManifest.xml');
		if (fs.existsSync(manifestFile)) {
			const manifestData = xml.parseElementtreeSync(manifestFile);
			if (manifestData.getroot().attrib.package !== targetName) {
				const prevName = manifestData.getroot().attrib.package;
				// update targetName
				manifestData.getroot().attrib.package = targetName;
				fs.writeFileSync(manifestFile, manifestData.write({ indent: 4 }), 'utf-8');
				// update project paths
				const javaDir = "platforms/android/app/src/main/java/";
				const prevDir = path.resolve(javaDir, prevName.split(".").join("/"));
				const targetDir = path.resolve(javaDir, targetName.split(".").join("/"))
				if (fs.existsSync(prevDir) && !fs.existsSync(targetDir)) fs.moveSync(prevDir, targetDir);
				const mainActivity = path.resolve(targetDir, "MainActivity.java");
				if (fs.existsSync(mainActivity)) fs.writeFileSync(mainActivity, fs.readFileSync(mainActivity).toString().replace(prevName, targetName));
			}
		}

		if (release) {
			const keystore = path.resolve(gameRoot, 'keys/dol.keystore');
			if (!fs.existsSync(keystore)) {
				throw new Error(
					`Release build requires a valid keystore @${keystore}.
			 If you don't have one, it is recommended to use debug build instead.`)
			}

			const buildFile = path.resolve('build.json');
			const buildFileExists = fs.existsSync(buildFile);
			let password = ""
			try {
				if (buildFileExists && process.env.SKIP_PASSWORD); // skip the prompt
				else password = await read({
					prompt: 'Please enter the password' + (buildFileExists ? ' (or press enter to re-use last provided): ' : ': '),
					silent: true,
					replace: '*',
					timeout: 15000,
				})
			} catch (ex) {
				// only tolerate a timeout, and only when we can fall back to a stored password
				if (ex.message !== "timed out") throw ex;
				if (!buildFileExists) throw new Error(`Timed out waiting for keystore password and no ${buildFile} to reuse`);
				console.log(" re-using old password ");
			}

			if (!password) {
				if (!buildFileExists) throw new Error("no password provided, exiting");
			} else {
				const build_opts = {
					android: {
						release: {
							keystore: keystore,
							storePassword: password,
							password: password,
							alias: "dol",
							keystoreType: "pkcs12",
							packageType: "apk",
						}
					}
				}
				fs.writeFileSync(buildFile, JSON.stringify(build_opts, null, "\t"));
			}
		}

		await cordova.build({options: {release}});
	} catch (err) {
		// print the message without the stack for the failures we raise ourselves
		if (err && err.message && !err.stack) console.error(err.message);
		else console.error(err);
		process.exitCode = 1;
	} finally {
		// put config.xml back the way we found it
		try { fs.writeFileSync(configFile, originalConfig, "utf-8"); } catch (e) { /* nothing useful to do here */ }
	}
})()
