import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'game_shell.dart';
import 'palette.dart';

/// Root widget: the game, edge to edge and inset clear of the cutouts.
class DolApp extends StatelessWidget {
  const DolApp({super.key});

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      // Light icons, because everything behind them is #111. The nav bar colour
      // itself is ignored on Android 15+, which draws edge to edge regardless;
      // the SafeArea in GameShell keeps the story out from under it.
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
          // styling is deliberately minimal so it cannot bleed into it -- the
          // only themed widgets in the app are the loader and the banner, and
          // both are drawn from explicit greys.
          scaffoldBackgroundColor: kSplashBackground,
          useMaterial3: true,
        ),
        home: const Scaffold(
          backgroundColor: kSplashBackground,
          body: GameShell(),
        ),
      ),
    );
  }
}