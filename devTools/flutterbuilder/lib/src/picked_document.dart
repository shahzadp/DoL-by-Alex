import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';

/// A file the player picked, with its contents already in memory.
///
/// Its own file so that [NativeBridge] and [ImportService] can both talk about
/// it without importing each other.
class PickedDocument {
  const PickedDocument({required this.name, required this.mimeType, required this.base64});

  /// Read whatever the platform channel decoded.
  ///
  /// Tolerant by design: the map is whatever came back over the channel, and a
  /// missing or mistyped key is ordinary rather than exceptional. The caller
  /// checks [isUsable] and says something to the player.
  factory PickedDocument.fromMap(Object? raw) {
    if (raw is! Map) return const PickedDocument(name: '', mimeType: '', base64: '');
    final map = raw.cast<Object?, Object?>();
    return PickedDocument(
      name: map['name']?.toString() ?? '',
      mimeType: map['mimeType']?.toString() ?? 'application/octet-stream',
      base64: map['data']?.toString() ?? '',
    );
  }

  final String name;
  final String mimeType;

  /// The payload. Base64 rather than bytes because that is what crosses a
  /// platform channel reliably -- see NativeBridge.saveFile for the whole story
  /// of getting that wrong.
  final String base64;

  bool get isUsable => name.isNotEmpty && base64.isNotEmpty;

  /// Decode to the exact bytes, or null if the payload is not base64.
  ///
  /// Only for callers that genuinely need bytes. The page is handed base64 and
  /// does its own decoding, so that the `File` it builds is byte-identical to
  /// what the player chose.
  Uint8List? get bytes {
    try {
      return base64Decode(base64);
    } on FormatException {
      return null;
    }
  }

  @override
  String toString() => 'PickedDocument($name, ${base64.length} b64 chars)';
}