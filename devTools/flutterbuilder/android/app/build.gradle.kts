import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

/*
 * Release signing.
 *
 * Credentials live in android/key.properties, which is gitignored. When that
 * file is absent the release build type is still declared, just unsigned, so a
 * fresh clone stays buildable; an unsigned APK fails loudly at install time
 * rather than shipping silently unsigned.
 */
val keystorePropertiesFile = rootProject.file("key.properties")
val keystoreProperties = Properties()
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
    namespace = "com.vrelnir.dol"
    compileSdk = flutter.compileSdkVersion

    // No ndkVersion on purpose. Flutter's template pins one, which forces a
    // ~1.5 GB NDK install, but nothing here compiles native code: the engine's
    // .so files ship prebuilt in the Flutter SDK and flutter_inappwebview
    // carries prebuilt AARs. Remove this comment if a future plugin needs one.

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.vrelnir.dol"
        // 24, matching the Cordova and Capacitor builds. Deliberate: drops
        // Android 5-6 for a much simpler modern path.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Both come from pubspec.yaml, and are overridden per build by
        // --build-name / --build-code in scripts/build_app_flutter.js, which
        // reads the version out of game/01-config/sugarcubeConfig.js.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                // rootProject.file() resolves relative to android/, which is
                // where make_release_keystore.js puts the .jks. Using file()
                // here would resolve relative to android/app/ instead and this
                // exact mistake has cost a failed build before -- see MEMORY.md.
                storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String

                // Explicit, matching the Capacitor build. These are NOT the
                // defaults we want: AGP only turns v3 on when minSdk >= 28, and
                // this app's minSdk is 24, so it silently signed v2-only and
                // scripts/build_app_flutter.js then failed demanding v3.
                // v1 is dead at minSdk 24.
                enableV1Signing = false
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        debug {
            // Install alongside the official app rather than replacing it.
            //
            // The suffix is "debug", not "_debug", and the id is therefore
            // com.vrelnir.dol.debug rather than the Capacitor build's
            // com.vrelnir.dol_debug. Two reasons, both forced:
            //   - AGP renders applicationIdSuffix as `<id>.<suffix>`, so it can
            //     never produce `com.vrelnir.dol_debug`; the Capacitor build
            //     got that by string-patching applicationId instead.
            //   - a package segment may not start with an underscore, so
            //     applicationIdSuffix = "_debug" produces com.vrelnir.dol._debug
            //     and AAPT rejects it outright.
            //
            // Note this also gives the debug build its own WebView data
            // directory, so it does NOT share saves with the release build
            // despite reporting the same origin.
            applicationIdSuffix = "debug"
        }
        release {
            // Minification is off, and `isShrinkResources` has to go with it.
            //
            // `android/build.gradle.kts` disables `:app:minifyReleaseWithR8`
            // (see the long comment there for why, and for what it cost when it
            // was on while this flag was not). Resource shrinking is *driven by*
            // that R8 pass -- it consumes the pass's shrunk-resources output -- so
            // leaving it on fails the build at
            // `:app:convertShrunkResourcesToBinaryRelease` with
            // "failed opening zip".
            //
            // What it costs is very little here. `shrinkResources` trims unused
            // resources, and this app has almost none of its own: the apk is
            // ~34 MB of the Dart AOT snapshot and the game's bundled story and
            // artwork. R8 itself would save a megabyte or so against ~300 lines
            // of Kotlin.
            //
            // The real reason this is worth stating: for three weeks these flags
            // were the other way round for the R8 half, and the result was
            // release apks that compiled, signed, and shipped perfectly while
            // containing three-week-old Kotlin. `verifyKotlinIsFresh` in
            // scripts/build_app_flutter.js is the guard for that.
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}