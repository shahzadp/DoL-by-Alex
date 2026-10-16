import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:dol/src/load_model.dart';
import 'package:dol/src/load_overlay.dart';

/// What the player reads, pinned.
///
/// `flutter analyze` cannot see this, and neither can logcat: the loader is up
/// for a few seconds during startup and for tens of milliseconds on every link,
/// so "the wording is wrong" is not something a device check is likely to catch.
/// The sweeping line, by key. `find.byType(Transform)` is no use: Material
/// puts a few of their own in the tree.
final Finder sweep = find.byKey(const ValueKey<String>('dol-loading-sweep'));

/// The whole overlay, by key. Material builds `FadeTransition`s of its own, so
/// an unscoped `find.byType` finds the wrong one.
final Finder screen = find.byKey(const ValueKey<String>('dol-loading-screen'));

void main() {
  /// `DateTime.now()` is *not* faked by the widget test binding, so the model
  /// has to start from the real clock or its own clock jumps forward by however
  /// long ago the test file was written.
  LoadModel freshLoad() => LoadModel(now: DateTime.now())..beginLoad(DateTime.now());

  Future<void> pumpOverlay(
    WidgetTester tester,
    LoadModel model, {
    VoidCallback? onRetry,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LoadOverlay(model: model, onRetry: onRetry ?? () {}),
        ),
      ),
    );
    // One frame, never pumpAndSettle: the sweep repeats forever, so settling
    // never happens and asking for it times out.
    await tester.pump();
  }

  /// The loader's *rendered* opacity, which is how "it is going away" is
  /// observed. Two things make the obvious alternatives wrong: a handed-over
  /// loader deliberately stays in the tree so its fade has something to animate,
  /// and `AnimatedOpacity.opacity` is the *target*, which is 0 the instant the
  /// handover starts whether or not anything moved. null means no overlay at all.
  double? opacity(WidgetTester tester) {
    if (screen.evaluate().isEmpty) return null;
    return tester
        .widget<FadeTransition>(
          find.descendant(of: screen, matching: find.byType(FadeTransition)),
        )
        .opacity
        .value;
  }

  testWidgets('says LOADING and nothing else while the load is healthy', (tester) async {
    await pumpOverlay(tester, freshLoad());

    expect(find.text('LOADING\u2026'), findsOneWidget);
    expect(find.textContaining('STILL LOADING'), findsNothing);
  });

  testWidgets('the sweep is actually painted, and actually moves', (tester) async {
    // The user-visible property, and the one a screenshot cannot judge.
    //
    // This exists because the sweep was once laid out at 58 x 0:
    // FractionallySizedBox with a widthFactor and no heightFactor hands its
    // child tightFor(width: 58), whose height is only *bounded* by 0..2, and a
    // childless ColoredBox resolves constraints.smallest. Nothing was drawn, and
    // what the player saw was a track that did not move -- indistinguishable,
    // on a device, from an animation that simply was not running.
    await pumpOverlay(tester, freshLoad());

    expect(tester.getSize(sweep).height, greaterThan(0),
        reason: 'a zero-height sweep is invisible, and an invisible sweep looks '
            'exactly like a broken animation');
    expect(tester.getSize(sweep).width, closeTo(58, 0.01));

    // Read the widget's matrix rather than getRect: the latter does not move for
    // a Transform of this shape, and it is the matrix that is the real signal.
    double travelled() => tester.widget<Transform>(sweep).transform.getTranslation().x;
    final first = travelled();
    await tester.pump(const Duration(milliseconds: 400));
    expect(travelled() - first, greaterThan(1), reason: 'the bar has to move');
  });

