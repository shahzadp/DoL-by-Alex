import 'package:flutter/foundation.dart';

/// Which of the app's load states is current.
///
/// Deliberately small. The page tells us when *it* is busy, the WebView tells
/// us when a document arrives or fails, and everything the player actually
/// sees is derived from those two facts plus a clock.
enum LoadPhase {
  /// A load is under way: startup, the game's Restart, or a passage transition.
  ///
  /// Also the state before anything has been reported, which is the state the
  /// app opens in, so the very first frame already has a loader on it.
  loading,

  /// The story has rendered and is playable.
  ready,

  /// The main document did not arrive, or SugarCube said the story data is
  /// unusable (`data-init="lacking"`). See [LoadModel.detail].
  failed,
}

/// What the story's own document reports, used only as a diagnostic.
///
/// SugarCube's readiness signal is the removal of `data-init` from `<html>`.
/// That is a real signal, but it says nothing about *why* a load is taking so
/// long, and a load that is slow and a load that is dead used to look
/// identical. `document.readyState` is the only thing available on the device
/// that tells them apart, so it is carried through to the label.
class DocumentState {
  const DocumentState(this.value);

  /// Parsed verbatim from the page. Empty when unknown.
  final String value;

  static const DocumentState unknown = DocumentState('');

  bool get isNotEmpty => value.isNotEmpty;
}

/// The single source of truth for the loading screen.
///
/// The screen itself is drawn in Flutter (see load_overlay.dart). This holds
/// only state, with no dependency on a widget, so all of the awkward decisions
/// about when to show, animate and hide a loader are unit tested rather than
/// eyeballed on a device.
///
/// [now] is passed in everywhere instead of read from the clock. A loader is
/// the one piece of UI whose behaviour is entirely about timing, and tests that
/// sleep are tests that flake.
class LoadModel extends ChangeNotifier {
  LoadModel({DateTime? now}) : _since = now ?? DateTime.now();

  /// How long a load must run before the label starts counting.
  ///
  /// Eight seconds. The point is not the number: it is that a healthy first run
  /// (delivery plus parse of a ~50 MB document) finishes just under it on the
  /// device this was measured on, so crossing it means something changed.
  static const Duration slowThreshold = Duration(seconds: 8);

  /// How long a load may run before it is declared stuck.
  ///
  /// A healthy first run is about three seconds on the device this was measured
  /// on. Ninety is not a performance budget, it is the point past which waiting
  /// is worse than stopping: the alternative to this threshold is the loader
  /// sweeping forever, which is what a stalled load used to do and is the one
  /// outcome with no way out of it -- no message, no reason, no Retry button.
  ///
  /// Generous on purpose. A cold first launch on a slow phone, with a 50 MB
  /// document to deliver and parse and a cold page cache, is allowed to be
  /// uncomfortable; it is not allowed to be infinite.
  static const Duration stuckThreshold = Duration(seconds: 90);

  /// How long a load must run before the handover is animated.
  ///
  /// A passage transition is tens of milliseconds. Fading a loader in and out
  /// over 260 ms for something that short would add latency to every single
  /// link the player taps, so a brief load is torn down instantly instead. A
  /// long one is worth a fade because the player was looking at it.
  static const Duration handoverThreshold = Duration(milliseconds: 300);

  LoadPhase _phase = LoadPhase.loading;
  String? _detail;
  DocumentState _document = DocumentState.unknown;
  DateTime _since;
  Duration _upFor = Duration.zero;
  bool _fadeOut = false;
  final List<String> _trail = <String>[];

  LoadPhase get phase => _phase;

  /// Why the load failed, in words the player can act on. Null unless
  /// [phase] is [LoadPhase.failed].
  String? get detail => _detail;

  DocumentState get document => _document;

  /// How long the current load has been running, as far as [tick] knows.
  Duration get elapsed => _upFor;

  /// True once [elapsed] has passed [slowThreshold].
  bool get isSlow => _upFor >= slowThreshold;

  /// Whether the loader should be on screen at all.
  bool get visible => _phase != LoadPhase.ready;

  /// Whether hiding the loader is animated. See [handoverThreshold].
  bool get fadeOut => _fadeOut;

  /// Called when the WebView starts delivering a document.
  void beginLoad(DateTime now) {
    _since = now;
    _upFor = Duration.zero;
    _phase = LoadPhase.loading;
    _detail = null;
    _document = DocumentState.unknown;
    _fadeOut = false;
    _trail.clear();
    reached('load started');
    notifyListeners();
  }

