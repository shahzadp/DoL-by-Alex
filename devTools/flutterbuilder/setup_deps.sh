#!/usr/bin/env bash
#
# One-time setup for the Flutter android builder.
set -euo pipefail

cd "$(dirname "$0")"

# This builder uses the repo's Android SDK at devTools/androidsdk, which
# outlived the Capacitor builder that originally installed it. Point ANDROID_HOME
# elsewhere if you keep it somewhere else; the ANDROID_* vars must agree with
# what Flutter resolves.
export ANDROID_HOME="${ANDROID_HOME:-$(cd ../androidsdk && pwd)}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export ANDROID_SDK_PATH="$ANDROID_HOME"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

command -v flutter >/dev/null 2>&1 || {
	echo "flutter not found on PATH. Install Flutter 3.47.7 stable, or add its" >&2
	echo "bin directory to PATH, then run setup_deps.sh again." >&2
	echo "See README-linux." >&2
	exit 1
}

command -v java >/dev/null 2>&1 || {
	echo "java not found on PATH. JDK 21 is required." >&2
	exit 1
}

# The android CLI returns a bogus exit code even on success (and sdkmanager
# itself crashes outright with 0xC0000409 in cmdline-tools 23), so every step is
# verified on disk instead of trusted on exit status. See MEMORY.md trap 7.

echo "Installing packages"
android sdk install "platforms;android-36"
[ -d "$ANDROID_HOME/platforms/android-36" ] || { echo "platform 36 missing" >&2; exit 1; }

android sdk install "build-tools;36.0.0"
[ -d "$ANDROID_HOME/build-tools/36.0.0" ] || { echo "build-tools 36.0.0 missing" >&2; exit 1; }

# Flutter insists on the NDK at configure time even though nothing here compiles
# native code: AGP reports a default ndkVersion whether or not the build sets
# one. See README-linux.
android sdk install "ndk;28.2.13676358"
[ -f "$ANDROID_HOME/ndk/28.2.13676358/source.properties" ] || { echo "NDK missing" >&2; exit 1; }

echo "Resolving dart dependencies"
flutter pub get

# assemble assets/web/ from the compiled game; fails fast if the storage origin
# has drifted, which would silently wipe every player's saves.
echo "Assembling game assets"
node scripts/prepare_flutter_assets.js

echo "All Done!"