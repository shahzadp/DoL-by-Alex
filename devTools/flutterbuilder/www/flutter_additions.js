/*
 * Flutter native glue for Degrees of Lewdity.
 *
 * This file used to be the app's whole UI layer. It injected a loading screen
 * into the story, wrote status messages onto the page, and implemented the back
 * button. All of that is Dart now (lib/src/), and what is left here is only the
 * part that cannot be: turning a Blob into bytes and reading state the game
 * already owns.
 *
 * Loaded before the game, and deliberately tiny. The reason it exists at all is
 * `saveAs(blob, name)`, a bare global the game calls. Cordova satisfied it by
 * rewriting the compiled HTML at build time, Capacitor with a plugin bridge, and
 * this defines it directly -- so there is no source rewriting and no risk of a
 * regex silently mangling the game.
 *
 * Everything degrades gracefully: with no Flutter bridge this file falls back to
 * browser behaviour rather than throwing during startup, which is also what
 * makes it safe to serve in a desktop browser during development.
 */
(function () {
	"use strict";

	/*
	 * Wait for flutter_inappwebview to install its bridge.
	 *
	 * It is injected at document start, so in practice it is already there
	 * before this script runs; the poll exists so a future change in injection
	 * order degrades into a working browser fallback instead of a dead export
	 * button.
	 *
	 * Test for callHandler and nothing else. It is the only capability this page
	 * ever uses -- it registers no handlers of its own. This used to also require
	 * addJavaScriptHandler to be a function, which is an unrelated capability the
	 * page never touches and which flutter_inappwebview 6.2.0-beta.3 does not
	 * necessarily expose. When it was absent the gate was permanently false, and
	 * that failed silently and totally: saveAs waited, gave up, and then reported
	 * the failure through toast() -- which consults this same gate, so it logged
	 * to the console instead of the screen. Export did nothing whatsoever, with
	 * no error visible anywhere. Import, the back button and the loading screen
	 * were all unaffected, which is exactly the shape of the bug.
	 */
	function bridgeReady() {
		return !!(
			window.flutter_inappwebview &&
			typeof window.flutter_inappwebview.callHandler === "function"
		);
	}

	function whenBridgeReady(attemptsLeft) {
		if (bridgeReady()) return Promise.resolve(true);
		if (attemptsLeft <= 0) return Promise.resolve(false);
		return new Promise((resolve) => {
			setTimeout(() => resolve(whenBridgeReady(attemptsLeft - 1)), 50);
		});
	}

	function bridgeDescription() {
		const w = window.flutter_inappwebview;
		if (!w) return "flutter_inappwebview: absent";
		return (
			"flutter_inappwebview: present; callHandler=" +
			typeof w.callHandler +
			", addJavaScriptHandler=" +
			typeof w.addJavaScriptHandler
		);
	}

	/*
	 * Every call into the app.
	 *
	 * Failures are logged and swallowed rather than propagated. The native side
	 * is responsible for telling the player what happened -- it has a status
	 * banner and a toast, neither of which needs this file -- and a rejection
	 * surfacing as an unhandled promise inside the game's own console would be
	 * noise rather than information.
	 */
	function call(name, args) {
		if (!bridgeReady()) return Promise.resolve(null);
		return window.flutter_inappwebview.callHandler(name, args).catch((e) => {
			console.warn("[dol]", name, e);
			return null;
		});
	}

	// ---------------------------------------------------------------------
	// Export
	// ---------------------------------------------------------------------

	/*
	 * A Blob as bare base64.
	 *
	 * readAsDataURL gives "data:<type>;base64,<payload>"; only the payload is
	 * wanted, though the Kotlin side accepts either form.
	 */
	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = String(reader.result || "");
				const comma = result.indexOf(",");
				resolve(comma >= 0 ? result.slice(comma + 1) : result);
			};
			reader.onerror = () => reject(reader.error);
			reader.onabort = () => reject(new Error("blob read aborted"));
			reader.readAsDataURL(blob);
		});
	}

	function browserDownload(blob, name) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		// revoke late: revoking immediately races the download in some WebViews
		setTimeout(() => URL.revokeObjectURL(url), 10000);
	}

	/*
	 * The game calls this. Everything after the bytes -- the system dialog, the
	 * wait, the cancellation, the success message, the failure message -- is
	 * Dart's job (lib/src/export_service.dart), and is reported from there.
	 *
	 * The payload rides over as base64, exactly as it did for the Capacitor
	 * SaveDialog plugin, which was itself adapted from the Cordova original.
	 */
	function saveAs(blob, name) {
		name = name || "save.txt";

		/*
		 * The browser fallback below cannot work on Android, so a missing bridge
		 * is not by itself a reason to take it.
		 *
		 * This used to be a bare `if (!bridgeReady()) { browserDownload(); }`.
		 * That is a silent no-op in a WebView: there is no download manager, so a
		 * synthetic <a download> click is discarded. Export appeared to do nothing
		 * at all -- no file, no picker, no message -- which is exactly how the real
		 * bug, a payload the native side could not read, hid for so long.
		 *
		 * So the two cases are separated. No flutter_inappwebview at all means a
		 * desktop browser, where the download path genuinely works and is worth
		 * keeping for development. A bridge that exists but has not installed its
		 * handlers yet means the app, and there we wait rather than guess.
		 */
		if (typeof window.flutter_inappwebview === "undefined") {
			browserDownload(blob, name);
			return Promise.resolve(null);
		}

		return whenBridgeReady(40)
			.then((ready) => {
				if (!ready) throw new Error("no app bridge (" + bridgeDescription() + ")");
				return blobToBase64(blob);
			})
			.then((base64) =>
				window.flutter_inappwebview.callHandler("DoLNative.saveFile", {
					name: name,
					// Strip parameters: the game builds its blob as
					// text/plain;charset=UTF-8, and a parameterised type is not a
					// MIME type, so ACTION_CREATE_DOCUMENT matches no document
					// provider with it. The Dart side normalises again -- a value
					// this far from its destination is worth normalising at both
					// ends, so a regression at either one is not enough to break
					// the picker.
					mimeType: (blob.type || "application/octet-stream").split(";")[0],
					data: base64,
				})
			)
			.catch((err) => {
				// Reported natively, deliberately. The toast used to be raised from
				// here too, which meant a failure of the bridge reported itself
				// through the bridge: the message went to the console and the
				// player saw nothing.
				console.error("[saveAs]", err);
				throw err;
			});
	}

	function toast(message, duration) {
		return call("DoLNative.toast", { message: String(message), long: duration === 1 });
	}

	// ---------------------------------------------------------------------
	// Load state
	// ---------------------------------------------------------------------

	/*
	 * Hide SugarCube's own spinner, and nothing else.
	 *
	 * The loading screen is a Flutter widget now. What remains is one rule whose
	 * whole job is to stop a 100px grey ring appearing for a second before the
	 * native screen has been told the load started, and which has to be CSS to
	 * do it: this script is injected at character ~1600 of a 50 MB document, the
	 * story flips data-init to "loading" at ~1772, the <div id="init-loading"> is
	 * not created until ~754783, and DOMContentLoaded cannot fire until the whole
	 * thing has been parsed. A CSS rule applies the instant the parser creates
	 * the element, so this is in force for that entire window.
	 *
	 * !important is required: SugarCube's own display:block is written as
	 * html[data-init=loading] #init-loading and lands later in the cascade, so a
	 * plain rule here would lose to it on both counts.
	 *
	 * scripts/prepare_flutter_assets.js checks for this rule on every build. Do
	 * not remove it without moving the guard with it.
	 */
	if (document.head) {
		const hideStockSpinner = document.createElement("style");
		hideStockSpinner.id = "dol-hide-stock-spinner";
		hideStockSpinner.textContent = "#init-loading{display:none !important}";
		document.head.appendChild(hideStockSpinner);
	}

	/*
	 * Report when the story is busy.
	 *
	 * `data-init` on <html> is SugarCube's own state: absent when the story is
	 * playable, "loading" while it works, "lacking" when the story data cannot be
	 * read. It is the same signal the in-page loader used, and it is the only
	 * signal that covers *every* load and not just startup -- passage transitions
	 * re-arm it through LoadScreen.lock(). No WebView callback fires for those,
	 * and no amount of polling on the Dart side would be cheaper than being told.
	 *
	 * document.readyState rides along purely as a diagnostic. It is the one thing
	 * on the device that separates a slow parse from a document that has stopped
	 * making progress, and the two used to look identical (MEMORY.md trap 32).
	 */
	function publishLoadState() {
		const root = document.documentElement;
		if (!root) return;

		const value = root.getAttribute("data-init");

		let state;
		if (value === null) state = "ready";
		else if (value === "lacking") state = "failed";
		else if (value === "no-js") return; // the static value; the story flips it in a moment
		else state = "loading";

		call("DoLNative.loadState", { state: state, document: document.readyState });
	}

	/*
	 * Guarded, because nothing else in this file is wrapped and an uncaught
	 * throw here would abort the whole IIFE -- which would take `saveAs` with it
	 * and turn a cosmetic problem into a dead export button. The observation is
	 * the one piece of this that can legitimately find the document not ready
	 * yet; everything after it can run unconditionally.
	 */
	try {
		new MutationObserver(publishLoadState).observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-init"],
		});
	} catch (e) {
		console.warn("[dol] cannot observe data-init", e);
	}

	/*
	 * Backstops, in case the attribute was already in its final state when the
	 * observer was attached. Cheap, and they turn a silent stuck loader into a
	 * working one.
	 */
	document.addEventListener("DOMContentLoaded", publishLoadState);
	window.addEventListener("load", publishLoadState);

	interceptFileInputs();

	// ---------------------------------------------------------------------
	// Import
	// ---------------------------------------------------------------------

	/*
	 * "Load from file", without the WebView's file chooser.
	 *
	 * The story has two `<input type="file">` elements and no picker. The
	 * supported route is the plugin's `onShowFileChooser`, which is gated behind
	 * its own `useOnShowFileChooser` setting (InAppWebViewChromeClient.java:866)
	 * and never fired: the input did nothing, with no error anywhere. The
	 * plugin's own fallback picker was no better -- it guards on
	 * `intent.resolveActivity(...)`, which returns null on Android 11+ for the
	 * system chooser under package visibility.
	 *
	 * So this cancels the input's click in the capture phase, before the WebView
	 * tries to open anything, asks the app for the file, and puts a real File on
	 * the input. The game's own `onchange="importSave(this.files)"` then runs
	 * exactly as it would have, with a real FileList.
	 *
	 * Capture phase matters: a bubble-phase listener is too late, because the
	 * WebView starts the chooser as its own default action for the event.
	 */
	function interceptFileInputs() {
		document.addEventListener("click", onFileInputClick, true);
	}

	/*
	 * Find the file input an event was aimed at, however indirect the aim.
	 *
	 * `event.target` alone is not enough: a tap can land on a label, on a
	 * wrapper, or on the overlay SugarCube built the markup into, and only the
	 * first of those is the input. `composedPath` gets the whole chain, and
	 * `closest` catches an ancestor that wraps or points at it.
	 */
	function fileInputFor(event) {
		const path =
			typeof event.composedPath === "function" ? event.composedPath() : null;
		if (path) {
			for (const node of path) {
				if (node && node.tagName === "INPUT" && node.type === "file") return node;
			}
		}
		const target = event.target;
		if (target && target.closest) {
			const found = target.closest('input[type="file"]');
			if (found) return found;
		}
		return null;
	}

	function onFileInputClick(event) {
		const input = fileInputFor(event);
		if (!input) return;

		// Desktop browser: leave the browser's own picker alone.
		if (typeof window.flutter_inappwebview === "undefined") return;

		event.preventDefault();
		event.stopPropagation();

		const accept = typeof input.accept === "string" ? input.accept : "";
		askForFile(input, accept);
	}

	/*
	 * Ask the app for the file, and never leave the player waiting on nothing.
	 *
	 * Every failure of this path used to be silent, which is why it failed twice
	 * with nothing to go on. There are four ways it can go wrong that the page
	 * can see -- no handler, a rejection, a throw while building the File, and a
	 * native side that never answers -- and all four now end with the player
	 * being told. The timer is the fourth: a picker that never returns used to
	 * look exactly like a picker that was never opened.
	 */
	function askForFile(input, accept) {
		console.log("[dol] asking for a file for", input.id || "an unnamed input");

		const giveUp = (why) => {
			console.error("[dol] import failed:", why);
			reportImportFailure(why);
		};

		let settled = false;
		const timer = setTimeout(() => {
			if (settled) return;
			settled = true;
			giveUp("the app did not answer within 30s");
		}, 30000);

		if (typeof window.flutter_inappwebview === "undefined") {
			settled = true;
			clearTimeout(timer);
			giveUp("no app bridge");
			return;
		}

		window.flutter_inappwebview
			.callHandler("DoLNative.pickFile", {
				accept: accept
					? accept.split(",").map((a) => a.trim()).filter((a) => a.length > 0)
					: [],
			})
			.then((picked) => {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				if (!picked) return; // the player cancelled; nothing to say
				deliver(input, picked, giveUp);
			})
			.catch((err) => {
				clearTimeout(timer);
				if (settled) return;
				settled = true;
				giveUp(String((err && err.message) || err));
			});
	}

	/*
	 * Put the failure on the screen by whatever route is left.
	 *
	 * The page first, because it works with no bridge at all, and then the app,
	 * which can raise a native toast. Two routes on purpose: this path has been
	 * dead silent twice and the only defence is never having one route.
	 */
	function reportImportFailure(why) {
		try {
			const el = document.getElementById("dol-error");
			if (!el) {
				el = document.createElement("div");
				el.id = "dol-error";
				el.style.cssText = [
					"position:fixed",
					"left:0",
					"right:0",
					"bottom:0",
					"z-index:2147483647",
					"background:#000",
					"color:#ff8a80",
					"font:12px/1.4 monospace",
					"padding:10px 12px",
				].join(";");
				(document.body || document.documentElement).appendChild(el);
			}
			el.textContent = "Import failed: " + why;
		} catch (ignored) {
			// the page is in no state to be written to; the toast below still runs
		}

		try {
			call("DoLNative.importFailed", { why: why }).catch(() => {});
		} catch (ignored) {
			// and if there is no bridge either, the page message above is all there is
		}
	}

	/*
	 * Put the picked file on the input and fire `change`, so the game's own
	 * handler sees a normal FileList.
	 *
	 * Decoded to a Uint8Array rather than a binary string: `importSave` reads it
	 * with readAsText and the settings importer with readAsBinaryString, and
	 * routing the bytes through a JS string mangles anything that is not valid
	 * latin-1. The File is built from the bytes, so what the reader sees is
	 * byte-identical to what the player chose.
	 */
	function deliver(input, picked, giveUp) {
		try {
			const binary = atob(picked.data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

			const file = new File([bytes], picked.name || "save.txt", {
				type: picked.mimeType || "text/plain",
			});

			const transfer = new DataTransfer();
			transfer.items.add(file);
			input.files = transfer.files;

			// The game's handlers are inline `onchange` attributes, so `change` is
			// all that is needed; bubbles is only so a delegated listener would see
			// it too.
			input.dispatchEvent(new Event("change", { bubbles: true }));
			console.log("[dol] delivered", picked.name, "to", input.id || "an unnamed input");
		} catch (err) {
			giveUp("could not read the file into the page: " + err);
		}
	}

	// ---------------------------------------------------------------------
	// Back button
	// ---------------------------------------------------------------------

	/*
	 * Let the game close whatever it has open. Returns true if it did.
	 *
	 * Android never delivers the DOM 'backbutton' event, so the gesture is
	 * intercepted natively (PopScope in lib/src/game_shell.dart) and routed in
	 * here. This half has to stay in the page because it is the only place that
	 * knows whether a SugarCube dialog or an overlay is open. Everything else --
	 * the press-again-to-exit window, the message, the exit itself -- is Dart's.
	 *
	 * Deliberately synchronous: the answer is needed before the app can decide
	 * anything, and returning a Promise would make every caller deal with whether
	 * evaluateJavascript unwraps promises on this platform.
	 */
	window.__dolCloseGameUi = function () {
		try {
			if (window.SugarCube && SugarCube.Dialog && SugarCube.Dialog.isOpen()) {
				SugarCube.Dialog.close();
				return true;
			}
			if (window.T && T.currentOverlay && typeof closeOverlay === "function") {
				closeOverlay();
				return true;
			}
		} catch (e) {
			console.warn("[back]", e);
		}
		return false;
	};

	/*
	 * Notches and system bars are handled in Dart, not here.
	 *
	 * The obvious approach is env(safe-area-inset-*) plus viewport-fit=cover on
	 * the viewport meta tag. It does not work for this app: Chromium derives
	 * those insets from the display cutout, so on a three-button-navigation
	 * device with no cutout they resolve to 0 and the story ends up underneath
	 * the buttons. See the SafeArea in lib/src/game_shell.dart, which knows both.
	 */

	/*
	 * Only claim the globals once the bridge is actually there. Assigning
	 * unconditionally would break the browser fallback above for anyone opening
	 * the same file outside the app.
	 */
	whenBridgeReady(40).then((ok) => {
		if (!ok) return;
		window.saveAs = saveAs;
		window.Toast = {
			showToast: (text, duration) => toast(text, duration === 1 ? 1 : 0),
			LONG: 1,
			SHORT: 0,
		};
	});
})();