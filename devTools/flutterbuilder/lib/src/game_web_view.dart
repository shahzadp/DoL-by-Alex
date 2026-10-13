import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'native_bridge.dart';
import 'storage_origin.dart';
import 'web_asset_server.dart';

/// Hosts the game.
///
/// The WebView loads `https://localhost/index.html`, which does not exist on
/// any network: [shouldInterceptRequest] answers every request under that origin
/// out of the app's asset bundle. That is what makes the page's origin
/// `https://localhost`, which is where every existing player's localStorage
/// saves already live. See storage_origin.dart before changing anything here.
///
/// There is no Flutter-side splash. The Android system splash draws the app mark
/// and hands over at its own pace; this widget just needs to not flash a
/// different colour while the story is still arriving, which is what the
/// transparent background below is for.
class GameWebView extends StatefulWidget {
  const GameWebView({super.key});

  @override
  State<GameWebView> createState() => _GameWebViewState();
}

class _GameWebViewState extends State<GameWebView> {
  final WebAssetServer _assets = WebAssetServer();
  final NativeBridge _bridge = NativeBridge();

  InAppWebViewController? _controller;

  Future<void> _handleBack() async {
    final controller = _controller;
    if (controller == null) {
      await _bridge.exitApp();
      return;
    }

    final handled = await controller.evaluateJavascript(
      source: 'window.__dolHandleBack ? window.__dolHandleBack() : false',
    );

    // evaluateJavascript can hand back the boolean directly or its string
    // spelling depending on platform and version; accept either rather than
    // guessing, because getting this wrong means an unexitable app.
    final consumed = handled == true || handled == 'true';
    if (!consumed) await _bridge.exitApp();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // The gesture is always handled above: the game gets first refusal, and
      // only then does the app close. Never let the route pop underneath it.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_handleBack());
      },
      child: InAppWebView(
        initialUrlRequest: URLRequest(url: WebUri('$kStorageOrigin/index.html')),

        // The game is a fixed local document; there is nothing to gain from
        // desktop features and a fair amount of surface to go wrong.
        initialSettings: InAppWebViewSettings(
          javaScriptEnabled: true,
          // localStorage lives here. This is not optional: without it the game
          // cannot read its own saves at all.
          domStorageEnabled: true,
          databaseEnabled: true,
          allowsInlineMediaPlayback: true,
          supportZoom: false,
          builtInZoomControls: false,
          displayZoomControls: false,
          // Keeps the story's #111 showing through until the page actually
          // paints. A WebView is opaque white before it has any content, and
          // delivering a 50 MB document leaves a visible white flash on an
          // otherwise dark screen. Once the page paints it covers this anyway.
          transparentBackground: true,
        ),

        onWebViewCreated: (controller) {
          _controller = controller;
          _registerJsHandlers(controller);
        },

        shouldInterceptRequest: _intercept,

        // The game owns navigation entirely. This is a deliberate change from
        // the Capacitor build, which let any link the story renders navigate
        // the WebView away from the game -- tapping a GitHub link mid-play
        // stranded the player on a web page with no way back but "press BACK
        // again to exit", and the session with it.
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
        // and the player watched the loader spin forever. Cancelling a
        // navigation to the page we ourselves serve has no defensible purpose,
        // so only genuinely foreign URLs are stopped now.
        shouldOverrideUrlLoading: (controller, navigationAction) async {
          final url = navigationAction.request.url;
          if (url != null && WebAssetServer.serves(url.uriValue)) {
            return NavigationActionPolicy.ALLOW;
          }
          debugPrint('[webview] blocked navigation to $url');
          return NavigationActionPolicy.CANCEL;
        },

        onReceivedError: (controller, request, error) {
          // Only the main document matters. A failed image is the game's own
          // missing asset and says nothing about whether the app works.
          //
          // Reporting it matters more than it looks: a load that fails outright
          // used to leave the player staring at the loader indefinitely, with no
          // way to tell a dead load from a slow one. Restart reloads the whole
          // 50 MB document, so it is the navigation most worth saying something
          // about.
          if (request.isForMainFrame != true) return;
          debugPrint('[webview] main document failed: ${error.description}');
          _reportLoadFailure(controller, error.description);
        },
      ),
    );
  }

  /// Bridge for the handful of things the game asks the platform for.
  ///
  /// Handlers are registered on the controller rather than the widget in this
  /// version of the plugin, so they have to wait for onWebViewCreated. The game
  /// polls for the bridge when it loads (see www/flutter_additions.js), so a
  /// handler landing a moment after the document does not break anything.
  void _registerJsHandlers(InAppWebViewController controller) {
    controller
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.saveFile',
        callback: (args) => _saveFile(args),
      )
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.toast',
        callback: (args) async {
          final long = args.containsKey('long') && args['long'] == true;
          await _bridge.toast(
            args['message']?.toString() ?? '',
            length: long ? ToastLength.long : ToastLength.short,
          );
          return null;
        },
      );
  }

  /// The Flutter equivalent of Capacitor's WebViewLocalServer.
  ///
  /// Returning a response here stops the WebView ever making a real request, so
  /// the document's origin stays `https://localhost` and localStorage keeps
  /// pointing at the data every existing save is already in.
  Future<WebResourceResponse?> _intercept(
    InAppWebViewController controller,
    WebResourceRequest request,
  ) async {
    // rawValue, not url.path: Dart decodes Uri.path, and Flutter stores asset
    // keys percent-encoded. 2,073 paths under img/ contain a space.
    final path = WebAssetServer.requestPath(request.url.rawValue);

    if (path == null) {
      // Either a foreign URL or a traversal attempt: not ours to serve.
      return _notFound(request.url);
    }

    final asset = await _assets.load(path);
    if (asset == null) {
      // Missing from the bundle. Answer with a real 404 rather than null:
      // null means "not intercepted", which would send the WebView off to
      // https://localhost for a host that does not exist and stall on a
      // connection attempt.
      return _notFound(request.url);
    }

    return WebResourceResponse(
      contentType: asset.contentType,
      contentEncoding: 'utf-8',
      data: asset.bytes,
    );
  }

  /// A well-formed 404, so a missing asset fails quietly instead of hanging.
  WebResourceResponse _notFound(WebUri uri) => WebResourceResponse(
        statusCode: 404,
        reasonPhrase: 'Not Found',
        headers: <String, String>{'Cache-Control': 'no-store'},
        contentType: 'text/plain',
        contentEncoding: 'utf-8',
        data: Uint8List.fromList('not found: $uri'.codeUnits),
      );

  /// Put a load failure on screen instead of leaving the loader spinning.
  ///
  /// Best effort by design: the document may be gone entirely, in which case
  /// there is nothing to write to and the native log is all that is left. Never
  /// throws, because a failure to *report* a failure must not become a second
  /// failure.
  Future<void> _reportLoadFailure(
    InAppWebViewController controller,
    String detail,
  ) async {
    try {
      await controller.evaluateJavascript(
        source: 'window.__dolLoadFailed && window.__dolLoadFailed(${jsonEncode(detail)})',
      );
    } catch (e) {
      debugPrint('[webview] could not report load failure to the page: $e');
    }
  }

  /// Hand an exported Blob to the system save dialog.
  Future<Object?> _saveFile(List<dynamic> args) async {
    if (args.isEmpty || args.first is! Map) return null;

    final arg = (args.first as Map).cast<String, dynamic>();
    final name = arg['name']?.toString();
    final mimeType = arg['mimeType']?.toString();
    final base64 = arg['data']?.toString();

    if (name == null || base64 == null) {
      await _bridge.toast('Could not save: the export was empty', length: ToastLength.long);
      return null;
    }

    try {
      // The base64 string goes over the bridge untouched. See NativeBridge
      // .saveFile: decoding it here is what silently broke export, because the
      // Android side reads this argument as a String.
      final uri = await _bridge.saveFile(
        name: name,
        mimeType: mimeType ?? 'application/octet-stream',
        base64: base64,
      );
      // null here means the player dismissed the picker, which is a normal
      // outcome and deliberately says nothing.
      if (uri != null) {
        await _bridge.toast('Saved $name');
      }
      return uri;
    } catch (e) {
      // Never let an export fail silently -- the player would think the save
      // was written when it was not.
      await _bridge.toast('Could not save: $e', length: ToastLength.long);
      rethrow;
    }
  }
}