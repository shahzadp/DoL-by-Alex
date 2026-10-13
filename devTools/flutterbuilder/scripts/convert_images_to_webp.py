"""
Re-encode the game's PNG artwork as lossless WebP, in place.

Why the filenames stay .png
---------------------------
The story does not reference images by literal path. Of 4,458 ".png" strings in
the compiled html, only 346 are literal `img/....png`; the rest are assembled at
runtime, e.g. `${options.src}/${options.state}.png` and
`"img/sex/xrayvaginalhorse" + cum + ".png"`. Renaming the files to .webp would
mean rewriting a 50 MB document by regex, and any reference that is not caught
is an image that silently fails to load.

Writing WebP bytes under the .png name avoids that entirely: nothing in the html
changes, so no reference can break. Browsers select an image decoder by sniffing
the bytes, not by the extension or the Content-Type, so this renders correctly.

Lossless, not lossy
-------------------
Measured on 400 real files from this tree: lossless is 58.5% smaller, while
quality 90 is 30% *larger* than the PNG and quality 75 is still 2% larger. These
are alpha-heavy painted illustrations, and lossy WebP handles their alpha badly.
Lossless is also pixel-identical, which is what makes "behaves exactly like the
PNG" true rather than merely likely.

GIFs are left alone. They are the only animated assets in the game, and at
0.85 MB there is nothing to win against the risk of altering timing or looping.
"""
from __future__ import annotations

import json
import os
import shutil
import sys
import time

from PIL import Image

ROOT = sys.argv[1]
TARGET = sys.argv[2] if len(sys.argv) > 2 else ROOT

# Kept beside the staged tree rather than inside it: assets/web/img/ is walked
# for images, and a manifest sitting in there would be listed as an asset.
MANIFEST = os.path.join(os.path.dirname(os.path.abspath(TARGET)), ".webp-manifest.json")
MODE = sys.argv[3] if len(sys.argv) > 3 else "lossless"

# Pillow maps this to libwebp's method 0-6. 4 is a good speed/size balance;
# 6 squeezes the last few percent for minutes of extra build time over 18k files.
METHOD = 4


def is_animated_png(path: str) -> bool:
    """True for APNG.

    An animated png carries an `acTL` chunk, which must appear among the first
    few chunks. Re-encoding one as still webp would freeze the illustration in
    whatever frame happens to be first, so these must be skipped rather than
    trusted. There are none in this tree -- verified -- but the check is cheap
    and the failure it prevents is invisible.
    """
    with open(path, "rb") as fh:
        head = fh.read(256)
    return b"acTL" in head


def load_manifest() -> dict:
    try:
        with open(MANIFEST, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def save_manifest(manifest: dict) -> None:
    # Written last, and whole, so an interrupted run leaves the previous manifest
    # intact rather than a truncated one that would claim work was done.
    tmp = MANIFEST + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, separators=(",", ":"))
    os.replace(tmp, MANIFEST)


def prepare_mode(im: Image.Image) -> Image.Image:
    """Preserve alpha where it exists; do not invent it where it does not."""
    if im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info:
        return im.convert("RGBA")
    if im.mode == "RGB":
        return im
    if im.mode == "L":
        return im
    return im.convert("RGBA")


def main() -> int:
    if MODE == "off":
        print("webp: disabled (DOL_WEBP=off)")
        return 0

    manifest = load_manifest()
    started = time.time()

    total = converted = skipped = failed = animated = 0
    before = after = 0

    # Walk the *source* tree. Reading from the staged copy instead would find
    # nothing at all on a clean build, since syncDir deliberately leaves pngs to
    # this step and therefore never puts them there.
    for dirpath, _dirs, files in os.walk(ROOT):
        for name in files:
            if not name.lower().endswith(".png"):
                continue

            src = os.path.join(dirpath, name)
            rel = os.path.relpath(src, ROOT).replace(os.sep, "/")
            dest = os.path.join(TARGET, rel)
            total += 1

            try:
                stamp = os.stat(src).st_mtime_ns
            except OSError:
                continue

            # Already produced from exactly this source? Then leave it alone.
            if manifest.get(rel) == stamp and os.path.exists(dest):
                skipped += 1
                before += os.path.getsize(src)
                after += os.path.getsize(dest)
                continue

            if is_animated_png(src):
                # Copy the original bytes untouched and stop tracking it, so it
                # is re-examined next time rather than assumed done.
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copyfile(src, dest)
                manifest.pop(rel, None)
                animated += 1
                skipped += 1
                before += os.path.getsize(src)
                after += os.path.getsize(dest)
                continue

            src_bytes = os.path.getsize(src)
            before += src_bytes
            try:
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                with Image.open(src) as im:
                    im.load()
                    out = prepare_mode(im)
                    # Written to a sibling temp file and moved into place, so an
                    # interrupted run cannot leave a half-written image that the
                    # next build would consider done.
                    tmp = dest + ".tmp"
                    out.save(tmp, "WEBP", lossless=True, method=METHOD, exact=True)
                    os.replace(tmp, dest)
            except Exception as exc:  # noqa: BLE001
                # A failed conversion must degrade to "this one image is a png",
                # never to "this image is missing".
                try:
                    shutil.copyfile(src, dest)
                except OSError:
                    pass
                failed += 1
                manifest.pop(rel, None)
                print(f"  FAILED {rel}: {exc}")
                continue

            after += os.path.getsize(dest)
            manifest[rel] = stamp
            converted += 1
            if converted % 2000 == 0:
                print(f"  {converted} converted...", flush=True)

    save_manifest(manifest)

    delta = (after - before) / before * 100 if before else 0.0
    print(
        f"webp: {total} png, {converted} converted, {skipped} unchanged, "
        f"{failed} failed, {animated} animated(kept as png)"
    )
    print(
        f"webp: {before / 1024 / 1024:.2f} MB -> {after / 1024 / 1024:.2f} MB "
        f"({delta:+.1f}%) in {time.time() - started:.0f}s"
    )

    if failed:
        print(f"webp: WARNING {failed} file(s) stayed png")
    return 0


if __name__ == "__main__":
    sys.exit(main())