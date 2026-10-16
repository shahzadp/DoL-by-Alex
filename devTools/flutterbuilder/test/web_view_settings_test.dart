import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/game_web_view.dart';

/// The plugin's opt-in switches, pinned.
///
/// `flutter_inappwebview` does not call a callback just because you passed one.
/// Several of them are additionally gated behind a `use*` setting, which
/// defaults to false in the plugin's own Android settings object, and the
/// plugin checks the setting first before dispatching:
///
///   * `InAppWebViewChromeClient.java:866` -- useOnShowFileChooser
///   * `InAppWebViewClient.java:655`       -- useShouldInterceptRequest
///   * `InAppWebViewClient.java:82`        -- useShouldOverrideUrlLoading
///
/// The doc comment on `PlatformWebViewCreationParams.shouldInterceptRequest`
/// says so explicitly, and then the app shipped for a week without them.
///
/// Every one of these fails silently and differently, which is why they are
/// worth a test rather than a comment: a missing useShouldInterceptRequest is a
/// blank screen, a missing useShouldOverrideUrlLoading is a player who can be
/// wandered off the game by a link, and a missing useOnShowFileChooser is an
/// input that does nothing at all with no error anywhere -- which is exactly
/// what "Load from file" did.
void main() {
  group('use* gates', () {
    test('file chooser is NOT the plugin callback', () {
      // The supported route is gated behind its own setting and never fired, and
      // the plugin's fallback guards on resolveActivity, which is null on
      // Android 11+ for the system chooser. The page handles file inputs itself
      // now. Enabling this as well would mean two pickers if it ever started
      // working.
      expect(gameWebViewSettings().useOnShowFileChooser, isFalse);
    });

    test('request interception is enabled', () {
      expect(gameWebViewSettings().useShouldInterceptRequest, isTrue,
          reason: 'without this the bundle is never served and there is no game');
    });

    test('navigation interception is enabled', () {
      expect(gameWebViewSettings().useShouldOverrideUrlLoading, isTrue,
          reason: 'without this a rendered link can walk the player off the game');
    });
  });

  group('composition', () {
    test('is left at the plugin default, which is hybrid', () {
      // Hybrid composition renders the WebView *below* the Flutter surface,
      // which is what lets the loading screen and the status banner be drawn
      // over the game at all. Setting it to `false` was tried to try to speed
      // up scrolling (Flutter's wiki documents a framerate cost for hybrid), and
      // reverted: it could not be shown to work, and in normal composition no
      // Flutter overlay can be drawn over the WebView.
      //
      // If scrolling is still slow, this is the next experiment. It wants a
      // device, not a release.
      expect(gameWebViewSettings().useHybridComposition, isTrue,
          reason: 'the plugin default; unset in gameWebViewSettings() and true '
              'here, which is the configuration that works');
    });

    test('the WebView is transparent, or the loading screen is hidden behind it', () {
      expect(gameWebViewSettings().transparentBackground, isTrue);
    });
  });

  group('settings the app depends on', () {
    final settings = gameWebViewSettings();

    test('localStorage is on, because that is where saves live', () {
      expect(settings.javaScriptEnabled, isTrue);
      expect(settings.domStorageEnabled, isTrue);
      expect(settings.databaseEnabled, isTrue);
    });

    test('the WebView is transparent until the story paints', () {
      // A WebView is opaque white before it has any content, which on an
      // otherwise #111 screen is a flash on every launch.
      expect(settings.transparentBackground, isTrue);
    });

    test('pinch zoom is off; the story has its own text sizing', () {
      expect(settings.supportZoom, isFalse);
      expect(settings.builtInZoomControls, isFalse);
      expect(settings.displayZoomControls, isFalse);
    });
  });
}