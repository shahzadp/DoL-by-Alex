import 'package:flutter/services.dart';

/// Window configuration: what the app asks the window for, and when.
///
/// Lives here rather than in main() because it has to be applied twice -- once
/// at startup and once every time the app comes back to the foreground -- and
/// "re-apply it in the other place" is how the two drift apart.
class WindowChrome {
  const WindowChrome._();

  /// Draw behind the status and navigation bars.
  ///
  /// Without this the window is inset by the system bars, so the WebView is laid
  /// out in a box smaller than the screen: the game is squeezed and the notch
  /// area is simply black. Edge to edge plus the [SafeArea] in game_shell.dart
  /// is what makes the story's layout the size it is supposed to be while
  /// keeping its content out from under the notch and the navigation bar.
  ///
  /// Re-applied on resume because the flag also carries the navigation bar's
  /// contrast enforcement, and an activity coming back from the background can
  /// return with a scrim it did not have before. See MEMORY.md trap 22.
  static Future<void> applyEdgeToEdge() =>
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  /// Everything the window should be, applied in one call at startup.
  ///
  /// The game is a fixed landscape-or-portrait local document, and rotating
  /// mid-passage would lose the player's place. Android handles the rotation;
  /// the Flutter layer just stays out of the way.
  static Future<void> applyAtStartup() async {
    await applyEdgeToEdge();
    await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }
}