testWidgets('starts counting once the load is genuinely slow', (tester) async {
    // The model is driven by hand rather than by the widget's timer. The timer
    // is faked but `DateTime.now()` is not, so pumping advances one and not the
    // other and the elapsed time never moves. `load_model_test.dart` covers the
    // thresholds; this is only here to pin the wording at each side of one.
    final now = DateTime.now();
    final model = LoadModel(now: now)..beginLoad(now);
    await pumpOverlay(tester, model);

    model.tick(now.add(const Duration(milliseconds: 7900)));
    await tester.pump();
    expect(find.text('LOADING\u2026'), findsOneWidget, reason: '7.9s is not slow yet');

    model.tick(now.add(const Duration(milliseconds: 8100)));
    await tester.pump();
    expect(find.text('STILL LOADING \u00b7 8 S \u00b7 load started'), findsOneWidget);
  });

  testWidgets('shows the page state, because slow and dead look alike otherwise', (tester) async {
    final now = DateTime.now();
    final model = LoadModel(now: now)
      ..beginLoad(now)
      ..pageBusy(busy: true, now: now, document: const DocumentState('interactive'));
    await pumpOverlay(tester, model);

    model.tick(now.add(const Duration(seconds: 9)));
    await tester.pump();
    expect(find.text('STILL LOADING \u00b7 9 S \u00b7 INTERACTIVE \u00b7 load started'), findsOneWidget);
  });

  testWidgets('says what it is waiting for, because a counter teaches nothing', (tester) async {
    // A player watching this for thirty seconds learns nothing from a number
    // going up. What they need to know is whether it is still waiting for the
    // document or has moved on, because those are different bugs.
    final now = DateTime.now();
    final model = LoadModel(now: now)..beginLoad(now)..reached('asked for the document');
    await pumpOverlay(tester, model);

    model.tick(now.add(const Duration(seconds: 20)));
    await tester.pump();
    expect(find.textContaining('asked for the document'), findsOneWidget);

    model.reached('the page says: loading');
    await tester.pump();
    expect(find.textContaining('the page says: loading'), findsOneWidget);
  });

  testWidgets('a failure is a reason and a way out, not a spinner', (tester) async {
    var retried = 0;
    final model = freshLoad();
    await pumpOverlay(tester, model, onRetry: () => retried++);

    model.fail('net::ERR_FILE_NOT_FOUND', DateTime.now());
    await tester.pump();

    expect(find.text('COULD NOT LOAD THE GAME'), findsOneWidget);
    expect(find.text('net::ERR_FILE_NOT_FOUND'), findsOneWidget);
    // The sweep goes: it would read as "still trying", which is the one thing
    // we now know to be false.
    expect(sweep, findsNothing);

    await tester.tap(find.text('TRY AGAIN'));
    expect(retried, 1);
  });

  testWidgets('a failure shows how far the load got', (tester) async {
    // The reason this matters: "it did not work" is not a diagnosis. These four
    // outcomes are four different bugs and are indistinguishable without the
    // trail, which is why it is on the screen rather than only in a log nobody
    // has access to.
    final now = DateTime.now();
    final model = LoadModel(now: now)
      ..beginLoad(now)
      ..reached('load started')
      ..reached('asked for the document')
      ..reached('the page says: loading');
    await pumpOverlay(tester, model);

    model.tick(now.add(LoadModel.stuckThreshold));
    await tester.pump();

    expect(find.textContaining('asked for the document'), findsOneWidget);
    expect(find.textContaining('the page says: loading'), findsOneWidget);
    expect(find.textContaining('COULD NOT LOAD THE GAME'), findsOneWidget);

    // The detail line must not repeat the last step. It did once, and two lines
    // saying the same thing reads as a bug rather than as evidence.
    expect(find.textContaining('waiting at'), findsNothing);
  });

  testWidgets('the failure screen is inert too', (tester) async {
    // Trap 51b one level up. The failure screen has no track in it and its text
    // never changes, so a sweep ticker and a 4 Hz clock behind it rebuild the
    // subtree for nothing -- and it is the one screen a player will stare at
    // for minutes while deciding whether to restart their phone.
    final model = freshLoad();
    await pumpOverlay(tester, model);
    expect(sweep, findsOneWidget, reason: 'sanity: it is running while loading');

    model.fail('the story stopped loading after 90s', DateTime.now());
    await tester.pump();
    expect(sweep, findsNothing, reason: 'no track on screen, so no ticker');

    // And nothing downstream of the clock either: the model must not keep
    // ticking once it has already given its verdict.
    var ticks = 0;
    model.addListener(() => ticks++);
    await tester.pump(const Duration(seconds: 3));
    expect(ticks, 0);
  });

  testWidgets('a long load hands over with an animation', (tester) async {
    final now = DateTime.now();
    final model = LoadModel(now: now)..beginLoad(now);
    await pumpOverlay(tester, model);
    model.tick(now.add(const Duration(seconds: 2)));
    await tester.pump();

    model.pageBusy(busy: false, now: now.add(const Duration(seconds: 2)));
    await tester.pump();
    expect(opacity(tester), 1, reason: 'must not vanish in the frame it hands over');

    // Halfway through the fade it is still there, and still translucent.
    await tester.pump(const Duration(milliseconds: 130));
    expect(opacity(tester), inInclusiveRange(0, 1));

    // Once the fade is done it leaves the tree, rather than sitting at zero
    // opacity as a full-screen composited layer for the rest of the session.
    await tester.pump(const Duration(milliseconds: 200));
    expect(screen, findsNothing);
  });

  testWidgets('goes completely inert once handed over', (tester) async {
    // THE one. A handed-over loader used to stay in the tree at zero opacity
    // with its AnimationController still repeating, so an AnimatedBuilder
    // rebuilt the whole subtree sixty times a second for as long as the player
    // was reading the game, dirtying the Flutter surface on every frame while
    // the WebView was trying to scroll. It is invisible, which is exactly why
    // it survived a device test.
    final now = DateTime.now();
    final model = LoadModel(now: now)..beginLoad(now);
    await pumpOverlay(tester, model);
    model.tick(now.add(const Duration(seconds: 2)));
    await tester.pump();

    double travelled() => tester.widget<Transform>(sweep).transform.getTranslation().x;
    final moving = travelled();
    await tester.pump(const Duration(milliseconds: 400));
    expect(travelled() - moving, greaterThan(1), reason: 'sanity: it is running');

    model.pageBusy(busy: false, now: now.add(const Duration(seconds: 2)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400)); // let the fade finish

    // Out of the tree entirely: no widget, no layer, no ticker.
    expect(find.byType(LoadOverlay), findsOneWidget, reason: 'the State stays');
    expect(screen, findsNothing, reason: 'but nothing it drew does');
    expect(sweep, findsNothing);
  });

