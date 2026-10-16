import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/back_navigator.dart';
import 'package:dol/src/status.dart';

void main() {
  final t0 = DateTime(2026, 10, 16, 12);

  group('back button', () {
    test('asks before it closes the app', () {
      final back = BackNavigator();
      expect(back.shouldExit(t0), isFalse, reason: 'the first press must not leave');
      expect(back.isArmed, isTrue);
    });

    test('closes on a second press inside the window', () {
      final back = BackNavigator();
      back.shouldExit(t0);
      expect(back.shouldExit(t0.add(const Duration(seconds: 1))), isTrue);
    });

    test('forgets the arming once it has been used', () {
      // A confirmed exit consumes it, so a press the system then declines to act
      // on cannot leave the next one silently killing the app.
      final back = BackNavigator();
      back.shouldExit(t0);
      back.shouldExit(t0.add(const Duration(seconds: 1)));
      expect(back.shouldExit(t0.add(const Duration(seconds: 2))), isFalse);
    });

    test('asks again after the window has passed', () {
      final back = BackNavigator();
      back.shouldExit(t0);
      expect(
        back.shouldExit(t0.add(BackNavigator.defaultWindow + const Duration(seconds: 1))),
        isFalse,
      );
    });

    test('the window is exactly the window', () {
      // One millisecond either side of it. The boundary matters because a
      // window that is quietly shorter than the message says ("Press BACK
      // again to exit") makes the app look broken.
      final back = BackNavigator(window: const Duration(seconds: 3));
      back.shouldExit(t0);
      expect(back.shouldExit(t0.add(const Duration(milliseconds: 2999))), isTrue);

      final other = BackNavigator(window: const Duration(seconds: 3));
      other.shouldExit(t0);
      expect(other.shouldExit(t0.add(const Duration(milliseconds: 3001))), isFalse);
    });

    test('re-arms after a confirmed exit rather than staying armed', () {
      // A press the system then declines to act on must not leave the next one
      // silently killing the app.
      final back = BackNavigator();
      expect(back.shouldExit(t0), isFalse);
      expect(back.shouldExit(t0.add(const Duration(seconds: 1))), isTrue);
      expect(back.shouldExit(t0.add(const Duration(seconds: 2))), isFalse);
      expect(back.shouldExit(t0.add(const Duration(seconds: 3))), isTrue);
    });

    test('is dropped when the game consumed the press instead', () {
      // Closing a menu is not a request to leave, so it must not also confirm
      // an exit the player half-remembered asking for.
      final back = BackNavigator();
      back.shouldExit(t0);
      back.disarm();
      expect(back.shouldExit(t0.add(const Duration(milliseconds: 200))), isFalse);
    });
  });

  group('status messages', () {
    test('are dismissed on their own', () async {
      final status = StatusModel(infoFor: const Duration(milliseconds: 20));
      addTearDown(status.dispose);

      status.show('Saved');
      expect(status.current?.text, 'Saved');

      await Future<void>.delayed(const Duration(milliseconds: 60));
      expect(status.current, isNull);
    });

    test('hold a failure twice as long as an ordinary message', () async {
      final status = StatusModel(
        infoFor: const Duration(milliseconds: 30),
        errorFor: const Duration(milliseconds: 300),
      );
      addTearDown(status.dispose);

      status.show('Export failed: no data provided', severity: StatusSeverity.error);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(status.current, isNotNull);

      await Future<void>.delayed(const Duration(milliseconds: 260));
      expect(status.current, isNull);
    });

    test('replace rather than queue, so a failure is never read behind a success', () async {
      final status = StatusModel(
        infoFor: const Duration(milliseconds: 40),
        errorFor: const Duration(milliseconds: 40),
      );
      addTearDown(status.dispose);

      status.show('Saved a.save');
      status.show('Could not save: write failed', severity: StatusSeverity.error);
      expect(status.current?.text, 'Could not save: write failed');

      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(status.current, isNull, reason: 'the second message owns the timer');
    });

    test('ignore an empty message', () {
      final status = StatusModel();
      addTearDown(status.dispose);
      status.show('   ');
      expect(status.current, isNull);
    });
  });
}