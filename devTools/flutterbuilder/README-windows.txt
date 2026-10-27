android apk builder for primarily DoL, built with Flutter

This is the only Android shell in the repo. It replaced a Capacitor build that
lived at devTools/apkbuilder; that tree has been removed, and the top-level
MEMORY.md records what state each piece of it ended in.

# how it is put together

The game is a 50 MB single-file SugarCube story and always will be. Rewriting
16,000 passages of Twine in Dart is not a plan, so there is still a WebView --
but everything around the game is native Dart, and the line between the two
sides is drawn in one place.

See "the loading screen" below for why the loader is a widget and not injected
CSS, which is the clearest example of the rule this follows: the page owns the
game, Dart owns the app.

    lib/src/storage_origin.dart   the one thing that is easy to break
    lib/src/web_asset_server.dart serves https://localhost out of the bundle
    lib/src/game_web_view.dart    the WebView: settings, and nothing else
    lib/src/game_host.dart        the seam. all the logic, no widgets
    lib/src/game_shell.dart       the window: web view, loader, status banner
    lib/src/load_model.dart       when a loader is up, and when it is honest
    lib/src/load_overlay.dart     the loading screen
    lib/src/export_service.dart   export: validate, hand over, report
    lib/src/status.dart           the status message and its banner
    lib/src/back_navigator.dart   press BACK again to exit
    lib/src/window.dart           edge to edge, at startup and again on resume
    lib/src/palette.dart          every grey the app draws, in one file
    www/flutter_additions.js      the rest: Blob to base64, and reading the
                                  game's own state

The page keeps only what it cannot hand over -- turning a Blob into bytes, and
answering questions about SugarCube's internals that Dart has no way to know.
Everything the app decides -- what to draw, what to say, when to close -- is in
Dart, where it can be unit tested. `test/` pins those decisions, and the glue's
static invariants are checked on every build by
`scripts/prepare_flutter_assets.js`.

# dependencies

-   **Flutter 3.47.7 stable** (Dart 3.13). The version the app is pinned to;
    anything from 3.47.x should work, older will not have the AGP the generated
    gradle expects.
-   **Temurin JDK 21.** `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`.
-   **Android SDK** with platform 36, build-tools 36.0.0 and NDK 28.2.13676358.
    This repo already has one at `../androidsdk`; point Flutter at it rather than
    downloading a second copy. It was originally installed for the Capacitor
    builder at `../apkbuilder/androidsdk` and was moved rather than deleted with
    it, because `sdkmanager` crashes on this machine and re-installing all of
    that is a miserable way to discover the SDK had gone with the app code.

The NDK looks unnecessary -- nothing here compiles native code, and
`android/app/build.gradle.kts` deliberately does not set `ndkVersion`. It is
still required: AGP reports a default `ndkVersion` whether or not you set one,
and the Flutter Gradle plugin then insists on installing it during
configuration. Installing it once is cheaper than fighting that.

# one-time setup

    setup_deps.bat

That runs `flutter pub get`, assembles `assets/web/` from the compiled game, and
checks the Android SDK has everything Gradle will ask for.

If Flutter is not on PATH, add its `bin` directory (typically
`C:\dev\flutter\bin`) before running anything.

# building

    npm run apk:debug
    npm run apk:release

The apk lands in the repository's `dist/` folder. Debug builds get a `.debug`
suffix on the application id (`com.vrelnir.dol.debug`) so they install alongside
the official app instead of replacing it. Note that this also gives them a
separate WebView data directory, so the two installs do not share saves despite
reporting the same origin. That is expected.

Release builds need your own keystore:

    npm run keystore:adopt     copy the key the Capacitor build already uses
    npm run keystore:new       generate a brand new one

**Use `keystore:adopt` if you have ever shipped a Capacitor build.** Android
refuses an update signed by a different key, so a fresh key would leave every
existing install stuck on the old app with no way to move over. Vrelnir's
`dol.keystore` is deliberately unpublished, so even the Capacitor build produces
an app that cannot update over an official one.

`key.properties` and the `.jks` are gitignored. **Back both up outside this
repo.** Losing the key means you can never publish an update to an app already
installed on a device.

Before building, make sure `game/01-config/sugarcubeConfig.js` is configured
for a mobile build (`enableLinkNumberify: false`). See "Changing the build
version and type" in the top-level README. That toggle is per-build and should
not be committed.

**Do not interrupt a build.** A build killed mid-`assembleRelease` leaves a
partial copy of the 50 MB document in the asset staging directory under a hash
name, and that directory is not cleaned between builds -- so the *next* build
packages the wreckage and produces an APK a megabyte fatter than it should be,
with a completely normal log. `build_app_flutter.js` now cleans that directory
before building and asserts it afterwards, so this cannot ship, but a clean
build is still faster than a guard being right.

# apk size

