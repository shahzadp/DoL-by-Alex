# R8 rules for the release build.
#
# The Capacitor build needed a similar file, but for a different reason: the
# Capacitor bridge discovers plugins by scanning annotations, so R8 silently
# stripped @CapacitorPlugin classes and every JS call failed at runtime. There
# is no annotation scanning here, but MainActivity is only ever reached from
# Dart by name, which is an equally silent failure mode, so it is pinned too.

# MainActivity is instantiated by the Flutter engine from the manifest, and
# reached by Dart over the method channel. Nothing references its members
# directly, so R8 cannot see that they are used.
-keep class com.vrelnir.dol.MainActivity { *; }

# Keep the channel name intact. It is a compile-time constant on both sides, so
# R8 would otherwise be free to inline it one way and not the other.
-keepclassmembers class com.vrelnir.dol.MainActivity {
    @android.webkit.JavascriptInterface <methods>;
}

# flutter_inappwebview reaches these through the WebView and through generated
# plugin registrants; without them the JS bridge silently does nothing.
-keep class com.pichillilorenzo.flutter_inappwebview_android.** { *; }

# Annotations are read reflectively in a few places in the plugin stack.
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod