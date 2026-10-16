import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

import 'app_log.dart';
import 'back_navigator.dart';
import 'export_service.dart';
import 'import_service.dart';
import 'load_model.dart';
import 'native_bridge.dart';
import 'status.dart';
import 'web_asset_server.dart';
import 'window.dart';

/// Everything the app knows about the running game.
///
/// The split is deliberate and follows what each part actually has to know:
/// the *game* is a WebView and a bundle of assets, the *app* is a loading screen,
/// a status banner and a back rule, and none of those need to know how the game
/// is delivered. This class is the seam, and it is the only place the two sides
/// talk to each other.
///
/// It is a plain object rather than a widget. Every decision it makes about
/// timing and failure is therefore testable without pumping a widget tree, which
/// matters because those decisions are the ones that keep regressing (see the
/// export saga in MEMORY.md trap 33).
class GameHost {
  GameHost({WebAssetServer? assets, NativeBridge? bridge})
      : assets = assets ?? WebAssetServer(),
        bridge = bridge ?? NativeBridge() {
    export = ExportService(bridge: this.bridge, status: status);
    import = ImportService(bridge: this.bridge, status: status);
  }

  final WebAssetServer assets;
  final NativeBridge bridge;

  /// What the loading screen is showing.
  final LoadModel load = LoadModel();

  /// The status message, if any.
  final StatusModel status = StatusModel();

  /// The back-button rule.
  final BackNavigator back = BackNavigator();

  late final ExportService export;
  late final ImportService import;

  InAppWebViewController? controller;

  /// Asks the page to close whatever it has open. Returns true if it did.
  ///
  /// Kept as a string because it is evaluated in the page, not called from Dart.
  /// The page owns that decision and no amount of state on this side can know
  /// whether a SugarCube dialog is up.
  static const String _closeGameUiScript =
      'window.__dolCloseGameUi ? window.__dolCloseGameUi() : false';

  // --- WebView plumbing ---------------------------------------------------

  void attach(InAppWebViewController controller) {
    this.controller = controller;
    load.reached('web view created');
    registerJsHandlers(controller);
  }