A release build is **arm64-v8a only** and about **37 MB**.
`scripts/build_app_flutter.js` passes `--target-platform=android-arm64`, because
Flutter's default of arm64-v8a plus armeabi-v7a plus x86_64 ships the engine's
native libraries and a Dart snapshot per ABI. Google Play requires 64-bit, so
publishing is unaffected; what is given up is 32-bit-only phones and the x86
emulator. To get the emulator back, add `android-x64` next to `android-arm64` in
that script rather than dropping the flag - armeabi-v7a is the one with no
remaining use.

The 18,593 pngs are re-encoded as **lossless WebP** on every asset prepare,
taking the artwork from 12.32 MB to 4.82 MB. See
`scripts/convert_images_to_webp.py` for why lossless rather than lossy, and why
the files keep their `.png` names. Set `DOL_WEBP=off` to ship the original pngs,
which is the first thing to try if the artwork ever looks wrong.

# logs from a release build

`debugPrint` is compiled out of a release build. Every diagnostic written as
`debugPrint` is therefore exactly the one that never prints on the build where the
bug actually reproduces, which is the only build worth reproducing on.

`lib/src/app_log.dart` wraps `dart:developer`'s `log`, which survives release, for
anything that must be visible there:

    adb logcat -s DoLNative

It traces the whole load path (`load started`, `document delivered`, `main
document failed`) and the whole import path (`pickFile requested`,
`pickFile answered`, `pickFile threw`, `import failed in the page`). Use it
rather than `debugPrint` for any diagnostic aimed at a device.

# do not change the storage origin

Saves live in `localStorage`, which is partitioned by origin. That origin is
`kStorageOrigin` in `lib/src/storage_origin.dart` -- `https://localhost` -- and
it is also half of the on-disk identity together with the `applicationId` in
`android/app/build.gradle.kts`. Changing either silently gives every existing
player an empty save.

This is the single most dangerous thing in this project. An origin is
scheme + host + **port**, so all of these are *different* origins from
`https://localhost` and every one of them would wipe the saves:

    http://localhost             wrong scheme
    https://localhost:8080       wrong port
    https://appassets.androidplatform.net   wrong host

That rules out the usual ways of serving a local web app -- a local HTTP server,
`WebViewAssetLoader`, `loadDataWithBaseURL` on any other base. Instead
`GameWebView.shouldInterceptRequest` answers `https://localhost/*` straight out
of the asset bundle, which is the same trick Capacitor's `WebViewLocalServer`
used. That is why the app looks like it is loading from a network URL that
cannot possibly resolve.

Those values are pinned in `storage-origin.json`, and
`scripts/verify_storage_origin.js` fails the build if they drift, if the
applicationId drifts, or if anything calls `WebView.setDataDirectorySuffix`
(which moves localStorage just as effectively). If you really intend to
invalidate existing saves, re-run with `DOL_ALLOW_ORIGIN_CHANGE=1` and update
the lock file in the same commit.

    npm run verify:origin

# the checkout has to stay where it is

Gradle records every task's output directories as absolute paths, in
`android/.gradle/<version>/executionHistory/executionHistory.bin`. Move or
rename the repo and the next build recreates the directory it used to be in --
empty, silently, next to the new one. It happened here: the checkout moved from
`D:\GitHub Projects\DoL-by-Alex` to `D:\GitHub-Projects\DoL-by-Alex` and the
0.5.13.6 build rebuilt 2,300 empty directories under the old path, finished
cleanly, and produced a correct apk.

Nothing in the source tree mentions the old path, so there is nothing to grep
for. `scripts/verify_project_path.js` reads that cache instead, and throws it
away when it names a different checkout. `scripts/build_app_flutter.js` runs it
before every build; on its own it is

    npm run verify:path

If a stray tree does appear, delete it: gradle will not touch anything inside it
once the cache has been reset.

# exporting and importing saves

`www/flutter_additions.js` defines the `saveAs()` global that the game's export
code calls, and does only two things: turns the `Blob` into base64 and hands it
to a JavaScript handler. Everything else -- validating it, opening the system
save dialog (the Storage Access Framework, the same `ACTION_CREATE_DOCUMENT`
picker cordova-plugin-save-dialog and the Capacitor `SaveDialog` plugin used, so
export behaviour is unchanged), telling the player what happened, and telling
them when it did not -- is `lib/src/export_service.dart`.

That split is not tidiness. The export path failed four separate times, each
failure hiding the next, and the two worst of them were *reporting* problems:
the failure was announced through the same bridge that was most likely to be
what broke, so it went to the console and the player saw nothing at all (see
MEMORY.md trap 33). All of that reporting now happens in Dart, where it cannot
depend on the thing it is reporting about.

Import is the mirror image, and it was missing entirely. The story has two
`<input type="file">` elements -- "Load from file" in the saves overlay and in
the settings -- and a WebView has no file picker of its own, so with no host
callback the chooser was simply dropped. `MainActivity.kt` now opens
`ACTION_OPEN_DOCUMENT` and hands the chosen content uri back through
`onShowFileChooser`.

There is no first-party Flutter plugin that opens the *system* picker, which is
why the Kotlin is still here.

# the splash

**One splash, and it is the system's.** `LaunchTheme` points
`windowSplashScreenAnimatedIcon` at the app mark, so Android draws it and hands
over when the engine is up. Nothing in Flutter draws a splash on top.

There used to be a second one: a Flutter overlay held until the game dropped
`data-init`, with a CSS rule keeping SugarCube's own loading screen hidden
underneath. That was wrong twice over. Android 12+ *always* draws its splash
icon, so the mark was shown twice, once small and circular from the system and
once large from Flutter: the "two splash screens" problem. And holding the second
one for the whole story load meant several seconds of dead time before the player
saw anything.

The mark is defined once, in `drawable/ic_dol_mark.xml`, with
`ic_launcher_foreground.xml` for the launcher icon. `launch_background.xml`
composes the same mark into the window background for Android 11 and below.
`assets/icon-only.svg` remains the source of truth; it was carried over from the
Capacitor tree when that was removed.

`NormalTheme`'s window background is flat `#111111` rather than the marked
drawable, deliberately: it shows for the instant between the system splash
handing over and Flutter's first frame, and keeping a second mark alive there
would reintroduce the same problem. Same colour, so it is not visible.

**SugarCube's own loading screen is replaced, not hidden.** With the overlay
gone, the few seconds while the 50 MB story is delivered and parsed are covered
by a Flutter-drawn loader (see below).

`transparentBackground: true` on the WebView matters for this handover: a WebView
is opaque white before it has content, so without it there is a white flash on an
otherwise dark screen while the story is still arriving.

## the loading screen

Once the system splash hands over, the few seconds while a 50 MB story is
delivered and parsed show a loader. It is a **Flutter widget**,
`lib/src/load_overlay.dart`, and it is drawn over the WebView rather than into
the page.

It used to be a `<div>` injected into the story and animated with CSS, which was
never a small thing to be a web view. It had to be injected at character ~1600 of
a 50 MB document to land ahead of all 55 story stylesheets, it had to create its
element before `<body>` existed, and it took three attempts plus a parse-time CSS
race to stop SugarCube's own spinner flashing through the gap (MEMORY.md traps
26-30). Drawing it in Flutter removes that entire class of problem: there is no
DOM to create, no specificity to win and no parse race, because the widget
exists from the very first frame.

The visuals are unchanged on purpose -- same geometry, same greys, same label --
so it is the screen that was already approved, only native. SugarCube's own is a
100px ring with a 24px `#7f7f7f` border, one rotation per two seconds, offset to
`top:25%` so it is not even centred, with the "Loading..." text hidden behind
`text-indent:9999em`. Monochrome on purpose, because the game's UI is greyscale.
An earlier version used the four-colour app icon and was rejected as not
belonging to the design language; `lib/src/palette.dart` holds every grey.

Things to know before editing it:

- **The page tells Dart when it is busy, and Dart draws the pixels.** A
  `MutationObserver` on `html[data-init]` reports through the `DoLNative.loadState`
  handler. That is the same attribute the in-page loader keyed on, and it is the
  only signal that covers *every* load: SugarCube re-arms `data-init` on each
  passage transition via `LoadScreen.lock()`, and no WebView callback fires for
  any of those. `onLoadStop` is a backstop for the startup case, not the mechanism.
- **`#init-loading` is still hidden by one line of CSS.**
  `#init-loading{display:none !important}` has to be in force *before* the
  element exists, and CSS is the only thing that can be. Character offsets in the
  story: our script at ~1600, `data-init="loading"` set at 1772, `<body>` at
  754537, `<div id="init-loading">` at 754783. So the ring would otherwise be on
  screen long before `DOMContentLoaded`, which cannot fire until all 50 MB have
  been parsed. `!important` is required: SugarCube's own `display:block` is
  written later in the cascade. This is now the *only* rule the glue carries, and
  `scripts/prepare_flutter_assets.js` fails the build if it goes missing.
- **Do not put the loader back into the page.** `prepare_flutter_assets.js`
  fails the build if the glue mentions `dol-loading`, for the reason above.
- **A short load is torn down instantly.** A passage transition is tens of
  milliseconds, and the page already goes full-bleed `#111` for it, so a
  260ms fade would be 260ms of added latency on every link the player taps. Only
  a load the player actually watched gets the animation.
- **A failure is a screen with a Retry button**, not an indefinite sweep. The
  reason is shown, and Retry re-delivers the document.
