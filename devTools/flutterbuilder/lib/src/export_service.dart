import 'package:flutter/services.dart';

import 'native_bridge.dart';
import 'status.dart';

/// What the game asked us to write to disk.
///
/// Parsed out of the JavaScript handler's arguments, which arrive as whatever
/// `JSON.stringify` produced, so every field is treated as untrusted: a null
/// where a string was promised is normal, not exceptional.
class ExportRequest {
  const ExportRequest({required this.name, required this.mimeType, required this.base64});

  /// What the player will see in the system dialog.
  final String name;

  /// Already normalised -- see [normaliseMimeType].
  final String mimeType;

  /// The payload, as base64. Not decoded here, and that is load-bearing; see
  /// [NativeBridge.saveFile].
  final String base64;

  /// null when this is usable, otherwise why it is not.
  ///
  /// A missing piece is reported to the player rather than thrown, because the
  /// alternative is the failure this app used to have: export did nothing at
  /// all, with no file, no picker and no message.
  String? get problem {
    if (name.isEmpty) return 'the export had no file name';
    if (base64.isEmpty) return 'the export was empty';
    return null;
  }

  /// Reads the handler's argument list, or null if it is not the shape the page
  /// is supposed to send.
  static ExportRequest? parse(List<dynamic>? args) {
    if (args == null || args.isEmpty) return null;
    final head = args.first;
    if (head is! Map) return null;

    final map = head.cast<Object?, Object?>();
    final name = map['name']?.toString() ?? '';
    final base64 = map['data']?.toString() ?? '';
    final mimeType = normaliseMimeType(map['mimeType']?.toString() ?? '');

    return ExportRequest(name: name, mimeType: mimeType, base64: base64);
  }
}

/// How an export ended.
enum ExportOutcome {
  /// The player chose a destination and the bytes were written.
  saved,

  /// The player dismissed the picker. A normal outcome, and deliberately said
  /// nothing about -- a game that nags you for cancelling is a game you stop
  /// trusting.
  cancelled,

  /// It did not happen, and the player has been told why.
  failed,
}

/// Reduce a MIME type to something `Intent.setType` will accept.
///
/// The game builds its export blob as `text/plain;charset=UTF-8`, so the
/// charset rides along in the type. That is not a MIME type, and it is not
/// merely sloppy: `ACTION_CREATE_DOCUMENT` matches its intent filters against
/// this string, and a parameterised type matches no document provider, so the
/// picker opens with nothing selectable (MEMORY.md trap 34).
///
/// The page strips parameters too. Both ends, because a value is worth
/// normalising near where it is interpreted, and because a regression at either
/// end should not be enough to break the picker.
String normaliseMimeType(String raw) {
  final bare = raw.split(';').first.trim().toLowerCase();
  return bare.isEmpty ? 'application/octet-stream' : bare;
}

/// Runs an export end to end: validate, hand it to the platform, and make sure
/// the player is told the outcome.
///
/// All of this used to live in the injected script, spread across a promise
/// chain and a `.catch` that reported through the same bridge it was most likely
/// to be reporting a failure of. None of it needed to be there: the only part
/// that genuinely has to be in the page is turning a `Blob` into base64, because
/// that is the only place the bytes exist.
class ExportService {
  ExportService({required this.bridge, required this.status});

  final NativeBridge bridge;
  final StatusModel status;

  /// Handle one `saveAs(blob, name)` from the game.
  ///
  /// Never throws. The page is not waiting for a result it can act on, and a
  /// rejection there would surface as an unhandled promise in the game's own
  /// console while the player got nothing -- which is the failure mode this
  /// exists to eliminate.
  Future<ExportOutcome> export(List<dynamic>? args) async {
    final request = ExportRequest.parse(args);
    if (request == null) {
      return _fail('the export was malformed');
    }
    final problem = request.problem;
    if (problem != null) {
      return _fail('Could not save: $problem');
    }

    try {
      // The base64 string crosses untouched. The platform channel encodes a
      // Uint8List as a byte array and the Android side reads this argument with
      // call.argument<String>(), which returns null for bytes -- so decoding
      // here made every export fail with "no data provided" while looking like
      // it had worked (MEMORY.md trap 33).
      final uri = await bridge.saveFile(
        name: request.name,
        mimeType: request.mimeType,
        base64: request.base64,
      );

      // null is a dismissal, not a failure, and says nothing.
      if (uri == null) return ExportOutcome.cancelled;

      await bridge.toast('Saved ${request.name}');
      return ExportOutcome.saved;
    } on PlatformException catch (e) {
      // The native side uses this to report a real failure ("no data
      // provided", "file is too large", "write failed") and it is the only way
      // the caller learns that it happened.
      final message = e.message ?? e.code;
      if (_looksLikeCancellation(message)) return ExportOutcome.cancelled;
      return _fail('Could not save: $message');
    }
  }

  /// Report a failure, both ways.
  ///
  /// The toast is what the player expects from a native app. The banner is
  /// there because a toast is short and this is the message most worth reading
  /// twice, and because the export path is exactly where a bridge failure would
  /// leave the toast undelivered.
  Future<ExportOutcome> _fail(String message) async {
    status.show(message, severity: StatusSeverity.error);
    await bridge.toast(message, length: ToastLength.long);
    return ExportOutcome.failed;
  }

  /// A dismissal that arrives as an error rather than as a null result.
  ///
  /// The native side returns `success(null)` for a cancel, so this should never
  /// fire. It is here because the alternative -- treating one as a failure --
  /// would tell the player their save failed when it did not, and that is the
  /// kind of message that makes people stop trusting an export button.
  static bool _looksLikeCancellation(String message) =>
      RegExp(r'cancel', caseSensitive: false).hasMatch(message);
}