  /// Bridge for the handful of things the game asks the platform for.
  ///
  /// Handlers are registered on the controller rather than passed as a widget
  /// parameter in this version of the plugin, so they have to wait for
  /// [attach] (MEMORY.md trap 17).
  ///
  /// All three were previously defined by the injected script, and only one of
  /// them still is: see www/flutter_additions.js for why the other two moved.
  void registerJsHandlers(InAppWebViewController controller) {
    controller
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.saveFile',
        callback: (args) async {
          // Returns null, never the outcome enum. A StandardMethodCodec cannot
          // encode an enum, so the reply throws while it is being written: the
          // file is written and the toast is shown, but the page's promise never
          // settles and the error surfaces nowhere the player can see it.
          await export.export(args);
          return null;
        },
      )
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.toast',
        callback: (args) async {
          final long = args.containsKey('long') && args['long'] == true;
          await bridge.toast(
            args['message']?.toString() ?? '',
            length: long ? ToastLength.long : ToastLength.short,
          );
          return null;
        },
      )
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.loadState',
        callback: (args) async {
          _onPageLoadState(args);
          return null;
        },
      )
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.pickFile',
        callback: (args) async {
          // appLog, not debugPrint: this whole path failed silently on a release
          // build twice, and debugPrint is compiled out of release, so the
          // diagnostics that existed were exactly the ones that never printed.
          appLog('DoLNative', 'pickFile requested: $args');
          try {
            final picked = await import.pick(args);
            appLog('DoLNative', 'pickFile answered: ${picked == null ? 'cancelled' : 'with a file'}');
            return picked;
          } catch (e, s) {
            appLog('DoLNative', 'pickFile threw: $e\n$s');
            rethrow;
          }
        },
      )
      ..addJavaScriptHandler(
        handlerName: 'DoLNative.importFailed',
        callback: (args) async {
          // The page could not even start the request: no handler registered, or
          // the bridge rejected it. Previously that was a no-op with nothing on
          // screen, which is the same shape of bug this path has had twice.
          final reason = args.isEmpty ? 'the app bridge did not answer' : args.first.toString();
          appLog('DoLNative', 'import failed in the page: $reason');
          status.show('Could not open that file', severity: StatusSeverity.error);
          await bridge.toast('Could not open that file', length: ToastLength.long);
          return null;
        },
      );
  }

  /// The Flutter equivalent of Capacitor's `WebViewLocalServer`.
  ///
  /// Returning a response here stops the WebView ever making a real request, so
  /// the document's origin stays `https://localhost` and localStorage keeps
  /// pointing at the data every existing save is already in. Read
  /// storage_origin.dart before changing anything about this.
  Future<WebResourceResponse?> intercept(
    InAppWebViewController controller,
    WebResourceRequest request,
  ) async {
    // rawValue, not url.path: Dart decodes Uri.path, and Flutter stores asset
    // keys percent-encoded. 2,073 paths under img/ contain a space (trap 19).
    final path = WebAssetServer.requestPath(request.url.rawValue);

    if (path == null) {
      // Either a foreign URL or a traversal attempt: not ours to serve.
      return notFound(request.url);
    }

    // Belt and braces around WebAssetServer.load, which is itself already
    // total. A shouldInterceptRequest handler that completes with an error
    // leaves the native side with nothing to send: the request is never
    // answered, Chromium waits for it forever, onLoadStop never fires, and the
    // player watches a loading bar that means nothing. That is precisely the
    // stall reported from a device, so this path is now incapable of producing
    // one -- a 404 at worst, which at least lets the document render.
    try {
      final asset = await assets.load(path);
      if (asset == null) {
        // Missing from the bundle. Answer with a real 404 rather than null:
        // null means "not intercepted", which would send the WebView off to
        // https://localhost for a host that does not exist and stall on a
        // connection attempt.
        if (assets.lastError != null) {
          appLog('DoLNative', 'asset read failed: ${assets.lastError}');
          load.reached('asset read failed');
        }
        return notFound(request.url);
      }

      // The milestone that matters most. Reaching the interceptor at all means
      // the WebView exists, is navigating and asked us for something, so a
      // stall *after* this line is ours and a stall before it is not. Recorded
      // once rather than per request: the game asks for hundreds of images and
      // the trail only has room for what changed.
      if (!_interceptorReached) {
        _interceptorReached = true;
        load.reached(path == 'index.html' ? 'asked for the document' : 'asked the app for assets');
      }

      return WebResourceResponse(
        contentType: asset.contentType,
        contentEncoding: 'utf-8',
        data: asset.bytes,
      );
    } catch (error, stack) {
      appLog('DoLNative', 'interceptor threw for $path: $error\n$stack');
      load.reached('the app could not answer a request');
      return notFound(request.url);
    }
  }

  /// Whether the interceptor milestone has been recorded for this load.
  ///
  /// Reset by [onLoadStart] so the game's Restart records it again.
  bool _interceptorReached = false;

  /// A well-formed 404, so a missing asset fails quietly instead of hanging.
  static WebResourceResponse notFound(WebUri uri) => WebResourceResponse(
        statusCode: 404,
        reasonPhrase: 'Not Found',
        headers: <String, String>{'Cache-Control': 'no-store'},
        contentType: 'text/plain',
        contentEncoding: 'utf-8',
        data: Uint8List.fromList('not found: $uri'.codeUnits),
      );

  // --- Load lifecycle -----------------------------------------------------

  /// A document is being delivered. Startup, and every Restart.
  void onLoadStart() {
    appLog('DoLNative', 'load started');
    _interceptorReached = false;
    load.beginLoad(DateTime.now());
  }

  /// The document finished.
  ///
  /// Not the same signal as the page's own readiness, and both are kept: the
  /// page knows when the *story* is playable, which is what the player cares
  /// about, while this is what the WebView knows. Either one is enough to take
  /// the loader down and the other keeps it up, so a page that never reports
  /// cannot strand the player on a loader.
  void onLoadStop() {
    appLog(
      'DoLNative',
      'document delivered (${assets.missCount} asset reads, '
      '${assets.lastError ?? 'no read errors'})',
    );
    load.reached('the document arrived');
    load.pageBusy(busy: false, now: DateTime.now());
  }

  /// The main document could not be delivered.
  ///
  /// Reports rather than retries. A silent outcome here used to look exactly
  /// like a slow device, which is the worst possible failure mode: nothing on
  /// screen and nothing in the log.
  void onLoadError(String detail) {
    appLog('DoLNative', 'main document failed: $detail');
    load.fail(detail, DateTime.now());
  }

  /// Called from the page whenever SugarCube's readiness signal changes.
  ///
  /// This is the same `data-init` attribute the old in-page loader keyed on,
  /// which is why it covers passage transitions as well as startup: a WebView
  /// load event fires for neither, and the transitions are the common case.
  void _onPageLoadState(List<dynamic> args) {
    if (args.isEmpty || args.first is! Map) return;
    final map = (args.first as Map).cast<Object?, Object?>();
    final now = DateTime.now();
    final state = map['state']?.toString();
    final document = DocumentState(map['document']?.toString() ?? '');

    // Recorded before the switch, so an unrecognised state is visible too. A
    // typo here used to be indistinguishable from the page never speaking at
    // all, and those two are exactly the pair you need to tell apart.
    load.reached('the page says: $state');

    // An unrecognised state is ignored rather than treated as ready. This is a
    // message from the page, and a typo in it must never be able to dismiss a
    // loader that is covering a still-loading game.
    switch (state) {
      case 'loading':
        load.pageBusy(busy: true, now: now, document: document);
      case 'failed':
        // `lacking` is SugarCube saying the story data is missing or malformed,
        // which is a different thing from the document failing to arrive and
        // deserves its own words.
        load.fail('the story data could not be read', now);
      case 'ready':
        load.pageBusy(busy: false, now: now, document: document);
    }
  }

  /// Re-deliver the document, from the failure screen.
  ///
  /// A whole `location.reload()`, so the 50 MB document is parsed again from
  /// scratch. That is the only correct thing to do here: a partially delivered
  /// document cannot be resumed, and Restart does exactly this in the game.
  Future<void> retry() async {
    final controller = this.controller;
    if (controller == null) return;
    onLoadStart();
    try {
      await controller.reload();
    } catch (e) {
      debugPrint('[webview] reload failed: $e');
      load.fail('could not reload: $e', DateTime.now());
    }
  }

  // --- Back button --------------------------------------------------------

  /// Handle a back press.
  ///
  /// The page gets first refusal, because it is the only thing that knows
  /// whether a dialog or an overlay is open. Only then does the app-level rule
  /// run, and only then can this close the app.
  Future<void> handleBack() async {
    final controller = this.controller;
    if (controller == null) {
      await bridge.exitApp();
      return;
    }

    final closedUi = await _callPage(_closeGameUiScript);
    if (closedUi == true) {
      // Closing a menu is not a request to leave, so any pending confirmation
      // is dropped rather than being allowed to swallow the next press.
      back.disarm();
      return;
    }

    if (back.shouldExit(DateTime.now())) {
      await bridge.exitApp();
    } else {
      await bridge.toast('Press BACK again to exit', length: ToastLength.long);
    }
  }

  /// Run a snippet in the page and hand back whatever it evaluated to.
  ///
  /// Never throws. The answer decides whether the app closes, so a failure to
  /// ask the page must not also fail the press -- it just means the page is not
  /// in a position to answer.
  Future<Object?> _callPage(String source) async {
    final controller = this.controller;
    if (controller == null) return null;
    try {
      return await controller.evaluateJavascript(source: source);
    } catch (e) {
      debugPrint('[webview] page call failed ($source): $e');
      return null;
    }
  }

  // --- Import -------------------------------------------------------------

  /// A `<input type="file">` was activated.
  ///
  /// There is deliberately **no** implementation. The story's two "Load from
  /// file" inputs are handled from the page instead -- see
  /// import_service.dart for how many attempts the supported path took.
  ///
  /// Left as a named method rather than removed so that the WebView does not
  /// have a method to call here, and so the reason is findable from the widget
  /// that used to wire it up.
  @Deprecated('Handled by ImportService via the page. See import_service.dart.')
  Future<ShowFileChooserResponse?> pickFile(ShowFileChooserRequest request) async =>
      ShowFileChooserResponse(filePaths: null, handledByClient: true);

  // --- App lifecycle ------------------------------------------------------

  /// The app went to the background.
  ///
  /// The WebView is deliberately left running. `pause()`/`resume()` would stop
  /// the renderer, and turning that into a timer pause would stop the game's
  /// autosave -- an autosave that stops because the player switched apps is
  /// worse than a few milliseconds of battery.
  ///
  /// The soft keyboard is Flutter's to dismiss, and leaving it up across a
  /// background/foreground cycle is exactly the sort of thing that makes a web
  /// view feel like a web view. The story has text inputs in it (the save text
  /// area, naming a character), so this happens in practice.
  void onAppPaused() {
    FocusManager.instance.primaryFocus?.unfocus();
    debugPrint('[app] paused');
  }

  /// The app came back.
  ///
  /// The window has to be told to go edge to edge again. On Android 15 the
  /// system draws edge to edge whatever it is told, but the flag also carries
  /// the navigation bar's contrast enforcement, and an activity returning from
  /// the background can come back with a scrim it did not have before. The
  /// story's layout depends on being full bleed (MEMORY.md trap 22), so this is
  /// re-applied rather than assumed.
  void onAppResumed() {
    unawaited(WindowChrome.applyEdgeToEdge());
    debugPrint('[app] resumed');
  }
}