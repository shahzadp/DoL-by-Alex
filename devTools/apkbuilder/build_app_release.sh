#!/bin/sh

# uncomment this flag to skip asking for password if the correct one is already stored in build.json
#export SKIP_PASSWORD=true

# set up the environment.
# note: append to $PATH, never replace it, or node/npm/npx stop resolving.
SDK="$PWD/androidsdk"
ANDROID_HOME="$SDK" \
ANDROID_SDK_ROOT="$SDK" \
ANDROID_SDK_PATH="$SDK" \
ANDROID_PATH="$SDK/cmdline-tools/latest/bin" \
PATH="$SDK/cmdline-tools/latest/bin:$PATH" \
BUILD_RELEASE=true \
node scripts/build_app.js
