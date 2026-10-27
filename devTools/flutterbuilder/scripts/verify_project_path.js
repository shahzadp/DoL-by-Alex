/**
 * Refuse to build from a checkout that Gradle still remembers at another path.
 *
 * `android/.gradle/<version>/executionHistory/executionHistory.bin` stores every
 * task's output directories as *absolute* paths. Move the repo and the next
 * build replays those paths, recreating the old directory tree next to the new
 * one -- empty, silently, with a perfectly good apk at the end of it.
 *
 * That is not hypothetical: this repo lived at `D:\GitHub Projects\DoL-by-Alex`
 * until it moved to `D:\GitHub-Projects\DoL-by-Alex`. The 0.5.13.6 release build
 * resurrected the old folder, 2,300 empty directories deep, and nothing in the
 * source tree mentions the old path -- only this cache does, which is why it is
 * worth a guard rather than a paragraph in MEMORY.md.
 *
 * The cache is disposable, so the fix is to delete it and let Gradle rebuild it
 * against the current root. Gradle re-runs the tasks either way here.
 */
const fs = require('fs');
const path = require('path');

// scripts/ -> devTools/flutterbuilder
const builderRoot = path.resolve(__dirname, '..');
const androidRoot = path.resolve(builderRoot, 'android');
const gameRoot = path.resolve(builderRoot, '..', '..');

// the leaf directory name this repo has always had, whichever parent it sat in.
// Matched with its real casing: the cache repeats whatever the path was when it
// was written, and a byte-level case-insensitive search over a binary file is
// more trouble than it is worth.
const LEAF = path.basename(gameRoot);

/**
 * Paths recorded in the gradle cache that are not where the checkout is now.
 *
 * Entries are stored as raw bytes, not UTF-16, so reading the file as latin1
 * yields the path text intact and cannot throw on the binary framing.
 */
function staleProjectRoots() {
	const cache = path.resolve(androidRoot, '.gradle');
	if (!fs.existsSync(cache)) return [];

	const roots = new Set();
	for (const entry of fs.readdirSync(cache, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const history = path.resolve(cache, entry.name, 'executionHistory', 'executionHistory.bin');
		if (!fs.existsSync(history)) continue;

		const text = fs.readFileSync(history, 'latin1');
		for (let i = text.indexOf(LEAF); i !== -1; i = text.indexOf(LEAF, i + 1)) {
			// step back to the drive prefix of the path this mention sits in
			const head = text.slice(Math.max(0, i - 200), i);
			const prefixes = [...head.matchAll(/[A-Za-z]:\\/g)];
			if (prefixes.length === 0) continue;
			const candidate = (head.slice(prefixes[prefixes.length - 1].index) + LEAF).toLowerCase();
			// control bytes mean the walk back landed in the framing, not a path
			if (/[\u0000-\u001f]/.test(candidate)) continue;
			roots.add(candidate);
		}
	}
	return [...roots].filter((r) => r !== gameRoot.toLowerCase());
}

function forgetStaleProjectCache() {
	const stale = staleProjectRoots();
	if (stale.length === 0) return;

	fs.rmSync(path.resolve(androidRoot, '.gradle'), { recursive: true, force: true });
	console.log(
		'gradle cache belongs to a different checkout, so it has been discarded:\n' +
			stale.map((s) => `  stale   ${s}\n`).join('') +
			`  current ${gameRoot.toLowerCase()}\n` +
			'Left in place, gradle recreates empty build directories at the old path.'
	);
}

module.exports = forgetStaleProjectCache;

if (require.main === module) forgetStaleProjectCache();
