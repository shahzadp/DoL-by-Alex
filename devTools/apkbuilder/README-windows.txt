android apk builder for primarily DoL

# dependencies

-   **nodejs 22 or newer.** The Capacitor CLI requires it.
-   **Temurin JDK 21.** Capacitor 8 compiles against Java 21. 17 fails with
    `invalid source release: 21`.
-   **Android commandline-tools.** Unzip it so that `bin/`, `lib/` and
    `source.properties` land directly in `androidsdk/cmdline-tools/latest`
    (there should be no other sub-folders).

**Gradle is not needed.** Capacitor ships a Gradle wrapper in `android/`, so
the wrapper is used directly.

# one-time setup

    setup_deps.bat

That installs the node packages, assembles `capwww/` from the compiled game,
syncs it into the native project, and installs the Android platform and build
tools for SDK 36.

# building

    npm run apk:debug
    npm run apk:release

The apk lands in the repository's `dist/` folder. Debug builds get a `_debug`
suffix on the application id, so they install alongside the official app instead
of replacing it.

Release builds need your own keystore. Vrelnir's `dol.keystore` is deliberately
unpublished, so an unofficial key produces an app that cannot be upgraded over
an already-installed official one.

Before building, make sure `game/01-config/sugarcubeConfig.js` is configured
for a mobile build (`enableLinkNumberify: false`). See "Changing the build
version and type" in the top-level README. That toggle is per-build and should
not be committed.

# do not change the storage origin

Saves live in `localStorage`, which is partitioned by origin. That origin is
`server.hostname` + `server.androidScheme` in `capacitor.config.json`, so
changing either one silently gives every existing player an empty save.

Those values are pinned in `storage-origin.json`, and
`scripts/verify_storage_origin.js` fails the build if they drift. If you really
intend to invalidate existing saves, re-run with `DOL_ALLOW_ORIGIN_CHANGE=1`
and update the lock file in the same commit.

    npm run verify:origin

# exporting saves

`www/capacitor_additions.js` defines the `saveAs()` global that the game's
export code calls. It uses `SaveDialog`, a local Capacitor plugin at
`android/app/src/main/java/io/github/amphiluke/SaveDialog.java`, which opens the
system save dialog. There is no official Capacitor plugin for that, hence the
local one.