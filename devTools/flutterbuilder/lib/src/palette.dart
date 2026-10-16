/// The app's palette.
///
/// Kept in one place because these values are shared between surfaces that must
/// not drift apart: the Android system splash
/// (`android/app/src/main/res/values/colors.xml`), the Flutter window behind the
/// WebView, the loading screen and the status banner.
///
/// Monochrome on purpose. The story's whole UI is greyscale -- #111 page, #222
/// surfaces, #444 borders, #eee text -- and a coloured element over it reads as a
/// sticker rather than as part of the app. A four-colour mark was tried on the
/// loading screen and rejected for exactly this reason (MEMORY.md trap 24).
///
/// The opacities are the ones the in-page loader and banner used, resolved from
/// `rgba(238,238,238,x)` to bytes, so the screens look the same as the ones that
/// were approved and the values can be checked against the CSS in one glance.
library;

import 'package:flutter/painting.dart';

/// Page background. Matches the story's own `body{background-color:#111}` and
/// the native launch splash, so nothing flashes at any handover.
const Color kSplashBackground = Color(0xFF111111);

/// The story's `#eee` at 16% -- the loading screen's track.
const Color kInkFaint = Color(0x29EEEEEE);

/// At 35% -- the Retry button's outline.
const Color kInkDim = Color(0x59EEEEEE);

/// At 40% -- the failure detail line.
const Color kInkMuted = Color(0x66EEEEEE);

/// At 55% -- the loading label, and the Retry button's text.
const Color kInkSoft = Color(0x8CEEEEEE);

/// At 80% -- the sweeping line.
const Color kInkBright = Color(0xCCEEEEEE);

/// The status banner's plate. Opaque black, carried over from the in-page
/// `<div>` this replaces, which is why the banner reads as a strip over the
/// story rather than as part of it.
const Color kStatusBackground = Color(0xFF000000);

/// Ordinary status text.
const Color kStatusInfo = Color(0xFFB0BEC5);

/// Failure status text. Warm, and the only non-greyscale colour the app draws:
/// it has to be legible as "this did not work" without shouting, and it is what
/// the in-page banner used for the same message.
const Color kStatusError = Color(0xFFFF8A80);