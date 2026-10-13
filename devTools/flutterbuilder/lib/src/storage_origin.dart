// DO NOT CHANGE THESE VALUES. See storage-origin.json and the "Storage origin"
// section of README-windows.txt.
//
// Saves live in `localStorage`, which is partitioned by origin. The origin the
// game runs under is therefore the on-disk identity of every player's save.
// The Capacitor build pinned `https://localhost`; this Flutter build has to
// serve the game from exactly the same origin or the old data is orphaned:
// still on disk, never read again, with no error and no way back.
//
// An origin is scheme + host + port. `http://localhost`, `https://localhost:8080`
// and `https://appassets.androidplatform.net` are all *different* origins from
// `https://localhost` even though they look interchangeable, so none of the
// usual shortcuts for "serve a local web app" work here.
//
// `scripts/verify_storage_origin.js` reads these constants and fails the build
// if they drift from storage-origin.json.

/// Origin scheme. Must stay `https` -- `http` is a different origin.
const String kStorageOriginScheme = 'https';

/// Origin host. Must stay `localhost` with the implicit https port (443).
const String kStorageOriginHost = 'localhost';

/// Origin port. Implicit (443) for https, but named explicitly because
/// `Uri.port` reports it and the origin check in WebAssetServer compares it.
/// https://localhost:8443 is a different origin from https://localhost.
const int kStorageOriginPort = 443;

/// The full origin, which is also the URL the WebView loads.
const String kStorageOrigin = '$kStorageOriginScheme://$kStorageOriginHost';

/// Application id. The other half of the on-disk identity: WebView data lives
/// in an app-private directory keyed by package, so changing this installs a
/// different app and leaves the old one (and its saves) behind.
const String kAppId = 'com.vrelnir.dol';

/// Package used for debug builds, so a debug APK installs *alongside* the
/// official app instead of replacing it. Its WebView data directory is also
/// separate, so the two installs do not share saves even though the origin is
/// identical. That is expected -- see MEMORY.md.
///
/// Note this is a gradle build-type suffix, so the real id is
/// `com.vrelnir.dol.debug`. See android/app/build.gradle.kts for why it cannot
/// be the Capacitor build's `com.vrelnir.dol_debug`.
const String kDebugAppIdSuffix = 'debug';