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

  /// Hand the player the system "save as" dialog and write [data] wherever they
  /// choose. Returns the chosen uri, or null if the player cancelled -- a
  /// cancel is a normal outcome, not an error.
  Future<String?> saveFile({
    required String name,
    required String mimeType,
    required Uint8List data,
  }) {
    return _invoke<String>('saveFile', <String, dynamic>{
      'name': name,
      'mimeType': mimeType,
      'data': data,
    });
  }

  /// Show a transient Android toast.
  Future<void> toast(String message, {ToastLength length = ToastLength.short}) =>
      _invoke<void>('toast', <String, dynamic>{
        'message': message,
        'long': length == ToastLength.long,
      });

  /// Close the app the way the user swiping it away would.
  Future<void> exitApp() => _invoke<void>('exitApp', null);

  Future<T?> _invoke<T>(String method, dynamic arguments) async {
    try {
      return await _channel.invokeMethod<T>(method, arguments);
    } on MissingPluginException {
      // Not running on the Android host, or the activity has not attached yet.
      return null;
    } on PlatformException {
      return null;
    }
  }
}

enum ToastLength { short, long }