import 'package:flutter/widgets.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'game_host.dart';
import 'storage_origin.dart';
import 'web_asset_server.dart';

/// The game's WebView settings.
///
/// A top-level function rather than a literal in the widget so the flags below
/// can be asserted in a unit test. `test/web_view_settings_test.dart` exists
/// because of what happens without the three `use*` ones -- see there.
InAppWebViewSettings gameWebViewSettings() {
  // The game is a fixed local document; there is nothing to gain from desktop
  // features and a fair amount of surface to go wrong.
  return InAppWebViewSettings(
    javaScriptEnabled: true,
    // localStorage lives here. This is not optional: without it the game cannot
    // read its own saves at all.
    domStorageEnabled: true,
    databaseEnabled: true,
    allowsInlineMediaPlayback: true,
    supportZoom: false,
    builtInZoomControls: false,
    displayZoomControls: false,
    // Keeps the story's #111 showing through until the page actually paints. A
    // WebView is opaque white before it has any content, and delivering a 50 MB
    // document leaves a visible white flash on an otherwise dark screen. Once
    // the page paints it covers this anyway.
    transparentBackground: true,

    // `useHybridComposition` is left at the plugin's default.
    //
    // It was set to `false` to try to speed up scrolling (the plugin's own wiki
    // documents a framerate cost for hybrid composition). Reverted: it could not
    // be shown to work, and a stalled load is a far worse outcome than a slow
    // scroll. In normal composition the WebView is also an Android view *on top*
    // of the Flutter surface, so no Flutter overlay can be drawn over it at all.
    // If scrolling is still slow, this is the next experiment -- and it wants a
    // device and an afternoon, not a release.

    // The three flags below are not WebView behaviour, they are this plugin's
    // opt-in switches, and they gate whether the matching callback is ever
    // called. Each one defaults to false in the plugin's own Android settings
    // object, and passing the callback above is not enough: the plugin checks
    // the setting first (InAppWebViewChromeClient.java:866,
    // InAppWebViewClient.java:655 and :82). The doc comment on
    // PlatformWebViewCreationParams.shouldInterceptRequest says so in as many
    // words.
    //
    // They are set explicitly rather than relying on whatever else might turn
    // them on, because each one fails silently and differently: without
    // useOnShowFileChooser the file input does nothing at all.
    useShouldInterceptRequest: true,
    useShouldOverrideUrlLoading: true,

    // NOT `useOnShowFileChooser`. The plugin's file-chooser callback is gated
    // behind this setting and it never fired, silently, so the page cancels the
    // input's own click and asks for the file over a handler this app owns. See
    // import_service.dart. Leaving the plugin's picker enabled as well would
    // mean two pickers if it ever started working.
    useOnShowFileChooser: false,
  );
}

/// Hosts the game.
///
/// The WebView loads `https://localhost/index.html`, which does not exist on
/// any network: [InAppWebView.shouldInterceptRequest] answers every request
/// under that origin out of the app's asset bundle. That is what makes the
/// page's origin `https://localhost`, which is where every existing player's
/// localStorage saves already live. See storage_origin.dart before changing
/// anything here.
///
/// Deliberately thin. Everything the app does *about* the game -- the loading
/// screen, the status message, the back rule, export -- lives in [GameHost] and
/// the widgets around this one. What is left here is the set of WebView
/// settings that have no Dart-side equivalent, and the callbacks that hand
/// events to [GameHost].
///
/// There is no Flutter-side splash. The Android system splash draws the app
/// mark and hands over at its own pace; this widget just needs to not flash a
/// different colour while the story is still arriving, which is what the
/// transparent background below is for.
class GameWebView extends StatelessWidget {
  const GameWebView({super.key, required this.host});

  final GameHost host;

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialUrlRequest: URLRequest(url: WebUri('$kStorageOrigin/index.html')),

      initialSettings: gameWebViewSettings(),

      onWebViewCreated: host.attach,

      shouldInterceptRequest: host.intercept,

      // The game owns navigation entirely. This is a deliberate change from the
      // Capacitor build, which let any link the story renders navigate the
      // WebView away from the game -- tapping a GitHub link mid-play stranded
      // the player on a web page with no way back but "press BACK again to
      // exit", and the session with it.
      //
      // This only catches navigations, not the game's own fetches (the blog
      // feature talks to googleapis.com and is unaffected).
      //
      // Our own origin has to be let through rather than cancelled. Android
      // does not call this for the initial loadUrl, so returning CANCEL for
      // everything looked fine -- until the game's Restart, which is
      // `LoadScreen.show()` followed by `window.location.reload()`. That is a
      // real navigation, and when the WebView routes it through here it was
      // cancelled: the document never reloaded, data-init stayed "loading",
      // and the player watched the loader spin forever. Cancelling a navigation
      // to the page we ourselves serve has no defensible purpose, so only
      // genuinely foreign URLs are stopped now (MEMORY.md trap 31).
      shouldOverrideUrlLoading: (controller, navigationAction) async {
        final url = navigationAction.request.url;
        if (url == null) {
          debugPrint('[webview] blocked a navigation with no url at all');
          return NavigationActionPolicy.CANCEL;
        }
        if (WebAssetServer.serves(url.uriValue)) {
          return NavigationActionPolicy.ALLOW;
        }
        debugPrint('[webview] blocked navigation to $url');
        return NavigationActionPolicy.CANCEL;
      },

      onLoadStart: (controller, url) => host.onLoadStart(),

      onLoadStop: (controller, url) => host.onLoadStop(),

      // Only the main document matters. A failed image is the game's own
      // missing asset and says nothing about whether the app works.
      onReceivedError: (controller, request, error) {
        if (request.isForMainFrame != true) return;
        host.onLoadError(error.description);
      },

      // There is deliberately no onProgressChanged handler. For an intercepted
      // local document the WebView's progress is not the story's progress -- it
      // jumps around with parsing, which happens after every byte is already
      // here -- so a progress bar fed from it would lie. The loader counts
      // elapsed time instead, and says so.
    );
  }
}