- **A load that runs for 90 seconds is declared stuck.** `LoadModel.stuckThreshold`
  fires from `tick()`, which only runs while the loader is on screen, so the
  screen itself is the watchdog. A healthy first run is about three seconds; 90 is
  not a performance budget, it is the point past which an indefinite sweep is
  worse than a stop. This exists because a stalled load was reported from a
  device as "still loading, five minutes" and the original cause was never pinned
  — which is exactly why the screen must never be able to run forever.
- **The screen says how far the load got, not just that it failed.**
  `LoadModel.trail` records every step — web view created, load started, asked
  for the document, the document arrived, the page says X — and the failure
  screen lists them. Four different bugs look identical without it: never
  navigated, navigated and never answered, everything arrived and the glue is
  silent, or genuinely still parsing. The slow-load headline carries the current
  step too, so the 90 seconds are at least informative rather than a counter.
  It is on screen, not just in `adb logcat`, because a diagnostic only the
  developer can read is not a diagnostic.
- **The overlay is outside the `SafeArea`.** It has to be full bleed, or the
  system bars sit on two shades of the same grey for the few seconds it is up.
  The status banner is inside one, because it must not hide under the navigation
  bar -- which is exactly where the in-page `<div>` it replaces used to live.
- `IgnorePointer`, so a loader can never swallow a tap meant for the game. The
  failure screen is the exception and has to be spelled out in the code: its
  Retry button is the only way out of it, and the blanket version makes that a
  dead button on the one screen the player cannot leave any other way.
- `prefers-reduced-motion: reduce` parks the sweep mid-track rather than
  removing it, so the screen does not just look broken. Read through
  `MediaQuery.disableAnimationsOf`.

There is no browser preview harness any more, and that is deliberate: the thing
`.preview/build-preview.js` existed to preview was a DOM, and there is no DOM.
The static properties of the injected glue are checked on every build by
`scripts/prepare_flutter_assets.js` instead, and the loader's behaviour is
pinned by `test/load_model_test.dart` and, for what the player actually reads,
  by `test/load_overlay_test.dart`. That second one earns its keep: it caught two
  bugs that would have shipped -- the loader's own `build` deciding visibility
  outside the `AnimatedBuilder` that listens for it (so it appeared at startup
  and then never again), and `IgnorePointer` making the Retry button dead.

# notches and system bars

The app is edge to edge (`SystemUiMode.edgeToEdge` plus
`android:windowLayoutInDisplayCutoutMode="shortEdges"`). That is what fixes the
story's proportions: laying the window out *inside* the system bars, which was
the default, gives the WebView a box smaller than the screen.

Being edge to edge then means content has to be pushed back out of the cutouts,
which `SafeArea` in `lib/src/game_shell.dart` does. The strip left over is the
same `#111` as the story's background, so it reads as more game rather than a
black bar.

The WebView itself never learns about any of this: `WindowChrome` applies it, and
re-applies it on resume, because on Android 15 the system draws edge to edge
whatever it is told but an activity returning from the background can come back
with a navigation bar scrim it did not have before.

**Do not "fix" this with `env(safe-area-inset-*)` in the page.** It is the
obvious approach and it does not work here: Chromium derives those insets from
the display cutout, so on a three-button-navigation device with no cutout they
resolve to 0 and the story ends up underneath the navigation buttons. Flutter
has the real inset for both cases.

# the load path cannot stall

Two rules, both learned the hard way from a device that reported "still loading,
five minutes":

1. **`shouldInterceptRequest` must always have an answer.** `GameHost.intercept`
   serves `https://localhost/<path>` out of the Flutter asset bundle. If its
   Future completes with an *error*, the plugin has nothing to send: the request
   goes unanswered, Chromium waits forever, `onLoadStop` never fires and the
   loading bar means nothing. `WebAssetServer.load` is therefore **total** —
   catch-all plus a 20s `loadTimeout` — and `intercept` wraps it again and
   answers a 404 whatever happens. `lastError` is logged at `onLoadStop`.
2. **The loading screen has a stopping state.** `LoadModel.stuckThreshold` is
   90s. See the loading-screen section above.

# missing assets

The story references a few paths that were never in the repo (for example
`/fonts/Roschild.ttf`). The interceptor answers those with a real 404 rather
than returning null, because null means "not intercepted" and would send the
WebView off to a host that does not exist. Broken image icons are expected and
match what the Capacitor build did.

**Where the glue actually is.** `prepare_flutter_assets.js` injects a
`<script src="flutter_additions.js">` tag at the first `<script>` in the 50 MB
document; it does not inline the code. So `assets/web/` holds `index.html` (with
the tag), `flutter_additions.js` (~19 KB, all of our code) and `img/`. Searching
the packaged `index.html` for a function name finds nothing and means nothing --
look in `flutter_additions.js`. The build-time guards read the source glue in
`www/`, which is the thing to check when one of them fires.