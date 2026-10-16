import 'dart:async';

import 'package:flutter/widgets.dart';

import 'src/app.dart';
import 'src/window.dart';

/// DoL by Alex.
///
/// The app is a shell around a bundled copy of the game; see
/// lib/src/storage_origin.dart for the one thing about it that is easy to
/// break by accident.
void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Draw behind the system bars, and take orientation from Android. Both are
  // applied again on resume -- see WindowChrome for why that matters.
  unawaited(WindowChrome.applyAtStartup());

  runApp(const DolApp());
}