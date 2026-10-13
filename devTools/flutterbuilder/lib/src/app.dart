import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_web_view.dart';

/// The app's dark colour, shared with the native launch splash.
///
/// Matches the story's own `body{background-color:#111}`, which is the whole
/// point: the system splash hands over to a WebView that is still loading the
/// 50 MB story, and both surfaces are this colour, so nothing flashes.
const Color kSplashBackground = Color(0xFF111111);

/// Root widget: the game, edge to edge and inset clear of the cutouts.
class DolApp extends StatelessWidget {
  const DolApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Light icons, because everything behind them is #111. The nav bar colour
      // itself is ignored on Android 15+, which draws edge to edge regardless;
      // SafeArea below keeps the story out from under it.
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: kSplashBackground,
        systemNavigationBarIconBrightness: Brightness.light,
      ),
      child: MaterialApp(
        title: 'DoL by Alex',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          brightness: Brightness.dark,
          // The game's own CSS drives everything inside the WebView. Material
          // styling is deliberately minimal so it cannot bleed into it.
          scaffoldBackgroundColor: kSplashBackground,
          useMaterial3: true,
        ),
        home: const Scaffold(
          backgroundColor: kSplashBackground,
          body: SafeArea(child: GameWebView()),
        ),
      ),
    );
  }
}