testWidgets('a passage transition is gone immediately, with no added lag', (tester) async {
    final model = freshLoad()..pageBusy(busy: false, now: DateTime.now());
    await pumpOverlay(tester, model);
    expect(opacity(tester), isNull, reason: 'already handed over, so no widget at all');

    // 40ms, the length of a real transition.
    model.pageBusy(busy: true, now: DateTime.now());
    await tester.pump();
    expect(find.text('LOADING\u2026'), findsOneWidget);

    model.pageBusy(busy: false, now: DateTime.now());
    // A single frame is the whole teardown. Anything that needed a second pump
    // would be latency on every link the player taps.
    await tester.pump();
    expect(opacity(tester), isNull);
  });

  testWidgets('cannot swallow a tap meant for the game, but can be tapped itself', (tester) async {
    // The loader covers the page, so if it ever took hit tests a passage
    // transition would become unclickable. The failure screen is the other way
    // round -- its Retry button is the only way out, so it has to take taps.
    var taps = 0;
    var retried = 0;
    final model = freshLoad();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Stack(
            fit: StackFit.expand,
            children: <Widget>[
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => taps++,
                child: const SizedBox.expand(),
              ),
              LoadOverlay(model: model, onRetry: () => retried++),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    final centre = tester.getCenter(find.byType(Scaffold));
    await tester.tapAt(centre);
    expect(taps, 1, reason: 'a loader must not intercept');

    model.fail('boom', DateTime.now());
    await tester.pump();
    await tester.tap(find.text('TRY AGAIN'));
    expect(retried, 1);
  });

  testWidgets('parks the sweep mid-track when animations are turned off', (tester) async {
    final model = freshLoad();
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: MaterialApp(
          home: Scaffold(body: LoadOverlay(model: model, onRetry: () {})),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 750));

    // Still a loader, not a broken screen -- and parked, not spinning.
    expect(find.text('LOADING\u2026'), findsOneWidget);
    final parked = tester.widget<Transform>(sweep).transform.getTranslation().x;
    expect(parked, closeTo(37, 1), reason: 'mid-way along the 74px travel');

    await tester.pump(const Duration(milliseconds: 750));
    expect(tester.widget<Transform>(sweep).transform.getTranslation().x, parked,
        reason: 'and it must not move at all');
  });
}