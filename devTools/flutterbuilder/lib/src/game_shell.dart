import 'dart:async';

import 'package:flutter/material.dart';

import 'game_host.dart';
import 'game_web_view.dart';
import 'load_overlay.dart';
import 'status.dart';

/// The app's window: the game, the loading screen, and the status message.
///
/// One stack, three layers, and the order is the whole argument for having it.
///
/// The game is inside a [SafeArea] because the insets are Flutter's job, not
/// the page's. `env(safe-area-inset-*)` looks like the answer and is not:
/// Chromium derives those from the display cutout, so on a device with a
/// three-button navigation bar and no cutout they all resolve to zero and the
/// story ends up underneath the buttons (MEMORY.md trap 22).
///
/// The loading screen and the status message are deliberately *outside* it.
/// The loader has to be full bleed, or the system bars would sit on two
/// different shades of the same dark grey for the few seconds it is up; the
/// banner has to stop at the navigation bar rather than disappear under it,
/// which is exactly where the in-page `<div>` it replaces lived.
///
/// Nothing here rebuilds the WebView. Both overlays are their own widgets
/// listening to their own models, so a status message appearing costs one
/// subtree, not a WebView rebuild.
class GameShell extends StatefulWidget {
  const GameShell({super.key, this.host});

  /// Injectable for tests; the app builds its own.
  final GameHost? host;

  @override
  State<GameShell> createState() => _GameShellState();
}

class _GameShellState extends State<GameShell> with WidgetsBindingObserver {
  late final GameHost _host = widget.host ?? GameHost();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _host.status.dispose();
    _host.load.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Only `paused` and `resumed`, which on Android always arrive as a pair.
    // `inactive` also fires for things that do not background the app -- the
    // notification shade, a permission dialog -- and reacting to those would
    // dismiss the keyboard out from under the player mid-sentence.
    switch (state) {
      case AppLifecycleState.paused:
        _host.onAppPaused();
      case AppLifecycleState.resumed:
        _host.onAppResumed();
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // The gesture is always handled inside: the game gets first refusal, and
      // only then does the app close. Never let the route pop underneath it.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_host.handleBack());
      },
      child: Stack(
        fit: StackFit.expand,
        children: <Widget>[
          SafeArea(child: GameWebView(host: _host)),
          LoadOverlay(model: _host.load, onRetry: _host.retry),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SafeArea(top: false, child: StatusBanner(model: _host.status)),
          ),
        ],
      ),
    );
  }
}