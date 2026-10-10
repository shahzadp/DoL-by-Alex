#!/bin/sh
set -e

SDK="$PWD/androidsdk"

# make sure the android CLI is installed first
if [ ! -e "$SDK/cmdline-tools/latest/bin/android" ] && [ ! -e "$SDK/cmdline-tools/latest/bin/android.exe" ]; then
	echo "cmdline tools not found, follow the steps from README-linux first!"
	exit 1
fi

# set up sdk variables.
# note: append to $PATH, never replace it, or node/npm/npx stop resolving.
ANDROID_HOME="$SDK"
ANDROID_SDK_ROOT="$SDK"
ANDROID_SDK_PATH="$SDK"
ANDROID_PATH="$SDK/cmdline-tools/latest/bin"
PATH="$ANDROID_PATH:$PATH"
export ANDROID_HOME ANDROID_SDK_ROOT ANDROID_SDK_PATH ANDROID_PATH PATH

# install cordova
npm i
npx cordova telemetry off
npx cordova prepare

# install sdk tools.
# cmdline-tools 23 deprecates sdkmanager in favour of the "android" CLI, which
# also writes licenses/ itself, so there is no separate license step.
# The CLI returns a bogus exit code even on success, so we verify the result on
# disk instead of trusting the exit status (which would trip "set -e").
android sdk install "platforms;android-32"
[ -d "$SDK/platforms/android-32" ] || { echo "failed to install platforms;android-32"; exit 1; }
android sdk install "build-tools;32.0.0"
[ -d "$SDK/build-tools/32.0.0" ] || { echo "failed to install build-tools;32.0.0"; exit 1; }

echo "All Done!"
