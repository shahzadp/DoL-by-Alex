import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'src/app.dart';

/// DoL by Alex.
///
/// The app is a shell around a bundled copy of the game; see
/// lib/src/storage_origin.dart for the one thing about it that is easy to
/// break by accident.
void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Draw behind the status and navigation bars.
  //
  // Without this the window is inset by the system bars, so the WebView is laid
  // out in a box smaller than the screen: the game is squeezed and the notch
  // area is simply black. Edge-to-edge plus the `viewport-fit=cover` and
  // `env(safe-area-inset-*)` CSS in www/flutter_additions.js is what makes the
  // story's layout the size it is supposed to be while keeping its content out
  // from under the notch and the three-button navigation bar.
  //
  // Cutout handling itself is in the manifest
  // (android:windowLayoutInDisplayCutoutMode="shortEdges").
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

  // The game is a fixed landscape-or-portrait local document, and rotating
  // mid-passage would lose the player's place. Android handles the rotation;
  // the Flutter layer just stays out of the way.
  SystemChrome.setPreferredOrientations(<DeviceOrientation>[
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  runApp(const DolApp());
}