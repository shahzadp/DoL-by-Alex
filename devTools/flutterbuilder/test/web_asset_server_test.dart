import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/storage_origin.dart';
import 'package:dol/src/web_asset_server.dart';

/// In-memory [AssetBundle] standing in for the prepared game, so these tests
/// exercise the real resolution logic without needing the 50 MB index.html.
class _FakeBundle extends CachingAssetBundle {
  _FakeBundle(this.files);

  final Map<String, List<int>> files;

  @override
  Future<ByteData> load(String key) async {
    final bytes = files[key];
    if (bytes == null) {
      // Matches rootBundle, which throws FlutterError for a missing key.
      throw FlutterError('Unable to load asset: $key');
    }
    final data = Uint8List.fromList(bytes);
    return ByteData.view(data.buffer, data.offsetInBytes, data.lengthInBytes);
  }
}

void main() {
  group('serves', () {
    test('accepts the pinned origin', () {
      expect(WebAssetServer.serves(Uri.parse('$kStorageOrigin/index.html')), isTrue);
      expect(WebAssetServer.serves(Uri.parse('$kStorageOrigin/img/a.png')), isTrue);
    });

    test('rejects every origin that is not it', () {
      // Each of these looks like a reasonable substitute and each would orphan
      // every player's save. Origin is scheme + host + port, so all three
      // differ from https://localhost.
      for (final url in <String>[
        'http://localhost/index.html', // wrong scheme
        'https://localhost:8443/index.html', // wrong port
        'https://127.0.0.1/index.html', // wrong host
        'https://appassets.androidplatform.net/index.html', // WebViewAssetLoader's default
        'https://example.com/index.html',
      ]) {
        expect(
          WebAssetServer.serves(Uri.parse(url)),
          isFalse,
          reason: '$url must not be served from the bundle',
        );
      }
    });
  });

  group('requestPath', () {
    test('strips the origin and the leading slash', () {
      expect(WebAssetServer.requestPath('$kStorageOrigin/img/a.png'), 'img/a.png');
    });

    test('maps the root to index.html', () {
      expect(WebAssetServer.requestPath(kStorageOrigin), 'index.html');
      expect(WebAssetServer.requestPath('$kStorageOrigin/'), 'index.html');
    });

    test('drops a cache-busting query and any fragment', () {
      // The game appends these; foo.png?v=2 is the same asset as foo.png.
      expect(WebAssetServer.requestPath('$kStorageOrigin/img/a.png?v=2'), 'img/a.png');
      expect(WebAssetServer.requestPath('$kStorageOrigin/img/a.png#x'), 'img/a.png');
    });

    test('keeps percent-encoding intact', () {
      // THE important one. Dart's Uri.path decodes %20, but Flutter stores
      // asset keys percent-encoded, so decoding here would miss 2,073 of the
      // 18,740 images in img/ -- all the ones with a space in the directory
      // name, such as "afro pouf" or "striped socks long".
      expect(
        WebAssetServer.requestPath('$kStorageOrigin/img/hair/back/afro%20pouf/feet.png'),
        'img/hair/back/afro%20pouf/feet.png',
      );
    });

    test('refuses a foreign origin', () {
      expect(WebAssetServer.requestPath('https://example.com/index.html'), isNull);
      expect(WebAssetServer.requestPath('http://localhost/index.html'), isNull);
    });

    test('refuses traversal', () {
      expect(WebAssetServer.requestPath('$kStorageOrigin/../../etc/passwd'), isNull);
      expect(WebAssetServer.requestPath('$kStorageOrigin/img/../../secret'), isNull);
    });
  });

  group('load', () {
    late WebAssetServer server;

    setUp(() {
      server = WebAssetServer(
        bundle: _FakeBundle(<String, List<int>>{
          'assets/web/index.html': utf8.encode('<html>game</html>'),
          'assets/web/img/a.png': <int>[1, 2, 3],
          // how Flutter actually stores this one
          'assets/web/img/hair/back/afro%20pouf/feet.png': <int>[4, 5],
        }),
      );
    });

    test('serves index.html', () async {
      final asset = await server.load('index.html');
      expect(asset, isNotNull);
      expect(utf8.decode(asset!.bytes), '<html>game</html>');
      expect(asset.contentType, 'text/html');
    });

    test('picks the content type from the extension', () async {
      expect((await server.load('img/a.png'))!.contentType, 'image/png');
    });

    test('resolves a percent-encoded path', () async {
      final asset = await server.load('img/hair/back/afro%20pouf/feet.png');
      expect(asset, isNotNull);
      expect(asset!.contentType, 'image/png');
    });

    test('returns null for a missing asset instead of throwing', () async {
      // The story references a few paths that were never in the repo, and a
      // missing asset must not take the whole load down with it.
      expect(await server.load('fonts/Roschild.ttf'), isNull);
    });

    test('caches, and reports the miss only once', () async {
      await server.load('img/a.png');
      await server.load('img/a.png');
      expect(server.missCount, 1);
    });

    test('does not let anything but a missing key escape', () async {
      // THE one. load() runs inside shouldInterceptRequest, and a handler that
      // completes with an error has no defined outcome natively: the request
      // goes unanswered, Chromium waits for it forever, onLoadStop never fires
      // and the player watches a loading bar for five minutes with nothing in
      // any log. Only FlutterError (a missing key) was caught before.
      final hostile = WebAssetServer(bundle: _HostileBundle());
      expect(await hostile.load('index.html'), isNull);
      expect(hostile.lastError, contains('index.html'));
    });

    test('gives up on a bundle read that never finishes', () async {
      // Same stall by another route, and the one that needs no bug at all.
      final stalled = WebAssetServer(
        bundle: _StalledBundle(),
        timeout: const Duration(milliseconds: 50),
      );
      final started = DateTime.now();
      expect(
        await stalled.load('index.html').timeout(const Duration(seconds: 5)),
        isNull,
      );
      expect(DateTime.now().difference(started), lessThan(const Duration(seconds: 5)));
      expect(stalled.lastError, contains('index.html'));
    }, timeout: const Timeout(Duration(seconds: 30)));
  });
}

/// Throws something that is *not* a missing key, which is the case that used to
/// escape [WebAssetServer.load] entirely.
class _HostileBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async {
    throw StateError('bundle is closed');
  }
}

/// Never completes. The 50 MB document on a bundle that has wedged looks
/// exactly like this.
class _StalledBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) => Completer<ByteData>().future;
}