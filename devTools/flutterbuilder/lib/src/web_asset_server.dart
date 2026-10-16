import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'storage_origin.dart';

/// A resolved bundle entry, ready to be handed to the WebView.
class WebAsset {
  WebAsset(this.contentType, this.bytes);

  final String contentType;
  final Uint8List bytes;
}

/// Serves the bundled copy of the game to the native WebView.
///
/// This is the Flutter equivalent of Capacitor's `WebViewLocalServer`: a
/// request interceptor that answers `https://localhost/<path>` out of the app's
/// own assets, so the page's origin *is* `https://localhost` and its
/// `localStorage` stays where every existing player's saves already are.
///
/// Deliberately knows nothing about `flutter_inappwebview`, so it can be unit
/// tested with a plain `AssetBundle` stub. See game_web_view.dart for the
/// adapter.
class WebAssetServer {
  WebAssetServer({AssetBundle? bundle, Duration? timeout})
      : _bundle = bundle ?? rootBundle,
        _timeout = timeout ?? loadTimeout;

  /// Where the prepared game is staged inside the Flutter asset bundle.
  /// Kept in sync with scripts/prepare_flutter_assets.js.
  static const String assetRoot = 'assets/web';

  final AssetBundle _bundle;

  /// See [loadTimeout]. Injectable only so a test does not have to sit for it.
  final Duration _timeout;

  /// Decoded assets, keyed by asset path. The game's images average ~750
  /// bytes and the whole `img/` tree is 13.3 MB, so caching the lot is cheap and
  /// saves re-inflating the same file on every revisit.
  final Map<String, WebAsset> _cache = <String, WebAsset>{};

  int _cacheBytes = 0;

  /// Ceiling on the cache. `index.html` alone is ~50 MB, so this is sized to
  /// hold `img/` comfortably while keeping a pathological request pattern from
  /// growing the heap without bound.
  static const int maxCacheBytes = 24 * 1024 * 1024;

  /// Number of misses served since startup, for diagnostics.
  int missCount = 0;

  /// Whether [uri] names this server's origin.
  ///
  /// Compares scheme, host *and* port. Port is not a detail here: an origin is
  /// scheme + host + port, so `https://localhost:8443` is a different origin
  /// from `https://localhost` and serving the game under it would orphan every
  /// player's save exactly as surely as changing the host would.
  ///
  /// Anything else -- a real network URL the story links to, say -- is
  /// deliberately left alone so the WebView handles it (and fails) the way the
  /// browser would.
  static bool serves(Uri uri) =>
      uri.scheme == kStorageOriginScheme &&
      uri.host == kStorageOriginHost &&
      uri.port == kStorageOriginPort;

  /// Reduce a request URL to a path relative to [assetRoot], still
  /// percent-encoded.
  ///
  /// The encoding matters and is easy to miss. Flutter stores asset keys
  /// percent-encoded, so a directory called `afro pouf` lives in the bundle as
  /// `afro%20pouf`. There are 2,073 such paths in img/, so looking them up with
  /// a decoded path misses 11% of the artwork.
  ///
  /// Takes the *raw* URL string rather than a parsed [Uri] because Dart's Uri
  /// decodes `path` on the way out, which is precisely the wrong direction
  /// here. Any query string or fragment is dropped: the game appends cache
  /// busters, and `foo.png?v=2` is the same asset as `foo.png`.
  ///
  /// Returns null if the URL is not under our origin, or escapes the bundle.
  static String? requestPath(String rawUrl) {
    final origin = kStorageOrigin;
    if (!rawUrl.startsWith(origin)) return null;

    var path = rawUrl.substring(origin.length);

    final cut = path.indexOf(RegExp(r'[?#]'));
    if (cut >= 0) path = path.substring(0, cut);

    if (path.isEmpty || path == '/') path = '/index.html';
    if (path.startsWith('/')) path = path.substring(1);

    // Reject traversal. Not reachable through a normal WebView navigation, but
    // this resolves straight onto the bundle and there is no reason to allow it.
    if (path.contains('..')) return null;
    return path;
  }