  /// Record that the load got as far as [step].
  ///
  /// The single most useful thing to know about a load that stalled is *how far
  /// it got*, and the difference between the answers is enormous:
  ///
  ///   - nothing at all -- the WebView was never created, or never asked for
  ///     the document at all;
  ///   - first request only -- the interceptor was reached and never answered,
  ///     which is a Dart-side stall;
  ///   - document delivered, page silent -- everything arrived and the glue
  ///     never ran or never got through the bridge;
  ///   - page: loading -- the story is parsing 50 MB and genuinely not done.
  ///
  /// Those are four different bugs that all look identical on screen, which is
  /// why this is recorded and not merely logged: it is shown to the player on
  /// the failure screen, so a single run on a device answers the question with
  /// no adb, no cable and no log to read.
  ///
  /// Does not notify. Every caller is already inside a callback that leads to a
  /// notification, and a load can record several steps per frame.
  void reached(String step) {
    // Bounded. A stuck load can report `page: loading` on every poll, and a
    // list that grows without limit on a failure screen is its own bug.
    if (_trail.length >= maxTrailEntries) return;
    if (_trail.isNotEmpty && _trail.last == step) return;
    _trail.add(step);
  }

  /// How many steps the trail keeps. See [reached].
  static const int maxTrailEntries = 12;

  /// Every step this load reached, oldest first.
  ///
  /// Empty before the first [beginLoad]. Shown on the failure screen, because
  /// "COULD NOT LOAD THE GAME" on its own is a shrug.
  List<String> get trail => List<String>.unmodifiable(_trail);

  /// The step the load is waiting at, or null if nothing has been recorded.
  String? get lastStep => _trail.isEmpty ? null : _trail.last;

  /// Called from the page whenever SugarCube's readiness signal changes.
  ///
  /// This is the same `data-init` attribute the previous in-page loader keyed
  /// on, which is what makes it cover passage transitions and not just
  /// startup. The page is the only thing that knows about transitions; a
  /// WebView load event fires for neither.
  ///
  /// [document] is the page's `document.readyState`, carried through purely for
  /// the slow-load diagnostic.
  void pageBusy({required bool busy, required DateTime now, DocumentState? document}) {
    // Brought up to date before anything reads it. [handoverThreshold] is
    // decided from elapsed time, and an event can arrive between ticks.
    syncClock(now);
    if (document != null) _document = document;

    if (busy) {
      // A passage transition re-arms a loader that had already been handed
      // over. This is the common case: the story sets data-init back to
      // "loading" for every link the player taps, and no WebView callback fires
      // for any of it.
      if (_phase == LoadPhase.ready) {
        _since = now;
        _upFor = Duration.zero;
        _fadeOut = false;
      }
      if (_phase != LoadPhase.loading) {
        _phase = LoadPhase.loading;
        _detail = null;
        notifyListeners();
      }
      return;
    }

    if (_phase == LoadPhase.failed) {
      // A failure the player can retry from is not cleared by the document
      // finishing; keep the reason on screen until they act on it.
      return;
    }

    _phase = LoadPhase.ready;
    _fadeOut = _upFor >= handoverThreshold;
    notifyListeners();
  }

  /// Called when the main document cannot be delivered.
  ///
  /// Never a silent outcome: this used to leave the player looking at a sweep
  /// that meant nothing, which is indistinguishable from a slow device.
  void fail(String detail, DateTime now) {
    syncClock(now);
    _phase = LoadPhase.failed;
    _detail = detail.trim().isEmpty ? 'unknown error' : detail.trim();
    _fadeOut = false;
    notifyListeners();
  }

  /// Advance the clock. Driven by a timer in the overlay, not by frames, so a
  /// 120 Hz display does not tick a second counter 120 times.
  void tick(DateTime now) {
    _upFor = now.difference(_since);

    // The watchdog. A load that has run this long is not slow, it is stuck, and
    // an indefinite sweep is the worst thing this screen can do: it says
    // nothing, offers nothing, and cannot be dismissed.
    //
    // Checked here rather than on a second timer because tick only runs while a
    // loader is actually on screen, which is exactly when this matters.
    if (_phase == LoadPhase.loading && _upFor >= stuckThreshold) {
      // The steps are on the screen underneath this (see [trail]), so the
      // message does not repeat the last one -- two lines saying the same
      // thing reads as a bug rather than as evidence.
      fail('stopped after ${stuckThreshold.inSeconds}s', now);
      return;
    }

    notifyListeners();
  }

  /// Snap the clock forward without notifying.
  ///
  /// Used before an event that decides [fadeOut], so the decision is made
  /// against an up-to-date elapsed time even if it arrives between ticks.
  void syncClock(DateTime now) => _upFor = now.difference(_since);
}