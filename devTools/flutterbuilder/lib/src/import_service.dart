import 'package:flutter/services.dart';

import 'app_log.dart';
import 'native_bridge.dart';
import 'picked_document.dart';
import 'status.dart';

/// Runs an import end to end.
///
/// ## Why this does not use the plugin's `onShowFileChooser`
///
/// It used to, and it silently did nothing -- twice, for two different reasons.
///
/// 1. That callback is gated behind its own `useOnShowFileChooser` setting
///    (`InAppWebViewChromeClient.java:866`), which defaults to false and which
///    the app's own settings did not enable at first.
/// 2. With the gate on, the plugin's fallback picker is what actually runs, and
///    that guards on `intent.resolveActivity(...)`, which returns null on
///    Android 11+ for the system chooser under package visibility.
///
/// Either way the observable result was the same: an `<input type="file">` that
/// does nothing, with no error anywhere. That is trap 18's shape -- a feature
/// that looks present in the markup and is dead -- so this service exists to make
/// the path both owned and *loud*: every failure here reaches the player.
///
/// So the page cancels the input's own click and asks for the file over a
/// handler this app owns. Nothing depends on a gate somebody else controls, and
/// the bytes come back as base64 rather than as a `content://` uri the WebView
/// would have to be able to read -- which was the other thing being assumed and
/// never checked.
class ImportService {
  ImportService({required this.bridge, required this.status});

  final NativeBridge bridge;
  final StatusModel status;

  /// Handle one request from the page.
  ///
  /// Returns a map the page turns into a `File`, or null for a cancellation.
  /// Never throws: the page cannot do anything useful with a rejection, and the
  /// failure has already been put on screen by the time we get here.
  Future<Map<String, dynamic>?> pick(List<dynamic>? args) async {
    appLog('DoLNative', 'openDocument acceptTypes=${_acceptTypes(args)}');
    PickedDocument? picked;
    try {
      picked = await bridge.pickDocument(acceptTypes: _acceptTypes(args));
    } on PlatformException catch (e) {
      appLog('DoLNative', 'openDocument failed: ${e.code} ${e.message}');
      await _fail('Could not open that file: ${e.message ?? e.code}');
      return null;
    }

    if (picked == null) {
      appLog('DoLNative', 'openDocument cancelled');
      return null; // a cancellation says nothing
    }

    if (!picked.isUsable) {
      await _fail('Could not read that file');
      return null;
    }
    if (picked.bytes == null) {
      await _fail('That file could not be read');
      return null;
    }

    appLog('DoLNative', 'read ${picked.name} (${picked.base64.length} b64 chars)');
    return <String, dynamic>{
      'name': picked.name,
      'mimeType': picked.mimeType,
      'data': picked.base64,
    };
  }

  /// The input's `accept` list, which is a comma separated string in HTML.
  ///
  /// Both of the game's inputs leave it empty, so this is normally empty. Entries
  /// that are not `type/subtype` are dropped: `.save` is a filename extension and
  /// `Intent.setType` would reject it.
  static List<String> _acceptTypes(List<dynamic>? args) {
    if (args == null || args.isEmpty || args.first is! Map) return const <String>[];
    final accept = (args.first as Map)['accept'];
    if (accept is! List) return const <String>[];
    return accept.map((e) => e.toString()).where((e) => e.contains('/')).toList();
  }

  /// Report a failure both ways.
  ///
  /// The toast is drawn by the system and is therefore always on top, which
  /// matters now that the app does not use hybrid composition: a Flutter banner
  /// drawn over the WebView would be behind it during play. See
  /// gameWebViewSettings().
  Future<void> _fail(String message) async {
    status.show(message, severity: StatusSeverity.error);
    await bridge.toast(message, length: ToastLength.long);
  }
}