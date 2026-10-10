/*
 * Capacitor native glue for Degrees of Lewdity.
 *
 * Loaded before the game. The game calls a bare `saveAs(blob, name)` global,
 * which Cordova satisfied by rewriting the compiled HTML at build time. We
 * define that global here instead, which means no source rewriting and no risk
 * of a regex silently mangling the game.
 *
 * Everything degrades gracefully: if a plugin is missing we fall back to the
 * browser behaviour rather than throwing during startup.
 */
(function () {
	"use strict";

	const cap = window.Capacitor;
	if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
		// running in a desktop browser / during development; leave saveAs alone
		return;
	}

	const plugin = function (name) {
		try {
			return (cap.Plugins && cap.Plugins[name]) || null;
		} catch (e) {
			return null;
		}
	};

	const Toast = plugin("Toast");
	const Filesystem = plugin("Filesystem");
	const App = plugin("App");

	function toast(message, duration) {
		if (Toast && Toast.show) {
			return Toast.show({ text: message, duration: duration || "SHORT" });
		}
		console.log("[toast]", message);
		return Promise.resolve();
	}

	/*
	 * Export a Blob to the user.
	 *
	 * SaveDialog is our local Capacitor plugin (android/.../io/github/amphiluke/
	 * SaveDialog.java). It opens the real system save-as dialog, the same
	 * ACTION_CREATE_DOCUMENT picker cordova-plugin-save-dialog used, so export
	 * behaviour is unchanged from the Cordova build.
	 */
	function saveAs(blob, name) {
		name = name || "save.txt";

		const browserFallback = function () {
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = name;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 10000);
		};

		const SaveDialog = plugin("SaveDialog");

		if (!SaveDialog || !SaveDialog.saveFile) {
			// no native picker: fall back to the sandbox, then to a plain download
			if (Filesystem && Filesystem.writeFile) {
				return blobToDataUri(blob)
					.then((dataUri) => Filesystem.writeFile({
						path: name,
						data: dataUri,
						directory: "DOCUMENTS",
						recursive: true
					}))
					.then((res) => {
						toast("Saved to " + (res && res.uri ? res.uri : name), "LONG");
						return res;
					})
					.catch((err) => { reportSaveError(err); throw err; });
			}
			browserFallback();
			return Promise.resolve();
		}

		return blobToDataUri(blob)
			.then((dataUri) => SaveDialog.saveFile({
				name: name,
				type: blob.type || "application/octet-stream",
				data: dataUri
			}))
			.then((res) => {
				toast("Saved " + name, "SHORT");
				return res;
			})
			.catch((err) => {
				const msg = err && err.message ? err.message : String(err);
				// the player closing the picker is a normal outcome, not a failure
				if (/cancel/i.test(msg)) return null;
				reportSaveError(err);
				throw err;
			});
	}

	// never let an export fail silently -- the player would think the save was
	// written when it was not
	function reportSaveError(err) {
		console.error("[saveAs]", err);
		toast("Could not save: " + (err && err.message ? err.message : err), "LONG");
	}

	function blobToDataUri(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.onabort = () => reject(new Error("blob read aborted"));
			reader.readAsDataURL(blob);
		});
	}

	window.saveAs = saveAs;
	window.Toast = {
		showToast: (text, duration) => toast(text, duration === 1 ? "LONG" : "SHORT"),
		LONG: 1,
		SHORT: 0
	};

	/*
	 * Back button: close overlays first, then warn, then exit.
	 *
	 * Capacitor fires 'backButton' instead of Cordova's DOM 'backbutton' event,
	 * and subscribing disables Capacitor's default handling entirely.
	 */
	if (App && App.addListener) {
		let lastBackEvent = 0;
		App.addListener("backButton", function () {
			try {
				if (window.SugarCube && SugarCube.Dialog && SugarCube.Dialog.isOpen()) {
					SugarCube.Dialog.close();
					return;
				}
				if (window.T && T.currentOverlay && typeof closeOverlay === "function") {
					closeOverlay();
					return;
				}
			} catch (e) {
				console.warn("[backButton]", e);
			}

			const now = Date.now();
			if (now > lastBackEvent + 3500) {
				toast("Press BACK again to exit", "LONG");
				lastBackEvent = now;
				return;
			}
			if (App.exitApp) App.exitApp();
		});
	}
})();