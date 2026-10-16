import 'dart:async';

import 'package:flutter/material.dart';

import 'palette.dart';

/// How serious a status message is. Only two levels, because there are only
/// two things this app ever has to say and both are greyscale or near it.
enum StatusSeverity {
  /// Something the player should notice: a save that did not happen.
  info,

  /// The same, but held on screen twice as long.
  error,
}

/// One line of app-level messaging.
class StatusMessage {
  StatusMessage(this.text, {this.severity = StatusSeverity.info})
      : token = _nextToken++;

  final String text;
  final StatusSeverity severity;

  /// Identity, so the banner can tell a *new* message from a re-notification of
  /// the same one and animate only when the text actually changed.
  final int token;

  static int _nextToken = 0;

  @override
  String toString() => 'StatusMessage(${severity.name}: $text)';
}

/// Holds the current status message and decides how long it stays.
///
/// This replaces a fixed-position `<div>` written into the page by the injected
/// script. That existed for a good reason -- it was reporting failures of the
/// bridge it needed in order to report anything at all, so it had to work with
/// no bridge -- and this keeps the good part while dropping the rest. Being a
/// widget means it animates, and because it lives in the Flutter tree rather
/// than at `position:fixed;bottom:0` it is not drawn underneath the navigation
/// bar, which is where the old one always ended up.
class StatusModel extends ChangeNotifier {
  StatusModel({this.infoFor = defaultInfoFor, this.errorFor = defaultErrorFor});

  /// Long enough to read a sentence about a save that failed, short enough that
  /// it is not covering the story on the next tap.
  static const Duration defaultInfoFor = Duration(seconds: 5);

  /// Twice as long. The messages worth this long are the ones describing a
  /// failure the player may want to read twice before dismissing it.
  static const Duration defaultErrorFor = Duration(seconds: 12);

  /// Overridable so a test does not have to sit through either of these.
  final Duration infoFor;
  final Duration errorFor;

  StatusMessage? _current;
  Timer? _timer;

  StatusMessage? get current => _current;

  void show(String text, {StatusSeverity severity = StatusSeverity.info}) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    _timer?.cancel();
    _current = StatusMessage(trimmed, severity: severity);
    _timer = Timer(severity == StatusSeverity.error ? errorFor : infoFor, clear);
    notifyListeners();
  }

  /// Dismiss now. Called by the timer, and available to the shell for anything
  /// that wants a message out of the way sooner.
  void clear() {
    if (_timer == null && _current == null) return;
    _timer?.cancel();
    _timer = null;
    if (_current == null) return;
    _current = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

/// The status message, drawn by Flutter.
///
/// Monochrome, and deliberately so: the story's UI is greyscale and a coloured
/// banner over it reads as a sticker (MEMORY.md trap 24). The two text colours
/// are carried over exactly from the in-page banner it replaces, so a failure
/// still looks like the failure the player has seen before.
class StatusBanner extends StatefulWidget {
  const StatusBanner({super.key, required this.model});

  final StatusModel model;

  @override
  State<StatusBanner> createState() => _StatusBannerState();
}

class _StatusBannerState extends State<StatusBanner> {
  static const Duration _duration = Duration(milliseconds: 200);

  /// The last non-null message, kept so the exit animation has something to
  /// animate. Clearing the text at the same moment as fading it out looks like
  /// a glitch.
  StatusMessage? _shown;

  @override
  void initState() {
    super.initState();
    _shown = widget.model.current;
    widget.model.addListener(_onChanged);
  }

  @override
  void didUpdateWidget(covariant StatusBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.model, widget.model)) {
      oldWidget.model.removeListener(_onChanged);
      widget.model.addListener(_onChanged);
    }
  }

  @override
  void dispose() {
    widget.model.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    final current = widget.model.current;
    if (current != null) _shown = current;
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final message = widget.model.current ?? _shown;
    if (message == null) return const SizedBox.shrink();

    final visible = widget.model.current != null;

    return AnimatedSlide(
      offset: visible ? Offset.zero : const Offset(0, 0.35),
      duration: _duration,
      curve: Curves.easeOut,
      child: AnimatedOpacity(
        opacity: visible ? 1 : 0,
        duration: _duration,
        child: ColoredBox(
          color: kStatusBackground,
          child: Padding(
            // The in-page banner's 10px 12px padding, kept so lines break in the
            // same places.
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Text(
              message.text,
              style: TextStyle(
                // monospace, like the CSS it replaces, so a stack trace reads
                // as one and the metrics match what the player has seen.
                fontFamily: 'monospace',
                fontFamilyFallback: const <String>['monospace', 'Droid Sans Mono'],
                fontSize: 12,
                height: 1.4,
                color: message.severity == StatusSeverity.error
                    ? kStatusError
                    : kStatusInfo,
              ),
            ),
          ),
        ),
      ),
    );
  }
}