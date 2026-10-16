import 'dart:async';

import 'package:flutter/material.dart';

import 'load_model.dart';
import 'palette.dart';

/// The loading screen, drawn by Flutter rather than by the page.
///
/// This replaces a loader that used to be a `<div>` injected into the story and
/// animated with CSS. It was never a small thing to be a web view: the player
/// spends the first seconds of every launch looking at it, it had to be
/// injected at character ~1600 of a 50 MB document to beat the parser's
/// stylesheets, and it needed three separate fixes for a flash of SugarCube's
/// stock spinner (MEMORY.md traps 26-30). Drawing it here removes that whole
/// class of problem: there is no DOM to create before `<body>` exists, no
/// specificity to win and no parse race, because the loader is a widget that
/// exists from the very first frame.
///
/// The visuals are unchanged on purpose -- same geometry, same greys, same
/// label -- so this is the screen the player approved, only native. What is new
/// is the part a web view could not do: a failure state with a working Retry
/// button, and a clock that keeps running while it is on screen.
class LoadOverlay extends StatefulWidget {
  const LoadOverlay({super.key, required this.model, required this.onRetry});

  final LoadModel model;

  /// Re-deliver the document. Only offered when [LoadPhase.failed].
  final VoidCallback onRetry;

  @override
  State<LoadOverlay> createState() => _LoadOverlayState();
}

class _LoadOverlayState extends State<LoadOverlay> with SingleTickerProviderStateMixin {
  /// Geometry, unchanged from the CSS this replaces.
  ///
  /// Track 132px, sweep 58px, so the line travels 132 - 58 = 74px. The
  /// sub-pixel radii are the CSS `border-radius:1px` on a 2px-tall bar.
  static const double _trackWidth = 132;
  static const double _trackHeight = 2;
  static const double _sweepWidth = 58;
  static const double _travel = _trackWidth - _sweepWidth;

  /// CSS was `cubic-bezier(.65,.05,.36,1) infinite` over 1.5s. `repeat()` is
  /// the infinite part; [Cubic] is the timing function.
  static const Cubic _curve = Cubic(0.65, 0.05, 0.36, 1);
  static const Duration _sweepPeriod = Duration(milliseconds: 1500);

  /// Long enough to read as a handover rather than a jump cut, short enough
  /// that the player is not made to wait on an animation they triggered.
  static const Duration _handover = Duration(milliseconds: 260);

  /// Driven at 4 Hz rather than per frame: the label counts seconds, and the
  /// handover decision needs finer than that. Per frame would be pure waste on
  /// a 120 Hz panel.
  static const Duration _clockTick = Duration(milliseconds: 250);

  static const Color _trackColor = kInkFaint;
  static const Color _sweepColor = kInkBright;
  static const Color _labelColor = kInkSoft;
  static const Color _detailColor = kInkMuted;
  static const Color _outlineColor = kInkDim;

  /// The sweeping line.
  ///
  /// Deliberately NOT created with `..repeat()`. It is started and stopped with
  /// the loader, and that matters far more than it looks: a handed-over overlay
  /// stays in the tree (at zero opacity, so its fade has something to animate),
  /// so a controller that runs forever means an `AnimatedBuilder` rebuilding
  /// this whole subtree sixty times a second for the entire time the player is
  /// reading the game. It looks like nothing -- the paint is skipped at alpha 0
  /// -- while it dirties the Flutter surface every frame, and that competes with
  /// the WebView for the platform thread and the compositor.
  late final AnimationController _sweep = AnimationController(
    vsync: this,
    duration: _sweepPeriod,
  );

  Timer? _clock;

  /// Cached rather than read in the model listener: `MediaQuery.of(context)`
  /// cannot be called from a notification that may arrive during a build.
  bool _reducedMotion = false;

  /// True once the handover has finished and the overlay has been taken out of
  /// the tree for good. See [build].
  bool _retired = false;

  @override
  void initState() {
    super.initState();
    widget.model.addListener(_onModel);
    _sync();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reducedMotion = MediaQuery.disableAnimationsOf(context);
    _sync();
  }

