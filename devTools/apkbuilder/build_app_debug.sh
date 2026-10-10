#!/bin/sh

# set up the environment.
# note: append to $PATH, never replace it, or node/npm/npx stop resolving.
SDK="$PWD/androidsdk"
ANDROID_HOME="$SDK" \
ANDROID_SDK_ROOT="$SDK" \
ANDROID_SDK_PATH="$SDK" \
ANDROID_PATH="$SDK/cmdline-tools/latest/bin" \
PATH="$SDK/cmdline-tools/latest/bin:$PATH" \
node scripts/build_app.js