  /// Resolve an already-encoded, origin-relative path against the bundle.
  ///
  /// Returns null if it is not a bundled asset. That means "not ours": the
  /// caller should answer with a 404 rather than letting the WebView go looking
  /// for a host that does not exist.
  ///
  /// **Never throws.** The caller is a `shouldInterceptRequest` handler, and a
  /// handler that completes with an error has no defined outcome on the native
  /// side -- in practice the request is simply never answered, Chromium waits
  /// for it forever, `onLoadStop` never fires and the player watches a loading
  /// bar that means nothing until the battery dies. That is not a hypothetical:
  /// it is the failure mode reported from a device as "still loading, five
  /// minutes", and the one thing that would have identified it is a diagnostic
  /// that never ran.
  ///
  /// So every failure mode is caught and turned into a 404, which at least lets
  /// the document finish and the page render, and [lastError] is set so a
  /// release build can say what went wrong.
  Future<WebAsset?> load(String encodedPath) async {
    final cached = _cache[encodedPath];
    if (cached != null) return cached;

    missCount++;
    try {
      // Bounded. An asset read that never completes is the same stall by
      // another route, and a 404 at least gets the document to the point where
      // it can render and report.
      final data = await _bundle.load('$assetRoot/$encodedPath').timeout(_timeout);
      final bytes = data.buffer.asUint8List(
        data.offsetInBytes,
        data.lengthInBytes,
      );
      final asset = WebAsset(_contentTypeFor(encodedPath, bytes), bytes);
      _remember(encodedPath, asset);
      return asset;
    } on FlutterError {
      // rootBundle throws FlutterError for a missing key. A missing asset must
      // not take the load down with it: the game references a handful of paths
      // that were never part of the repo (e.g. /fonts/Roschild.ttf) and the
      // Capacitor build 404'd on those too.
      return null;
    } catch (error) {
      // Everything else: an out-of-memory on the 50 MB document, a bundle that
      // is closed underneath us, a platform channel that is gone during a hot
      // restart. None of those should be able to hang the page.
      lastError = '$encodedPath: $error';
      return null;
    }
  }

  /// The most recent resolution failure, for diagnostics.
  ///
  /// Null unless something other than a plain missing key went wrong. Read by
  /// `adb logcat -s DoLNative` after a release build misbehaves, because there
  /// is no other way to see it on the build where the bug reproduces.
  String? lastError;

  /// How long a single bundle read may take before it is called a failure.
  ///
  /// Generous, because `index.html` is ~50 MB and a cold, compressed asset
  /// bundle on a slow phone is allowed to be slow. It exists so that "never
  /// finishes" cannot be another name for this stall.
  static const Duration loadTimeout = Duration(seconds: 20);

  void _remember(String path, WebAsset asset) {
    if (asset.bytes.lengthInBytes > maxCacheBytes) return;

    _cache[path] = asset;
    _cacheBytes += asset.bytes.lengthInBytes;

    // Plain insertion-order eviction. Nothing here is hot enough for LRU to
    // earn its complexity, and predictable eviction is easier to reason about.
    while (_cacheBytes > maxCacheBytes && _cache.isNotEmpty) {
      final oldest = _cache.keys.first;
      _cacheBytes -= _cache.remove(oldest)!.bytes.lengthInBytes;
    }
  }

  /// Content type for a bundle path.
  ///
  /// Works on the percent-encoded path, so the extension is taken from the tail
  /// and an encoded name still classifies correctly.
  ///
  /// Defaults to `application/octet-stream` for anything unrecognised rather
  /// than guessing: a wrong-but-valid type (image/png for a .txt) is worse than
  /// an honest generic one, because a strict consumer can reject the bytes.
  ///
  /// The extension is a hint, not the truth. The png artwork is re-encoded as
  /// lossless WebP by scripts/convert_images_to_webp.py *while keeping its .png
  /// name* -- the story builds most of its image paths at runtime, so renaming
  /// the files would mean rewriting a 50 MB document by regex and risking an
  /// image that silently fails to load. Browsers pick a decoder by sniffing the
  /// bytes rather than the extension, so this renders correctly either way, but
  /// serving the type that matches the bytes is still the honest thing to do and
  /// costs one comparison on a 12-byte header.
  static String _contentTypeFor(String path, Uint8List bytes) {
    if (_isWebp(bytes)) return 'image/webp';
    final dot = path.lastIndexOf('.');
    if (dot < 0) return 'application/octet-stream';
    return _contentTypes[path.substring(dot + 1).toLowerCase()] ??
        'application/octet-stream';
  }

  /// RIFF container with a WEBP form type.
  static bool _isWebp(Uint8List bytes) {
    if (bytes.length < 12) return false;
    // 'RIFF' .... 'WEBP'
    return bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50;
  }

  static const Map<String, String> _contentTypes = <String, String>{
    'html': 'text/html',
    'htm': 'text/html',
    'js': 'text/javascript',
    'mjs': 'text/javascript',
    'css': 'text/css',
    'json': 'application/json',
    'map': 'application/json',
    'txt': 'text/plain',
    'yml': 'text/yaml',
    'yaml': 'text/yaml',
    'png': 'image/png',
    'gif': 'image/gif',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'wasm': 'application/wasm',
    'xml': 'application/xml',
  };
}