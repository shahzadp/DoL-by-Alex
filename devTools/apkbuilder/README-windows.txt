android apk builder for primarily DoL

Two build paths live here. Capacitor is the current one; Cordova is the
previous one and still builds, so it is kept as a fallback until the Capacitor
build has proven itself in the wild.

# Capacitor (current)

## dependencies
- nodejs 22 or newer (the Capacitor CLI requires it)
- Temurin JDK **21** (Capacitor 8 compiles against Java 21; 17 will fail with
  "invalid source release: 21")
- android commandline-tools, extracted into `androidsdk\cmdline-tools\latest`
  so that `bin\sdkmanager` and `android.exe` are present

You do NOT need to install Gradle. Capacitor ships a Gradle wrapper in
`android\`, so `gradlew.bat` is used directly. (The legacy Cordova path below
does need a separate Gradle install.)

## one-time setup
    npm install
    npm run cap:sync

`cap:sync` assembles `capwww\` from the compiled game and copies it into the
native project.

## building
    npm run apk:debug
    npm run apk:release

The finished apk lands in the repository's `dist\` folder. Debug builds get a
`_debug` suffix on the application id, so they install alongside the official
app instead of replacing it.

Release builds need your own keystore. Configure it under
`android.buildOptions` in `capacitor.config.json`, or pass the usual gradle
signing properties. Vrelnir's `dol.keystore` is deliberately not published, so
an unofficial key produces an app that cannot be upgraded over an installed
official one.

## do not change the storage origin
Saves live in `localStorage`, which is partitioned by origin. That origin is
`server.hostname` + `server.androidScheme` in `capacitor.config.json`, so
changing either one silently gives every existing player an empty save.

The values are pinned in `storage-origin.json` and `scripts\verify_storage_origin.js`
fails the build if they drift. If you truly intend to invalidate existing saves,
re-run with `DOL_ALLOW_ORIGIN_CHANGE=1` and update the lock file in the same
commit.

Run the check on its own with:

    npm run verify:origin

# Cordova (legacy)

Kept working while the Capacitor build is being validated.

## dependencies
- nodejs (any recent LTS)
- Temurin JDK **17**
- android commandline-tools, same location as above
- Gradle 7.4.2, extracted into `androidsdk\gradle` so that
  `androidsdk\gradle\bin\gradle.bat` exists. a stock `gradle-7.4.2-bin.zip`
  unpacks as `gradle-7.4.2\`, so rename it after extracting.

## one-time setup
    setup_deps.bat

## building
    build_app_debug.bat
    build_app_release.bat

(note: the old version of this file wrongly said to run `build_app_debug.bat`
for release builds. it is `build_app_release.bat`.)

Both paths need `game/01-config/sugarcubeConfig.js` set up for a mobile build,
which means `enableLinkNumberify: false`. See "Changing the build version and
type" in the top-level README. Do not commit that change; it should be toggled
per build, not left set globally.