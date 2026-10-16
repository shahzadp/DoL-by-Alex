import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/export_service.dart';
import 'package:dol/src/native_bridge.dart';
import 'package:dol/src/status.dart';

/// Stand-in for the Android host, so the whole export path can be driven from a
/// test: what crosses the channel, what comes back, and what the player is told.
class _FakeHost {
  _FakeHost() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, _handle);
  }

  static const MethodChannel _channel = MethodChannel('test/native');

  final List<MethodCall> calls = <MethodCall>[];

  /// What each method returns, or throws.
  final Map<String, Object? Function()> responses = <String, Object? Function()>{};

  Future<Object?> _handle(MethodCall call) async {
    calls.add(call);
    final response = responses[call.method];
    return response == null ? null : response();
  }

  String? lastMessageOf(String method) {
    for (final call in calls.reversed) {
      if (call.method != method) continue;
      final args = (call.arguments as Map?)?.cast<Object?, Object?>();
      return args?['message']?.toString();
    }
    return null;
  }

  Map<Object?, Object?>? argsOf(String method) {
    for (final call in calls.reversed) {
      if (call.method != method) continue;
      return (call.arguments as Map?)?.cast<Object?, Object?>();
    }
    return null;
  }

  bool called(String method) => calls.any((c) => c.method == method);

  ExportService service([StatusModel? status]) => ExportService(
        bridge: NativeBridge(channel: _channel),
        status: status ?? StatusModel(),
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('normaliseMimeType', () {
    test('strips parameters, because a parameterised type is not a MIME type', () {
      // The game builds its export blob as text/plain;charset=UTF-8, and
      // ACTION_CREATE_DOCUMENT matches its intent filters against this string,
      // so the parameterised form matches no document provider at all.
      expect(normaliseMimeType('text/plain;charset=UTF-8'), 'text/plain');
      expect(normaliseMimeType('text/plain ; charset=utf-8'), 'text/plain');
    });

    test('lowercases, because Intent filters are matched exactly', () {
      expect(normaliseMimeType('TEXT/Plain'), 'text/plain');
    });

    test('falls back rather than sending an empty type', () {
      expect(normaliseMimeType(''), 'application/octet-stream');
      expect(normaliseMimeType('  '), 'application/octet-stream');
      expect(normaliseMimeType(';charset=UTF-8'), 'application/octet-stream');
    });
  });

  group('ExportRequest.parse', () {
    test('refuses arguments that are not the object the page sends', () {
      expect(ExportRequest.parse(null), isNull);
      expect(ExportRequest.parse(<dynamic>[]), isNull);
      expect(ExportRequest.parse(<dynamic>['nope']), isNull);
    });

    test('treats every field as untrusted', () {
      // The handler arguments are whatever JSON.stringify produced, so a null
      // where a string was promised is ordinary rather than exceptional.
      final request = ExportRequest.parse(<dynamic>[
        <Object?, Object?>{'name': null, 'data': null, 'mimeType': null},
      ]);
      expect(request, isNotNull);
      expect(request!.name, isEmpty);
      expect(request.base64, isEmpty);
      expect(request.problem, isNotNull);
    });
  });

  group('export', () {
    late _FakeHost host;
    late StatusModel status;

    setUp(() {
      host = _FakeHost();
      status = StatusModel(infoFor: const Duration(seconds: 1), errorFor: const Duration(seconds: 1));
    });

    test('passes the payload over as base64, not as bytes', () {
      // THE one. The platform channel encodes a Uint8List as a byte array and
      // the Android side reads this with call.argument<String>(), which returns
      // null for bytes -- so decoding it here made every export fail with "no
      // data provided" while looking like it had worked.
      host.responses['saveFile'] = () => 'content://x';
      host.service().export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGVsbG8='},
      ]);

      expect(host.argsOf('saveFile')?['data'], 'aGVsbG8=');
    });

    test('normalises the type at the receiving end too', () {
      host.responses['saveFile'] = () => 'content://x';
      host.service().export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'TEXT/plain;charset=UTF-8', 'data': 'aGk='},
      ]);

      expect(host.argsOf('saveFile')?['mimeType'], 'text/plain');
    });

    test('confirms a written save with a toast and nothing else', () async {
      host.responses['saveFile'] = () => 'content://x';
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGk='},
      ]);

      expect(outcome, ExportOutcome.saved);
      expect(host.lastMessageOf('toast'), 'Saved a.save');
      expect(status.current, isNull, reason: 'a success does not need a banner');
    });

    test('says nothing at all when the player cancels', () async {
      // A game that nags you for cancelling is a game you stop trusting.
      host.responses['saveFile'] = () => null;
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGk='},
      ]);

      expect(outcome, ExportOutcome.cancelled);
      expect(status.current, isNull);
      expect(host.called('toast'), isFalse);
    });

    test('reports a real failure, and never claims the save happened', () async {
      host.responses['saveFile'] = () => throw PlatformException(
            code: 'noData',
            message: 'saveFile: no data provided',
          );
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGk='},
      ]);

      expect(outcome, ExportOutcome.failed);
      expect(status.current?.severity, StatusSeverity.error);
      expect(status.current?.text, contains('no data provided'));
      expect(host.lastMessageOf('toast'), contains('Could not save'));
    });

    test('reads a cancellation reported as an error as a cancellation', () async {
      // Defensive: the native side answers a cancel with success(null), so this
      // path should never run. If it ever does, the alternative is telling the
      // player their save failed when it did not.
      host.responses['saveFile'] = () => throw PlatformException(
            code: 'cancelled',
            message: 'the player cancelled the picker',
          );
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGk='},
      ]);

      expect(outcome, ExportOutcome.cancelled);
      expect(status.current, isNull);
      expect(host.called('toast'), isFalse);
    });

    test('refuses an empty export without bothering the platform', () async {
      // The player must never be left believing a save was written when nothing
      // was even sent.
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': ''},
      ]);

      expect(outcome, ExportOutcome.failed);
      expect(host.called('saveFile'), isFalse);
      expect(status.current?.text, contains('empty'));
    });

    test('refuses a nameless export', () async {
      final outcome = await host.service(status).export(<dynamic>[
        <Object?, Object?>{'data': 'aGk='},
      ]);
      expect(outcome, ExportOutcome.failed);
      expect(host.called('saveFile'), isFalse);
    });

    test('does not throw on malformed arguments', () async {
      // The page is not waiting on a result it can act on, and a rejection
      // there would surface as an unhandled promise in the game's own console
      // while the player got nothing.
      final outcome = await host.service(status).export(<dynamic>[42]);
      expect(outcome, ExportOutcome.failed);
      expect(status.current?.text, contains('malformed'));
    });

    test('reads a cancel as a cancel when there is no host at all', () async {
      // Running against `flutter run -d chrome` there is no MethodChannel
      // handler, so every call throws MissingPluginException. That must not
      // become an error message on the player's screen.
      const channel = MethodChannel('nothing-answers-this');
      final outcome = await ExportService(bridge: NativeBridge(channel: channel), status: status)
          .export(<dynamic>[
        <Object?, Object?>{'name': 'a.save', 'mimeType': 'text/plain', 'data': 'aGk='},
      ]);

      expect(outcome, ExportOutcome.cancelled);
      expect(status.current, isNull);
    });
  });
}