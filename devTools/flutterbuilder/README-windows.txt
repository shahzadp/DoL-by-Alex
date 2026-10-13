android apk builder for primarily DoL, built with Flutter

This is the only Android shell in the repo. It replaced a Capacitor build that
lived at devTools/apkbuilder; that tree has been removed, and the top-level
MEMORY.md records what state each piece of it ended in.

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

# apk size

A release build is about **68.8 MB**, against 26.4 MB for the Capacitor one.
That is ABIs, not the game: Flutter ships its engine's native libraries for
arm64-v8a, armeabi-v7a and x86_64, while the Capacitor shell had no per-ABI
engine payload. The game itself (50.5 MB of HTML plus 13.3 MB of images) is
byte-identical to what the Capacitor build shipped.

If size matters more than device coverage, add `--target-platform android-arm64`
to the `flutter build apk` invocation in `scripts/build_app_flutter.js`. That
roughly halves the apk and costs 32-bit ARM and emulator support.

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

# exporting saves

`www/flutter_additions.js` defines the `saveAs()` global that the game's export
code calls. It rides over a JavaScript handler into `MainActivity.kt`, which
opens the system save dialog (the Storage Access Framework) -- the same
`ACTION_CREATE_DOCUMENT` picker that cordova-plugin-save-dialog and the
Capacitor `SaveDialog` plugin used, so export behaviour is unchanged.

There is no first-party Flutter plugin that opens the *system* picker, which is
why the ~60 lines of Kotlin are still here.

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

**SugarCube's own loading screen is no longer suppressed.** With the overlay
gone, the few seconds while the 50 MB story is delivered and parsed now show
the game's own loading indicator, restyled (see below) rather than hidden.

`transparentBackground: true` on the WebView matters for this handover: a WebView
is opaque white before it has content, so without it there is a white flash on an
otherwise dark screen while the story is still arriving.

## the loading screen

Once the system splash hands over, the few seconds while a 50 MB story is
delivered and parsed show a loader. It is **ours**, not a restyle of SugarCube's.

SugarCube's is a 100px ring with a 24px `#7f7f7f` border, one rotation per two
seconds, offset to `top:25%` so it is not even centred, with the "Loading…" text
hidden behind `text-indent:9999em`. `www/flutter_additions.js` therefore does
not restyle it — it **removes it** and appends its own `#dol-loading`: a thin
line sweeping left to right, echoing the `#ui-bar` that slides in from the left
when the menu opens, with the label restored. Monochrome on purpose, because the
game's UI is greyscale (`#111` page, `#222` surfaces, `#444` borders, `#eee`
text). An earlier version used the four-colour app icon and was rejected as not
belonging to the design language.

Deleting the element rather than overriding it is deliberate. Two attempts at
overriding shipped broken: CSS injected from a script in `<head>` lands *before*
the story's 55 stylesheets, so a selector of equal specificity loses to the later
SugarCube rule, and the ring survived. Owning the element removes the question —
`#dol-loading` has no competing rules anywhere in the story.

Things to know before editing it:

- **`#init-loading` is hidden by CSS, not only deleted.** `#init-loading{display:none !important}`
  has to be in force *before* the element exists. Character offsets in the story:
  our script at ~1600, `data-init="loading"` set at 1772, `<body>` at 754537,
  `<div id="init-loading">` at 754783. So the ring is on screen long before
  `DOMContentLoaded`, which cannot fire until all 50 MB have been parsed — that
  was a 1–2s flash of the circle before handover. CSS applies the instant the
  parser creates the element, so this rule covers the whole gap. `!important` is
  required: SugarCube's own `display:block` is written later in the cascade. The
  element is still removed once the body exists; the rule is the guarantee, the
  removal is the mechanism.
- **The loader is attached to `document.documentElement` first**, because `<body>`
  does not exist yet and that element is the only one guaranteed to. It renders
  identically — `position:fixed` with `inset:0`, which is why the odd parent does
  not matter — and it is moved into `<body>` at `DOMContentLoaded`, in the same
  frame, so nothing shifts. Safe because it is DOM insertion rather than markup,
  so the parser never sees or relocates it.
- **`#init-loading` is referenced by CSS only.** `LoadScreen.init()` removes just
  `#init-no-js` and `#init-lacking`, and the loading state lives entirely on the
  `html[data-init]` attribute. So deleting the element is safe, and with it gone
  the ring cannot be drawn at any size, in any rotation, under any cascade.
- **Leave `#init-screen` alone.** It is the full-screen `#111` backdrop, it
  carries the z-index, and its `html[data-init=loading]` rules hide `#passages`
  and `#ui-bar` while loading. Only the spinner child goes.
- Keyed off `html[data-init="loading"]`, so it shows for **every** load, not just
  startup: SugarCube re-arms the attribute on each passage transition via
  `LoadScreen.lock()`.
- The track and sweep are real elements, not pseudo-elements. `::after` cannot
  nest inside `::before`, and absolutely positioned pseudo-elements are out of
  flow and ignore flex `gap`, which put the line on top of the label. As
  children of a `position:relative` track, neither problem exists.
- `pointer-events: none`, so it can never swallow a tap meant for the game.
- `prefers-reduced-motion: reduce` parks the sweep mid-track rather than
  removing it, so the screen does not just look broken.

To look at any of this without building and installing an APK, run
`.preview/build-preview.js`. It reproduces the real injection order *and* the real
timing — including setting `data-init="loading"` before `<body>` exists — and it
runs the actual script. It fails the build if the parse-time hide or the
`#dol-loading` styling is missing.

# notches and system bars

The app is edge to edge (`SystemUiMode.edgeToEdge` plus
`android:windowLayoutInDisplayCutoutMode="shortEdges"`). That is what fixes the
story's proportions: laying the window out *inside* the system bars, which was
the default, gives the WebView a box smaller than the screen.

Being edge to edge then means content has to be pushed back out of the cutouts,
which `SafeArea` in `lib/src/app.dart` does. The strip left over is the same
`#111` as the story's background, so it reads as more game rather than a black
bar.

**Do not "fix" this with `env(safe-area-inset-*)` in the page.** It is the
obvious approach and it does not work here: Chromium derives those insets from
the display cutout, so on a three-button-navigation device with no cutout they
resolve to 0 and the story ends up underneath the navigation buttons. Flutter
has the real inset for both cases.

# missing assets

The story references a few paths that were never in the repo (for example
`/fonts/Roschild.ttf`). The interceptor answers those with a real 404 rather
than returning null, because null means "not intercepted" and would send the
WebView off to a host that does not exist. Broken image icons are expected and
match what the Capacitor build did.