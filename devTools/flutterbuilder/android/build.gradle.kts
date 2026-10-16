import com.android.build.api.dsl.LibraryExtension

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

/*
 * Library modules must not self-minify. `:app` decides for itself, in
 * android/app/build.gradle.kts.
 *
 * WHY THIS IS HERE AT ALL
 *
 * flutter_inappwebview_android sets `minifyEnabled true` on its own release
 * build, so `:flutter_inappwebview_android:minifyReleaseWithR8` runs R8 over the
 * plugin. Under AGP 9 that pass is not given android.jar, so it reports 182
 * missing classes -- android.app.Activity, android.annotation.SuppressLint and so
 * on -- and fails the build. There is nothing to gain from it either way: a
 * library ships classes to its consumer, which runs its own R8 over the combined
 * program, so shrinking inside the AAR is duplicated work at best.
 *
 * **Do not "fix" this by disabling the task.**
 *
 * That was the previous version of this file, and it cost days of chasing the
 * wrong thing:
 *
 *     subprojects {
 *         tasks.matching { it.name == "minifyReleaseWithR8" }.configureEach {
 *             enabled = false
 *         }
 *     }
 *
 * For a *library*, `minifyReleaseWithR8` is the task that produces the AAR's
 * classes.jar. Disabling it does not skip shrinking -- it produces an EMPTY jar.
 * Measured rather than theorised: the plugin's release AAR had a 22-byte
 * classes.jar against 637,132 for debug, and the whole release AAR was 5,767
 * bytes against 574,977.
 *
 * So the plugin contributed zero classes to every release APK, and every symptom
 * of that was silent:
 *
 *   - GeneratedPluginRegistrant could not find InAppWebViewFlutterPlugin
 *   - "Trying to create a platform view of unregistered type"
 *   - the WebView was therefore never created at all
 *   - so onWebViewCreated, onLoadStart, onLoadStop and shouldInterceptRequest
 *     all never fired
 *   - so the loading screen swept forever: no crash, no exception, no clue
 *
 * Debug was unaffected, because its build type does not minify. So was every
 * *Dart* change, because Dart is AOT and R8 never sees it. That is what made it
 * survive so long -- both halves of the app people were testing were correct,
 * and only the plugin's classes were missing from release.
 *
 * **HOW TO TURN IT OFF PROPERLY**
 *
 * The flag lives on the build type, not the extension. `LibraryExtension` has no
 * `isMinifyEnabled` in AGP 9 -- verified with javap against gradle-api-9.1.0 --
 * but its `BuildType` base interface does declare isMinifyEnabled/setMinifyEnabled.
 *
 * It also has to be set while the plugin is being *applied*, because variants are
 * created afterwards. Setting it in `afterEvaluate` is silently too late, and
 * that is what the task-level hack was reaching for.
 *
 * `scripts/build_app_flutter.js` refuses to ship a release APK whose plugin AARs
 * have come out empty, so this cannot silently happen again.
 */
subprojects {
    plugins.withId("com.android.library") {
        extensions.configure(LibraryExtension::class.java) {
            buildTypes.named("release") {
                isMinifyEnabled = false
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}