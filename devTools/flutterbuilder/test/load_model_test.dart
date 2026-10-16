import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/load_model.dart';

/// Everything here is about timing, so every test passes its own clock. Nothing
/// in this file sleeps, and nothing in this file should: the rules being pinned
/// are exactly the ones that would make a sleeping test flaky.
void main() {
  final t0 = DateTime(2026, 10, 16, 12);

  group('opening state', () {
    test('opens on a loader, because the first frame has to have one', () {
      final model = LoadModel(now: t0);
      expect(model.phase, LoadPhase.loading);
      expect(model.visible, isTrue);
      expect(model.detail, isNull);
    });
  });

  group('a full document load', () {
    test('hands over with an animation, because the player watched it', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.tick(t0.add(const Duration(seconds: 3)));
      model.pageBusy(busy: false, now: t0.add(const Duration(seconds: 3)));

      expect(model.phase, LoadPhase.ready);
      expect(model.visible, isFalse);
      expect(model.fadeOut, isTrue);
    });

    test('measures from the event, not from the last tick', () {
      // An event can land between two ticks, and the handover decision is made
      // from elapsed time. If the clock were only advanced by tick(), this load
      // would read as 250 ms old and be torn down instantly.
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.tick(t0.add(const Duration(milliseconds: 250)));
      model.pageBusy(busy: false, now: t0.add(const Duration(milliseconds: 900)));

      expect(model.fadeOut, isTrue);
    });

    test('reports the document state it was handed', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.pageBusy(
        busy: false,
        now: t0,
        document: const DocumentState('interactive'),
      );
      expect(model.document.value, 'interactive');
    });
  });

  group('a passage transition', () {
    late LoadModel model;
    final ready = t0.add(const Duration(seconds: 3));

    setUp(() {
      model = LoadModel(now: t0)..beginLoad(t0);
      model.pageBusy(busy: false, now: ready);
      expect(model.phase, LoadPhase.ready);
    });

    test('re-arms a loader that was already handed over', () {
      // The story sets data-init back to "loading" for every link. No WebView
      // callback fires for any of it, so if this did not work there would be no
      // loader at all after the first tap.
      model.pageBusy(busy: true, now: ready.add(const Duration(milliseconds: 20)));
      expect(model.phase, LoadPhase.loading);
      expect(model.visible, isTrue);
      expect(model.fadeOut, isFalse);
    });

    test('tears down instantly, because a fade here would cost 260ms per tap', () {
      // The screen already goes full-bleed #111 for the transition, so there is
      // nothing to animate into or out of -- and a 260ms fade would be added
      // latency on every single link the player taps.
      final short = ready.add(const Duration(milliseconds: 20));
      model.pageBusy(busy: true, now: short);
      model.pageBusy(busy: false, now: short.add(const Duration(milliseconds: 40)));

      expect(model.phase, LoadPhase.ready);
      expect(model.fadeOut, isFalse);
    });

    test('starts its clock again from zero', () {
      model.pageBusy(busy: true, now: ready.add(const Duration(milliseconds: 20)));
      model.tick(ready.add(const Duration(seconds: 1)));
      // Measured from the transition, not from the three-second load before it.
      expect(model.elapsed, const Duration(milliseconds: 980));
      expect(model.isSlow, isFalse, reason: 'the previous load must not leak into this one');
    });
  });

  group('the slow-load label', () {
    test('counts only after eight seconds', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.tick(t0.add(const Duration(milliseconds: 7900)));
      expect(model.isSlow, isFalse);

      model.tick(t0.add(const Duration(seconds: 8100)));
      expect(model.isSlow, isTrue);
    });

    test('counts down to the same threshold', () {
      // Pinned because the two have to stay in step, or a load that is visibly
      // counting has already blown past "slow".
      expect(LoadModel.slowThreshold, const Duration(seconds: 8));
    });
  });

  group('the watchdog', () {
    test('gives up rather than sweeping forever', () {
      // The symptom this exists for: a stalled load used to show an indefinite
      // "still loading" with no message, no reason and no way out.
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.tick(t0.add(const Duration(seconds: 89)));
      expect(model.phase, LoadPhase.loading, reason: 'not yet');

      model.tick(t0.add(LoadModel.stuckThreshold));
      expect(model.phase, LoadPhase.failed);
      expect(model.detail, contains('stopped after 90s'));
    });

    test('a retry starts the clock again', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.tick(t0.add(LoadModel.stuckThreshold));
      expect(model.phase, LoadPhase.failed);

      model.beginLoad(t0.add(const Duration(seconds: 100)));
      expect(model.phase, LoadPhase.loading);
      model.tick(t0.add(const Duration(seconds: 101)));
      expect(model.phase, LoadPhase.loading, reason: 'and is not instantly stuck again');
    });

    test('a passage transition never trips it', () {
      // Transitions are tens of milliseconds, so this is belt and braces --
      // but a transition arriving after a long idle must not inherit the old
      // clock either.
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.pageBusy(busy: false, now: t0);
      model.pageBusy(busy: true, now: t0.add(const Duration(minutes: 10)));
      model.tick(t0.add(const Duration(minutes: 10, milliseconds: 100)));
      expect(model.phase, LoadPhase.loading);
    });
  });

  group('the trail', () {
    test('records the steps in order, and says which one it is on', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model
        ..reached('asked for the document')
        ..reached('the document arrived');
      expect(model.trail, ['load started', 'asked for the document', 'the document arrived']);
      expect(model.lastStep, 'the document arrived');
    });

    test('a retry starts it again rather than appending to the last attempt', () {
      // Otherwise the failure screen for the third attempt lists the first two,
      // and the steps that matter are buried under the ones that did not.
      final model = LoadModel(now: t0)..beginLoad(t0)..reached('asked for the document');
      model.beginLoad(t0.add(const Duration(seconds: 90)));
      expect(model.trail, ['load started']);
      expect(model.lastStep, 'load started');
    });

    test('collapses a repeated step', () {
      // The page reports "loading" on every poll, and an unbounded trail on a
      // failure screen is its own bug.
      final model = LoadModel(now: t0)..beginLoad(t0);
      model
        ..reached('the page says: loading')
        ..reached('the page says: loading')
        ..reached('the page says: loading');
      expect(model.trail.where((s) => s == 'the page says: loading').length, 1);
    });

    test('is bounded', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      for (var i = 0; i < 200; i++) {
        model.reached('step $i');
      }
      expect(model.trail.length, LoadModel.maxTrailEntries);
    });

    test('does not notify on its own', () {
      // Every caller is already inside a callback that leads to a notification,
      // and a load records several steps at a time.
      final model = LoadModel(now: t0)..beginLoad(t0);
      var notified = 0;
      model.addListener(() => notified++);
      model.reached('asked for the document');
      expect(notified, 0);
    });
  });

  group('failure', () {
    test('reports the reason instead of leaving the loader turning', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.fail('net::ERR_FILE_NOT_FOUND', t0.add(const Duration(seconds: 2)));

      expect(model.phase, LoadPhase.failed);
      expect(model.detail, 'net::ERR_FILE_NOT_FOUND');
      expect(model.visible, isTrue, reason: 'there has to be something to read');
    });

    test('never reports an empty reason', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.fail('   ', t0);
      expect(model.detail, isNotEmpty);
    });

    test('is not cleared by the document finishing', () {
      // Otherwise a failure that arrives a moment before onLoadStop would erase
      // itself, and the player would be left staring at a bare loader with no
      // reason and no Retry button.
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.fail('the story data could not be read', t0);
      model.pageBusy(busy: false, now: t0.add(const Duration(milliseconds: 40)));

      expect(model.phase, LoadPhase.failed);
      expect(model.detail, 'the story data could not be read');
    });

    test('is cleared by a retry', () {
      final model = LoadModel(now: t0)..beginLoad(t0);
      model.fail('boom', t0);
      model.beginLoad(t0.add(const Duration(seconds: 1)));

      expect(model.phase, LoadPhase.loading);
      expect(model.detail, isNull);
      expect(model.elapsed, Duration.zero);
    });
  });
}