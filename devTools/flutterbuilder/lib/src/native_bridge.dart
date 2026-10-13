import 'package:flutter/services.dart';

/// Dart side of the Android bridge.
///
/// The game is a web app, so everything it can ask the platform for has to be
/// funnelled through JavaScript handlers on the WebView side (see
/// www/flutter_additions.js). This channel carries the calls that genuinely
/// need native code:
///
///  * [saveFile] -- the Storage Access Framework save dialog. There is no
///    cross-platform Dart equivalent that opens the *system* picker, and the
///    Cordova and Capacitor builds both did this natively, so export behaviour
///    stays identical.
///  * [toast] -- a real Android toast, matching what the previous builds showed.
///  * [exitApp] -- let Android unwind the activity stack normally.
///
/// Everything degrades gracefully: if the channel is missing (running against
/// `flutter run -d chrome`, say) the calls return null rather than throwing
/// during startup.
class NativeBridge {
  NativeBridge({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel(methodChannelName);

  static const String methodChannelName = 'com.vrelnir.dol/native';

  final MethodChannel _channel;

  /// Hand the player the system "save as" dialog and write [base64] wherever
  /// they choose. Returns the chosen uri, or null if the player cancelled -- a
  /// cancel is a normal outcome, not an error.
  ///
  /// [base64] is passed through as the base64 *string* it is, not decoded to
  /// bytes first. It has to be, and getting this wrong is silent rather than
  /// loud: the platform channel encodes a [Uint8List] as a byte array, while the
  /// Android side reads this argument with `call.argument<String>()`, which
  /// returns null for bytes. Every export then failed with "no data provided",
  /// and because that error was also being swallowed (see [_invoke]) the player
  /// saw nothing at all. MainActivity decodes the string itself, which is also
  /// what lets it skip the work entirely when the player cancels.
  Future<String?> saveFile({
    required String name,
    required String mimeType,
    required String base64,
  }) {
    return _invoke<String>('saveFile', <String, dynamic>{
      'name': name,
      'mimeType': mimeType,
      'data': base64,
    });
  }

  /// Show a transient Android toast.
  Future<void> toast(String message, {ToastLength length = ToastLength.short}) =>
      _invokeQuietly('toast', <String, dynamic>{
        'message': message,
        'long': length == ToastLength.long,
      });

  /// Close the app the way the user swiping it away would.
  Future<void> exitApp() => _invokeQuietly('exitApp', null);

  Future<T?> _invoke<T>(String method, dynamic arguments) async {
    try {
      return await _channel.invokeMethod<T>(method, arguments);
    } on MissingPluginException {
      // Not running on the Android host, or the activity has not attached yet.
      return null;
    }
    // PlatformException is deliberately NOT caught here. The native side uses it
    // to report a real failure ("no data provided", "file is too large", "write
    // failed"), and it is the only way the caller learns that. Swallowing it
    // returned null, which the JS side reads as "the player cancelled the
    // picker" -- so a total failure of export looked identical to a deliberate
    // cancellation, and neither produced a message.
  }

  /// For calls whose own failure is not worth reporting.
  ///
  /// Showing a toast that cannot be shown must not throw, and closing the app
  /// must not throw on the way out.
  Future<T?> _invokeQuietly<T>(String method, dynamic arguments) async {
    try {
      return await _invoke<T>(method, arguments);
    } on PlatformException {
      return null;
    }
  }
}

enum ToastLength { short, long }