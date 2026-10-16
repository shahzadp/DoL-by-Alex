import 'dart:developer' as developer;

/// Logging that survives a release build.
///
/// `debugPrint` is compiled out of release, which makes it useless for the one
/// job logcat tracing is for here: "Load from file" failed twice on a release
/// build and printed nothing on either run, because every diagnostic in the app
/// was `debugPrint`. `developer.log` writes to logcat in every build mode, so
/// `adb logcat -s DoLNative` is actually a usable diagnostic for the first time.
///
/// Use this for the paths that fail silently. `debugPrint` is still fine for
/// ordinary development noise.
void appLog(String tag, String message) {
  developer.log(message, name: tag, level: 800);
}