  @override
  void didUpdateWidget(covariant LoadOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.model, widget.model)) {
      oldWidget.model.removeListener(_onModel);
      widget.model.addListener(_onModel);
    }
    _sync();
  }

  @override
  void dispose() {
    widget.model.removeListener(_onModel);
    _clock?.cancel();
    _sweep.dispose();
    super.dispose();
  }

  void _onModel() => _sync();

  /// Bring the clock and the animation in line with what is on screen.
  ///
  /// Idempotent, because it is called from three places and runs on every model
  /// notification.
  void _sync() {
    // Not the same as [LoadModel.visible]. The failure screen is visible but
    // completely static: it has no track in it and its text does not change. A
    // ticker running behind a screen with nothing to animate is trap 51b one
    // level up, and the failure screen is exactly where a player might sit for a
    // long time -- waiting to decide whether to restart the phone, say.
    final live = widget.model.visible && widget.model.phase != LoadPhase.failed;
    if (live == (_clock != null)) {
      // nothing to do
    } else {
      _clock?.cancel();
      _clock = live ? Timer.periodic(_clockTick, (_) => widget.model.tick(DateTime.now())) : null;
    }

    if (_reducedMotion) {
      // Parked mid-track rather than removed, so the screen still reads as a
      // loader. This used to also be driven by a media query in the CSS, so it
      // is behaviour that carried over rather than a new preference.
      _sweep.stop();
      _sweep.value = 0.5;
      return;
    }

    final wantMotion = live;
    if (wantMotion == _sweep.isAnimating) return;
    if (wantMotion) {
      _sweep.repeat();
    } else {
      _sweep.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final model = widget.model;

    // Everything that depends on the model has to live inside the builder.
    // AnimatedBuilder subscribes to the model but *this* build method does not,
    // so anything decided up here is only ever evaluated when something above
    // LoadOverlay rebuilds -- which, for the duration of a load, is never. A
    // loader that appears on startup and then never again is exactly the sort of
    // thing that looks fine until someone taps a link.
    return AnimatedBuilder(
      animation: Listenable.merge(<Listenable>[model, _sweep]),
      builder: (context, _) {
        // Out of the tree for good once it has finished hiding.
        //
        // A zero-opacity AnimatedOpacity is not free: it is a composited layer
        // the size of the screen, kept alive, sitting on top of the WebView for
        // as long as the app runs. AnimatedOpacity.onEnd is the clean way to
        // know the handover finished, and it fires on the *fade*, not on a
        // post-frame callback -- a callback would land one frame after the fade
        // was asked for and cut it off at zero.
        if (model.visible) {
          _retired = false;
        } else if (_retired || !model.fadeOut) {
          // Either the fade is already done, or there was never one: a load that
          // was over in under a third of a second goes immediately, because a
          // passage transition is tens of milliseconds and a delay here would be
          // added latency on every link the player taps.
          return const SizedBox.shrink();
        }

        return IgnorePointer(
          // A loader covers the page rather than sitting in it, so a tap during
          // a passage transition belongs to the story underneath.
          //
          // The failure screen is the opposite case and has to be spelled out:
          // its Retry button is the only way out of that screen, and a blanket
          // ignoring:true here makes it a dead button on the one screen the
          // player cannot leave any other way. Ignored again once handed over,
          // since an invisible overlay must never take a tap either.
          ignoring: model.phase != LoadPhase.failed,
          child: AnimatedOpacity(
            key: const ValueKey<String>('dol-loading-screen'),
            opacity: model.visible ? 1 : 0,
            duration: model.fadeOut ? _handover : Duration.zero,
            curve: Curves.easeOut,
            onEnd: () {
              if (mounted && !widget.model.visible) setState(() => _retired = true);
            },
            child: ColoredBox(
              // Opaque and full bleed. It covers the notch and the navigation
              // bar as well, so the window is a single colour from launch until
              // the story paints, and there is nothing to flash between.
              color: kSplashBackground,
              child: Center(child: _content(model)),
            ),
          ),
        );
      },
    );
  }

  Widget _content(LoadModel model) {
    if (model.phase == LoadPhase.failed) return _failure(model);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        _track(),
        const SizedBox(height: 24),
        Text(_headline(model), style: _labelStyle),
      ],
    );
  }

  /// The 132x2 bar with its 58px sweep.
  ///
  /// Real children, not pseudo-elements. The CSS version tried `::before` /
  /// `::after` first, and those cannot nest, so both had to be absolutely
  /// positioned -- and absolutely positioned elements are out of flow and
  /// ignore flex `gap`, which put the line on top of the label (trap 25).
  Widget _track() {
    return SizedBox(
      key: const ValueKey<String>('dol-loading-track'),
      width: _trackWidth,
      height: _trackHeight,
      // The CSS had overflow:hidden on the track, so the sweep's rounded ends
      // are clipped instead of allowed to overhang.
      child: ClipRRect(
        borderRadius: BorderRadius.circular(_trackHeight / 2),
        child: Stack(
          children: <Widget>[
            const Positioned.fill(child: ColoredBox(color: _trackColor)),
            // Positioned, not Align + FractionallySizedBox.
            //
            // FractionallySizedBox with a widthFactor and no heightFactor gives
            // its child `tightFor(width: 58)`, whose height is only *bounded* by
            // 0..2 -- and a childless ColoredBox resolves constraints.smallest,
            // so it laid out at 58 x 0. The sweep was invisible and the player
            // saw a bar that did not move, which is exactly what it looked like:
            // a static line. This says 58 wide and as tall as the track, which
            // is what the CSS said too (top:0;bottom:0).
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: _sweepWidth,
              child: AnimatedBuilder(
                animation: _sweep,
                builder: (context, child) => Transform.translate(
                  key: const ValueKey<String>('dol-loading-sweep'),
                  offset: Offset(_curve.transform(_sweep.value) * _travel, 0),
                  child: child,
                ),
                child: const ColoredBox(color: _sweepColor),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _failure(LoadModel model) {
    final trail = model.trail;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text('COULD NOT LOAD THE GAME', style: _labelStyle, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          // The reason, not a shrug. A load that fails and a load that is merely
          // slow used to look identical, which tells the player nothing about
          // which one they are looking at.
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 320),
            child: Text(
              model.detail ?? 'unknown error',
              style: const TextStyle(fontSize: 12, height: 1.5, color: _detailColor, fontFamily: 'monospace'),
              textAlign: TextAlign.center,
            ),
          ),
          // How far it got. This is the part that turns "it did not work" into
          // a diagnosis: the WebView never asking for anything, asking and
          // never being answered, and everything arriving with the page silent
          // are three different bugs that look identical without it.
          if (trail.isNotEmpty) ...<Widget>[
            const SizedBox(height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 320),
              child: Text(
                trail.map((step) => '\u00b7 $step').join('\n'),
                style: const TextStyle(fontSize: 11, height: 1.6, color: _outlineColor, fontFamily: 'monospace'),
                textAlign: TextAlign.left,
              ),
            ),
          ],
          const SizedBox(height: 24),
          // Native, and so something the page could never offer: a way out that
          // does not involve force-stopping the app.
          TextButton(
            onPressed: widget.onRetry,
            style: TextButton.styleFrom(
              foregroundColor: _labelColor,
              backgroundColor: _trackColor,
              side: const BorderSide(color: _outlineColor),
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(2))),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            child: Text('TRY AGAIN', style: _labelStyle),
          ),
        ],
      ),
    );
  }

  /// The word on screen, not a widget.
  String _headline(LoadModel model) {
    if (!model.isSlow) return 'LOADING\u2026';

    // Elapsed time plus readyState: the only on-device signal that separates a
    // slow parse from a document that has stopped making progress.
    final parts = <String>['STILL LOADING', '${model.elapsed.inSeconds} S'];
    if (model.document.isNotEmpty) parts.add(model.document.value.toUpperCase());

    // And the step it is waiting at, so a slow load shows progress rather than
    // just elapsed time. A player watching this for thirty seconds learns
    // nothing from a number going up; they learn a great deal from being told it
    // is still waiting for the document to arrive.
    final step = model.lastStep;
    if (step != null) parts.add(step);
    return parts.join(' \u00b7 ');
  }

  /// 13px, weight 500, 0.18em tracking, uppercase.
  static final TextStyle _labelStyle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    // 0.18em resolved against the font size, exactly as the CSS did.
    letterSpacing: 13 * 0.18,
    color: _labelColor,
  );
}