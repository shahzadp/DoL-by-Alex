/// Decides what the hardware back button should do.
///
/// The rule is Android's own: a back press that would leave the app asks to be
/// confirmed by pressing it again. The whole of that -- the window, the
/// remember-arming, the reset when the app really does exit -- used to live in
/// the injected script, and it is pure state with no dependency on the game, so
/// it belongs here where it can be tested.
///
/// [now] is passed in rather than read from the clock, for the same reason as
/// `LoadModel.tick`: this is a timing rule, and a test that sleeps is a test
/// that flakes.
class BackNavigator {
  BackNavigator({this.window = defaultWindow});

  /// How long the confirmation stays armed.
  static const Duration defaultWindow = Duration(milliseconds: 3500);

  /// The first press has to arm it; a second press inside [window] confirms.
  final Duration window;

  DateTime? _armedAt;

  /// True when the player is being asked to press again.
  bool get isArmed => _armedAt != null;

  /// True when this press should close the app.
  ///
  /// Consumes the arming on a confirmed exit, so a press that the system then
  /// refuses to act on (the user swiping back from the home screen, say) does
  /// not leave the next press inside a stale window silently killing the app.
  bool shouldExit(DateTime now) {
    final armedAt = _armedAt;
    if (armedAt != null && now.difference(armedAt) <= window) {
      _armedAt = null;
      return true;
    }
    _armedAt = now;
    return false;
  }

  /// Forget the arming. Called when the back press was consumed by the game
  /// instead, so closing a menu does not also confirm an exit.
  void disarm() => _armedAt = null;
}