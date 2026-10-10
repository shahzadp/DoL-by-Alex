#!/bin/sh
set -e

SDK="$PWD/androidsdk"

# make sure sdkmanager is installed first
if [ ! -e "$SDK/cmdline-tools/latest/bin/sdkmanager" ]; then
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

# install sdk tools
yes | sdkmanager --licenses
sdkmanager "build-tools;32.0.0"
sdkmanager "platforms;android-32"

echo "All Done!"
