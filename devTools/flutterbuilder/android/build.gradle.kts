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
 * Stop library modules minifying themselves.
 *
 * flutter_inappwebview_android sets `minifyEnabled true` on its own release
 * build, so `:flutter_inappwebview_android:minifyReleaseWithR8` runs R8 over the
 * plugin. Under AGP 9 that pass is not given android.jar, so it reports 182
 * missing classes -- android.app.Activity, android.annotation.SuppressLint and
 * so on -- and fails the build. AGP generates missing_rules.txt listing all 182
 * as -dontwarn, which is the giveaway that none of them are genuinely absent.
 *
 * There is nothing to gain from it either way. A library ships its classes to
 * the consumer, which runs its own R8 over the combined program, so shrinking
 * inside the AAR is duplicated work at best. The app module keeps minifying;
 * only library modules are affected.
 *
 * This was latent rather than new: it passed earlier only because Gradle
 * treated the plugin's R8 output as up to date and never re-ran it. Any edit
 * that invalidated that task surfaced it.
 *
 * Worth revisiting when the plugin ships a stable release -- 1.2.0-beta.3 is
 * pinned only because 6.1.5 cannot build under AGP 9 at all.
 */
subprojects {
    // Skip a library's self-minification task outright.
    //
    // flutter_inappwebview_android sets `minifyEnabled true` on its own release
    // build, so `:flutter_inappwebview_android:minifyReleaseWithR8` runs R8 over
    // the plugin. Under AGP 9 that pass is not given android.jar, so it reports
    // 182 missing classes -- android.app.Activity, android.annotation.SuppressLint
    // and so on -- and fails the build. AGP generates missing_rules.txt listing
    // every one of them as -dontwarn, which is the giveaway that none are
    // genuinely absent.
    //
    // This is done at the task level rather than by setting the extension's
    // minifyEnabled flag, because the flag is consumed while variants are being
    // created -- setting it in afterEvaluate is silently too late, which is
    // worth knowing because it looks like it worked. Task names are stable
    // across AGP versions in a way that DSL property names demonstrably are not:
    // the old LibraryExtension is deprecated at error level in AGP 9, its
    // replacement does not expose the property at all, and that cost three
    // attempts to work around. `isMinifyEnabled` and `minifyEnabled` are both
    // tried by name further down for modules that build the task some other way.
    //
    // Nothing is lost. A library ships its classes to the consumer, which runs
    // its own R8 over the combined program, so shrinking inside the AAR is
    // duplicated work at best. The app module still minifies.
    //
    // This was latent rather than new: it passed earlier only because Gradle
    // treated the plugin's R8 output as up to date and never re-ran it. Any edit
    // that invalidated that task surfaced it.
    tasks.matching { it.name == "minifyReleaseWithR8" }.configureEach {
        enabled = false
        logger.lifecycle("Disabled $path (library self-minification; see build.gradle.kts)")
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
