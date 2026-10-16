import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/import_service.dart';
import 'package:dol/src/native_bridge.dart';
import 'package:dol/src/picked_document.dart';
import 'package:dol/src/status.dart';

/// Stand-in for the Android host, so the whole import path can be driven from a
/// test: what the page asked for, what came back, and what the player was told.
class _FakeHost {
  _FakeHost() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(_channel, _handle);
  }

  static const MethodChannel _channel = MethodChannel('test/native');

  final List<MethodCall> calls = <MethodCall>[];

  /// What `openDocument` returns, or throws.
  Object? Function()? response;

  Future<Object?> _handle(MethodCall call) async {
    calls.add(call);
    if (call.method != 'openDocument') return null;
    final r = response;
    return r == null ? null : r();
  }

  List<String>? acceptTypesSent() {
    for (final call in calls.reversed) {
      if (call.method != 'openDocument') continue;
      final args = (call.arguments as Map?)?.cast<Object?, Object?>();
      return (args?['acceptTypes'] as List?)?.cast<String>();
    }
    return null;
  }

  bool called(String method) => calls.any((c) => c.method == method);

  ImportService service([StatusModel? status]) => ImportService(
        bridge: NativeBridge(channel: _channel),
        status: status ?? StatusModel(),
      );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PickedDocument', () {
    test('reads the map the platform sends', () {
      final doc = PickedDocument.fromMap(<Object?, Object?>{
        'name': 'a.save',
        'mimeType': 'text/plain',
        'data': 'aGVsbG8=',
      });
      expect(doc.isUsable, isTrue);
      expect(doc.name, 'a.save');
      expect(doc.mimeType, 'text/plain');
    });

    test('survives junk rather than throwing', () {
      // The map is whatever the platform channel decoded; a missing key is
      // ordinary, not exceptional.
      for (final junk in <Object?>[null, 42, 'nope', <Object?, Object?>{}, <Object?, Object?>{'name': 'x'}]) {
        final doc = PickedDocument.fromMap(junk);
        expect(doc.isUsable, isFalse, reason: 'junk: $junk');
      }
    });

    test('decodes to the exact bytes, so the page can build an identical File', () {
      final doc = PickedDocument.fromMap(<Object?, Object?>{
        'name': 'a.save',
        'mimeType': 'text/plain',
        'data': 'AAECA/8=',
      });
      expect(doc.bytes, <int>[0, 1, 2, 3, 255]);
    });

    test('refuses a payload that is not base64', () {
      final doc = PickedDocument(name: 'a', mimeType: 'text/plain', base64: 'not base64!!');
      expect(doc.bytes, isNull);
    });
  });

  group('pick', () {
    late _FakeHost host;
    late StatusModel status;

    setUp(() {
      host = _FakeHost();
      status = StatusModel(infoFor: const Duration(milliseconds: 40), errorFor: const Duration(milliseconds: 40));
    });

    test('hands the page a file it can turn into a real File', () async {
      host.response = () => <Object?, Object?>{
            'name': 'degrees-of-lewdity.save',
            'mimeType': 'text/plain',
            'data': 'aGVsbG8=',
          };
      final picked = await host.service(status).pick(<dynamic>[
        <Object?, Object?>{'accept': <String>[]},
      ]);

      expect(picked, isNotNull);
      expect(picked!['name'], 'degrees-of-lewdity.save');
      expect(picked['mimeType'], 'text/plain');
      expect(picked['data'], 'aGVsbG8=');
    });

    test('says nothing at all when the player cancels', () async {
      // A game that nags you for cancelling is a game you stop trusting.
      host.response = () => null;
      final picked = await host.service(status).pick(<dynamic>[
        <Object?, Object?>{'accept': <String>[]},
      ]);

      expect(picked, isNull);
      expect(status.current, isNull);
      expect(host.called('toast'), isFalse);
    });

    test('passes the input accept list through, and drops the rest', () async {
      host.response = () => null;
      await host.service(status).pick(<dynamic>[
        <Object?, Object?>{
          'accept': <String>['.save', 'text/plain', 'image/*', ''],
        },
      ]);

      expect(host.acceptTypesSent(), <String>['text/plain', 'image/*']);
    });

    test('reports a picker that could not be opened', () async {
      // The whole point of this service is that it is never silent. This input
      // used to do nothing whatsoever.
      host.response = () => throw PlatformException(code: 'noPicker', message: 'none available');
      final picked = await host.service(status).pick(<dynamic>[
        <Object?, Object?>{'accept': <String>[]},
      ]);

      expect(picked, isNull);
      expect(status.current?.severity, StatusSeverity.error);
      expect(host.called('toast'), isTrue, reason: 'a toast is above the WebView; a banner is not');
    });

    test('reports a file it could not read, rather than pretending', () async {
      host.response = () => <Object?, Object?>{'name': '', 'mimeType': '', 'data': ''};
      final picked = await host.service(status).pick(<dynamic>[
        <Object?, Object?>{'accept': <String>[]},
      ]);

      expect(picked, isNull);
      expect(status.current?.text, contains('Could not read'));
    });

    test('refuses a payload that is not base64', () async {
      host.response = () => <Object?, Object?>{
            'name': 'a.save',
            'mimeType': 'text/plain',
            'data': 'not base64!!',
          };
      final picked = await host.service(status).pick(<dynamic>[
        <Object?, Object?>{'accept': <String>[]},
      ]);

      expect(picked, isNull);
      expect(status.current?.text, contains('could not be read'));
    });

    test('copes with the page asking for nothing at all', () async {
      host.response = () => null;
      expect(await host.service(status).pick(null), isNull);
      expect(await host.service(status).pick(<dynamic>[]), isNull);
      expect(await host.service(status).pick(<dynamic>[42]), isNull);
      expect(status.current, isNull);
    });
  });
}