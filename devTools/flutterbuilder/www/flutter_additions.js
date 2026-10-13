/*
 * Flutter native glue for Degrees of Lewdity.
 *
 * Loaded before the game. The game calls a bare `saveAs(blob, name)` global,
 * which Cordova satisfied by rewriting the compiled HTML at build time and
 * Capacitor satisfied with a plugin bridge. We define that global here instead,
 * so there is no source rewriting and no risk of a regex silently mangling the
 * game.
 *
 * Everything degrades gracefully: if the Flutter bridge is missing we fall back
 * to the browser behaviour rather than throwing during startup. That also makes
 * this file safe to serve in a desktop browser during development.
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
	 */
	function bridgeReady() {
		return !!(
			window.flutter_inappwebview &&
			typeof window.flutter_inappwebview.addJavaScriptHandler === "function"
		);
	}

	function whenBridgeReady(attemptsLeft) {
		if (bridgeReady()) return Promise.resolve(true);
		if (attemptsLeft <= 0) return Promise.resolve(false);
		return new Promise((resolve) => {
			setTimeout(() => resolve(whenBridgeReady(attemptsLeft - 1)), 50);
		});
	}

	function toast(message, duration) {
		if (!bridgeReady()) {
			console.log("[toast]", message);
			return Promise.resolve();
		}
		return window.flutter_inappwebview
			.callHandler("DoLNative.toast", {
				message: message,
				long: duration === 1,
			})
			.catch((e) => console.warn("[toast]", e));
	}

	/*
	 * Export a Blob to the user.
	 *
	 * Android side is MainActivity.kt: it opens the real system save-as dialog
	 * (Storage Access Framework), the same ACTION_CREATE_DOCUMENT picker
	 * cordova-plugin-save-dialog used, so export behaviour is unchanged from the
	 * Cordova and Capacitor builds.
	 *
	 * The payload rides over as base64, exactly as it did for the Capacitor
	 * SaveDialog plugin, which was itself adapted from the Cordova original.
	 */
	function blobToBase64(blob) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				// readAsDataURL gives "data:<type>;base64,<payload>"; the Kotlin
				// side accepts either form but the payload is all it wants.
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

	function saveAs(blob, name) {
		name = name || "save.txt";

		if (!bridgeReady()) {
			browserDownload(blob, name);
			return Promise.resolve(null);
		}

		return blobToBase64(blob)
			.then((base64) =>
				window.flutter_inappwebview.callHandler("DoLNative.saveFile", {
					name: name,
					mimeType: blob.type || "application/octet-stream",
					data: base64,
				})
			)
			.then((uri) => {
				// null means the player dismissed the picker, which is a normal
				// outcome and must not be reported as a failure.
				if (uri) toast("Saved " + name, 0);
				return uri;
			})
			.catch((err) => {
				// never let an export fail silently -- the player would think the
				// save was written when it was not
				const msg = err && err.message ? err.message : String(err);
				if (/cancel/i.test(msg)) return null;
				console.error("[saveAs]", err);
				toast("Could not save: " + msg, 1);
				throw err;
			});
	}

	/*
	 * The loading screen.
	 *
	 * With the Flutter splash gone, this is what the player looks at for the few
	 * seconds it takes to deliver and parse a 50 MB story, so it is worth making
	 * decent. Left alone, SugarCube 2.36 draws a 100px ring with a chunky 24px
	 * grey border (#7f7f7f), spins it once every two seconds, offsets it to
	 * top:25% so it is not even centred, and hides the "Loading…" text entirely
	 * with text-indent:9999em. What you get is a bare grey circle on black.
	 *
	 * Replaced with the app's own mark, which is the same four tiles as the
	 * launcher icon, breathing rather than spinning, plus a visible label. It
	 * ties the loading screen to the app the player just tapped.
	 *
	 */
	/*
	 * The loading screen.
	 *
	 * With the Flutter splash gone, this is what the player looks at for the few
	 * seconds it takes to deliver and parse a 50 MB story, so it is worth making
	 * decent.
	 *
	 * SugarCube's own loader is a 100px ring with a 24px #7f7f7f border, one
	 * rotation per two seconds, offset to top:25% so it is not even centred, with
	 * the "Loading…" text hidden behind text-indent:9999em.
	 *
	 * Two earlier attempts to restyle it by overriding its CSS both failed, and
	 * the second one failed *on the device after it had been verified in a
	 * browser harness*, so this no longer fights it. We delete the element and
	 * draw our own.
	 *
	 * Why overriding could never be trusted: this script is injected at the very
	 * top of the story, before any of its 55 stylesheets are parsed, so a <style>
	 * appended to <head> lands *before* all of them. SugarCube's rule is
	 * `html[data-init=loading] #init-loading`. A naive version of ours has
	 * identical specificity, and on a tie the later rule wins, which is
	 * SugarCube's. Adding an id to beat it works, but it depends on us noticing
	 * every rule we touch. Owning the element removes the question: #dol-loading
	 * has no competing rules anywhere in the story, so there is nothing to lose.
	 *
	 * #init-screen is deliberately left alone. It is the full-screen #111
	 * backdrop, it carries the z-index, and its `html[data-init=loading]` rules
	 * hide #passages and #ui-bar while loading. Only the spinner child goes.
	 *
	 * Keyed off html[data-init], so it covers *every* load, not just startup:
	 * SugarCube sets that attribute again on every passage transition via
	 * LoadScreen.lock().
	 *
	 * To look at it without building an APK, see .preview/build-preview.js.
	 */

	/*
	 * The <style> can go in immediately: <head> exists by the time this script
	 * runs. The DOM work below cannot.
	 */
	const loadingStyle = document.createElement("style");
	loadingStyle.id = "dol-loading-screen";
	loadingStyle.textContent = [
		"@keyframes dol-loading-sweep{0%{transform:translateX(0)}100%{transform:translateX(74px)}}",

		/*
	 * Kill the stock spinner before it can ever paint.
	 *
	 * Doing this with display:none !important rather than by removing the element
	 * is not a stylistic choice, it is the only thing that can work in time.
	 * This <style> is parsed during <head>, at roughly character 1600 of a 50 MB
	 * document. The story sets data-init="loading" at character 1772, inside its
	 * own script-libraries block, and the <div id="init-loading"> is not created
	 * until character 754783 -- so the ring becomes visible somewhere in that
	 * window. DOMContentLoaded does not fire until the entire document has been
	 * parsed, which is a second or two later on a device. Removing the element
	 * there was always going to be too late, and it showed: the circle flashed
	 * for one to two seconds and then handed over to ours.
	 *
	 * CSS, by contrast, applies to each element the instant the parser creates it.
	 * So this rule is in force before the spinner exists, and it holds for the
	 * whole window. !important is required: SugarCube's own display:block is
	 * written as html[data-init=loading] #init-loading, and it lands later in the
	 * cascade, so a plain rule of ours would lose to it on both counts.
	 *
	 * The element is still removed outright further down, once the body exists,
	 * so the rule is a guarantee rather than the mechanism.
	 */
	"#init-loading{display:none !important}",

		// Own element, so these ids collide with nothing. Shown only while the
		// story says it is loading.
		"#dol-loading{display:none;position:fixed;inset:0;z-index:500001;",
		"background:none;pointer-events:none}",
		'html[data-init="loading"] #dol-loading{display:flex;flex-direction:column;',
		"align-items:center;justify-content:center;gap:24px}",

		// A thin line sweeping left to right, echoing the #ui-bar that slides in
		// from the left when the menu opens. Monochrome on purpose: the game's UI
		// is greyscale (#111 page, #222 surfaces, #444 borders, #eee text), so
		// colour here would look like a sticker.
		// Geometry: track 132px, sweep 58px, so it travels 132 - 58 = 74px.
		"#dol-loading .dol-loading-track{position:relative;width:132px;height:2px;",
		"border-radius:1px;background:rgba(238,238,238,.16);overflow:hidden}",
		"#dol-loading .dol-loading-sweep{position:absolute;top:0;bottom:0;left:0;",
		"width:58px;border-radius:1px;background:rgba(238,238,238,.8);",
		"animation:dol-loading-sweep 1.5s cubic-bezier(.65,.05,.36,1) infinite}",

		"#dol-loading .dol-loading-label{font:500 13px/1 system-ui,-apple-system,'Segoe UI',",
		"Roboto,sans-serif;letter-spacing:.18em;text-transform:uppercase;",
		"color:rgba(238,238,238,.55)}",

		// Respect the platform setting: a moving line is exactly the sort of thing
		// someone has turned animation off to avoid. Park it mid-track rather than
		// removing it, so the screen does not just look broken.
		"@media (prefers-reduced-motion:reduce){",
		"#dol-loading .dol-loading-sweep{animation:none;transform:translateX(37px)}",
		"}",

		// The two failure states are centred and legible now that their stock
		// 28px bold type in the top quarter of the screen is gone.
		'html[data-init="lacking"] #init-screen #init-lacking,',
		'html[data-init="no-js"] #init-screen #init-no-js{',
		"position:absolute;inset:0;margin:0;top:0;height:100%;max-width:none;",
		"display:flex;flex-direction:column;align-items:center;justify-content:center;",
		"text-align:center;gap:.4em;padding:2em;",
		"font:400 16px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;",
		"color:rgba(238,238,238,.75)}",
	].join("");
	if (document.head) document.head.appendChild(loadingStyle);

	/*
	 * This script is injected into <head>, ahead of the story's own scripts, so
	 * it runs BEFORE <body> has been parsed.
	 *
	 * That bit us twice. First, document.getElementById("init-loading") returned
	 * null and document.body was null, so both the removal of the stock spinner
	 * and the insertion of ours were silently skipped, and the app shipped with
	 * the stock circle and no loader of our own. Then, once both were deferred to
	 * DOMContentLoaded, the circle still flashed for a second or two first --
	 * because DOMContentLoaded cannot fire until all 50 MB have been parsed, and
	 * the spinner is on screen long before that. The CSS rule above fixes the
	 * second problem; the loader itself still has to be built now.
	 *
	 * So: create the element immediately and attach it to
	 * document.documentElement, which is the one element guaranteed to exist at
	 * this point. It renders identically from there, because it is
	 * position:fixed -- which is what inset:0 is doing anyway, and why the
	 * unusual parent does not matter. Move it into <body> once that exists, in
	 * the same frame, so nothing shifts.
	 *
	 * Attaching outside <body> is unusual, and worth being honest about why it is
	 * safe: this is DOM insertion, not markup, so the parser never sees it and
	 * never relocates it. The only thing governing how it renders is our own
	 * position:fixed.
	 */
	const loader = document.createElement("div");
	loader.id = "dol-loading";
	loader.setAttribute("aria-hidden", "true");
	// Real elements rather than pseudo-elements, deliberately. The previous
	// version used ::before/::after for the track and the sweep, which cannot
	// nest, so both had to be absolutely positioned -- and absolutely positioned
	// elements are out of flow and ignore flex `gap`, which put the line on top
	// of the label. As children of a position:relative track, neither problem
	// exists.
	loader.innerHTML =
		'<div class="dol-loading-track"><span class="dol-loading-sweep"></span></div>' +
		'<div class="dol-loading-label">Loading&hellip;</div>';

	function attachLoader() {
		if (document.body) document.body.appendChild(loader);
		else if (loader.parentNode !== document.documentElement) {
			document.documentElement.appendChild(loader);
		}
	}

	function removeStockSpinner() {
		const stockSpinner = document.getElementById("init-loading");
		if (stockSpinner) stockSpinner.remove();
	}

		attachLoader();

	if (document.body) removeStockSpinner();
	else {
		document.addEventListener("DOMContentLoaded", function () {
			removeStockSpinner();
			attachLoader();
		});
	}

	/*
	 * Two kinds of load that never ends used to look identical: a healthy slow
	 * one and a dead one. Both meant an indefinite sweep with nothing to read.
	 *
	 * - After a few seconds, start counting. Elapsed time plus readyState tells
	 *   a slow parse apart from a document that has stopped making progress.
	 * - If the native side reports the load failed, replace the sweep with the
	 *   reason. See _reportLoadFailure in lib/src/game_web_view.dart.
	 *
	 * The countdown is not decoration. It is the only signal available on the
	 * device that separates "still working" from "never going to finish", which
	 * is precisely what was missing when a stuck Restart looked the same as a
	 * slow first run.
	 */
	const loadStartedAt = Date.now();
	const SLOW_LOAD_MS = 8000;
	let watchdog = null;

	function setLabel(text) {
		const label = loader.querySelector(".dol-loading-label");
		if (label) label.textContent = text;
	}

	function stopWatchdog() {
		if (watchdog === null) return;
		clearInterval(watchdog);
		watchdog = null;
	}

	watchdog = setInterval(function () {
		if (document.documentElement.getAttribute("data-init") !== "loading") {
			stopWatchdog();
			return;
		}

		const elapsed = Date.now() - loadStartedAt;
		if (elapsed < SLOW_LOAD_MS) return;

		setLabel(
			"still loading \u00b7 " +
				Math.round(elapsed / 1000) +
				"s \u00b7 " +
				document.readyState
		);
	}, 1000);

	// Called from Dart when the main document fails to load.
	window.__dolLoadFailed = function (detail) {
		stopWatchdog();
		// The sweep would read as "still trying", which is the one thing we now
		// know to be false. Keep the loader up so there is something to read.
		const track = loader.querySelector(".dol-loading-track");
		if (track) track.style.display = "none";
		setLabel("could not load the game \u00b7 " + detail);
	};

	/*
	 * Notches and system bars are handled in Dart, not here.
	 *
	 * The obvious approach is env(safe-area-inset-*) plus viewport-fit=cover on
	 * the viewport meta tag. It does not work for this app: Chromium derives
	 * those insets from the display cutout, so on a three-button-navigation
	 * device with no cutout they resolve to 0 and the story ends up underneath
	 * the navigation buttons. See the SafeArea in lib/src/app.dart, which has
	 * the real inset for both cases.
	 */

	/*
	 * Back button.
	 *
	 * Android never delivers the DOM 'backbutton' event, so the gesture is
	 * intercepted natively and routed back in here. The decision logic stays in
	 * the web layer because it is the only place that knows whether a dialog or
	 * overlay is open.
	 *
	 * Returns true when the event was consumed; false tells Flutter to exit.
	 * Deliberately synchronous: the answer is needed immediately, and returning
	 * a Promise here would make every caller deal with whether evaluateJavascript
	 * unwraps promises on this platform.
	 */
	let lastBackEvent = 0;
	window.__dolHandleBack = function () {
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

		const now = Date.now();
		if (now > lastBackEvent + 3500) {
			lastBackEvent = now;
			toast("Press BACK again to exit", 1);
			return true;
		}
		return false;
	};

	/*
	 * No splash handling here.
	 *
	 * There used to be: a MutationObserver on data-init, a CSS rule hiding
	 * SugarCube's #init-screen, and a gameReady call to the native side to bring
	 * a Flutter-drawn splash down. That whole arrangement is gone. The Android
	 * system splash draws the mark and hands over as soon as the engine is up,
	 * and holding a second splash over the story load meant the player sat
	 * through several seconds of dead time before seeing anything.
	 *
	 * SugarCube's own loading screen is what covers the story load now. It is
	 * restyled above rather than hidden, so the player gets the app's own mark
	 * and a label instead of a bare grey ring.
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