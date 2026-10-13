// Render the loading screen exactly as the app will, without building an APK.
//
// Three things this must get right, all learned the hard way:
//
//  1. ORDER. flutter_additions.js runs at character ~1600 of the story, so the
//     <style> it appends lands *before* all 55 story stylesheets. Put ours last
//     here instead and a naive selector wins -- which is how a broken loader got
//     verified as working.
//
//  2. THE REAL SCRIPT. It has to actually run, not just have its CSS copied
//     out, because the fix is a DOM operation: it removes the stock spinner and
//     creates ours. A harness that only re-applied the CSS was testing a
//     different program than the one that ships.
//
//  3. THE REAL TIMING. The story sets data-init="loading" at character 1772,
//     inside script-libraries. The spinner markup is not created until character
//     754783. DOMContentLoaded cannot fire until the whole 50 MB is parsed. So
//     there is a second or two in which the ring is on screen and our removal
//     is still queued. That gap is why the spinner flashed before handing over,
//     and a harness that only checks the settled state cannot see it.
//
// So the page below reproduces that order, and a probe script records what the
// loader looks like *at that moment* -- before <body> exists -- which is the
// state the device actually spends the flash window in.
const fs = require('fs');
const path = require('path');

const gameHtml = fs.readFileSync('../../../Degrees of Lewdity.html', 'utf-8');

const cssStart = gameHtml.indexOf('<style id="style-init-screen"');
const initCss = gameHtml.slice(cssStart, gameHtml.indexOf('</style>', cssStart) + 8);

const mStart = gameHtml.indexOf('<div id="init-screen">');
const initMarkup = gameHtml.slice(mStart, gameHtml.indexOf('<!-- UUID', mStart)).trimEnd();

const glue = fs.readFileSync(path.resolve('../www/flutter_additions.js'), 'utf-8');

// Static checks, so a regression here fails loudly instead of on a device.
const arrStart = glue.indexOf('loadingStyle.textContent = [');
const arrEnd = glue.indexOf('].join("");', arrStart);
if (arrStart < 0) throw new Error('cannot find the loading stylesheet');

const overrideCss = eval(glue.slice(arrStart + 'loadingStyle.textContent = '.length, arrEnd + 1)).join('');

// The stock spinner is removed from the DOM, so styling it would be dead code
// beyond the one rule that exists purely to beat the parse-time flash.
if (!/#init-loading\{display:none !important\}/.test(overrideCss)) {
	console.error('ERROR: no parse-time hide for #init-loading. The circle will flash before handover.');
	process.exit(1);
}
if (!/#dol-loading/.test(overrideCss)) {
	console.error('ERROR: the override does not style #dol-loading.');
	process.exit(1);
}

const out = `<!doctype html>
<html data-init="no-js">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-eval' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:">
<script>
${glue}
</script>
<script>
// Stands in for the story's script-libraries, which flips data-init from the
// static "no-js" to "loading" at character 1772 -- before <body> exists. Do the
// same, then measure. This is the exact state the device spends its flash
// window in: the ring is created later, and our DOM removal has not run yet.
document.documentElement.setAttribute('data-init', 'loading');

window.__probe = (function () {
	const loader = document.getElementById('dol-loading');
	const rect = loader ? loader.getBoundingClientRect() : null;
	const track = document.querySelector('.dol-loading-track');
	return {
		dataInit: document.documentElement.getAttribute('data-init'),
		bodyExists: !!document.body,
		loaderParent: loader ? (loader.parentNode.nodeName + (loader.parentNode === document.documentElement ? ' (documentElement)' : '')) : null,
		loaderDisplay: loader ? getComputedStyle(loader).display : null,
		loaderRect: rect ? { w: Math.round(rect.width), h: Math.round(rect.height) } : null,
		trackWidth: track ? getComputedStyle(track).width : null
	};
})();
</script>
${initCss}
</head>
<body style="margin:0;background:#111">
${initMarkup}
</body>
</html>`;

const dest = 'C:/Users/Sikander Pc/AppData/Local/Temp/opencode/loadingscreen.html';
fs.writeFileSync(dest, out, 'utf-8');
console.log('wrote', dest);