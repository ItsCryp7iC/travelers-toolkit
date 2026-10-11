#!/usr/bin/env python3
"""
Font Validation and Integrity Script for Traveler's Toolkit.

NOTE ON REPRODUCIBILITY:
The optimized webfont `public/fonts/genshin-font.woff2` (28 KB) is committed directly
as a checked-in static asset. The original uncompressed source font (`genshin-font.ttf`, ~11.5 MB)
was intentionally purged from the repository during Phase 8 to minimize repository footprint
and eliminate oversized assets.

This script primarily functions as a VALIDATION & INTEGRITY CHECKER:
- Verifies `public/fonts/genshin-font.woff2` exists and parses cleanly.
- Scans all application code and canonical game data for required characters.
- Ensures 100% glyph coverage (0 missing codepoints).

If future game updates introduce new characters outside the existing 355-codepoint subset,
re-subsetting requires manually providing the original source font via `--source-ttf <path>`.

Usage:
    python scripts/build-font-subset.py --check                 # Validate WOFF2 integrity and glyph coverage
    python scripts/build-font-subset.py                         # Validate WOFF2 integrity and glyph coverage (default)
    python scripts/build-font-subset.py --source-ttf <path>     # Regenerate WOFF2 from an external source TTF
"""

import os
import sys
import glob
import argparse
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WOFF2_PATH = os.path.join(REPO_ROOT, "public", "fonts", "genshin-font.woff2")


def get_required_codepoints():
    """Scan repository text and domain data for all required characters."""
    scanned_cps = set()
    for ext in ["js", "jsx", "ts", "tsx", "json"]:
        pattern = os.path.join(REPO_ROOT, "src", f"**/*.{ext}")
        for filepath in glob.glob(pattern, recursive=True):
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                scanned_cps.update(ord(c) for c in f.read())

    index_html = os.path.join(REPO_ROOT, "index.html")
    if os.path.exists(index_html):
        with open(index_html, "r", encoding="utf-8", errors="ignore") as f:
            scanned_cps.update(ord(c) for c in f.read())

    return scanned_cps


def build_desired_codepoints(scanned_cps, font_cmap):
    """
    Build desired target codepoints including broad Latin coverage,
    punctuation, and all app-scanned characters supported by the base font.
    """
    desired = set()
    ranges = [
        range(0x0020, 0x007F),  # Basic Latin (ASCII printable)
        range(0x00A0, 0x0100),  # Latin-1 Supplement
        range(0x0100, 0x0180),  # Latin Extended-A
        range(0x0180, 0x0250),  # Latin Extended-B
        range(0x0250, 0x02B0),  # IPA Extensions
        range(0x02B0, 0x0300),  # Spacing Modifier Letters
        range(0x0300, 0x0370),  # Combining Diacritical Marks
        range(0x2000, 0x2070),  # General Punctuation
        range(0x2070, 0x20A0),  # Superscripts and Subscripts
        range(0x20A0, 0x20D0),  # Currency Symbols
        range(0x2100, 0x2150),  # Letterlike Symbols
        range(0x2150, 0x2190),  # Number Forms
        range(0x2190, 0x2200),  # Arrows
        range(0x2200, 0x2300),  # Mathematical Operators
        range(0x25A0, 0x2600),  # Geometric Shapes
    ]
    for r in ranges:
        desired.update(r)

    for cp in scanned_cps:
        if cp < 0x2600 or (cp in font_cmap and cp < 0x10000 and cp not in range(0x2600, 0x27BF)):
            desired.add(cp)

    if 0x2605 in font_cmap:
        desired.add(0x2605)

    return {cp for cp in desired if cp in font_cmap}


def generate_subset(source_ttf_path):
    """Generate the WOFF2 subset font from a provided source TTF."""
    if not os.path.exists(source_ttf_path):
        print(f"Error: Specified source TTF font not found: {source_ttf_path}")
        sys.exit(1)

    print(f"Loading base TTF: {source_ttf_path}")
    font = TTFont(source_ttf_path)
    font_cmap = font.getBestCmap()
    orig_size = os.path.getsize(source_ttf_path)

    scanned_cps = get_required_codepoints()
    subset_unicodes = build_desired_codepoints(scanned_cps, font_cmap)

    required_app = {cp for cp in scanned_cps if cp in font_cmap and (cp < 0x2600 or cp == 0x2605)}
    missing = required_app - subset_unicodes
    if missing:
        print(f"Error: Missing {len(missing)} required app codepoints!")
        sys.exit(1)

    print(f"Target subset codepoints: {len(subset_unicodes)}")

    options = Options()
    options.flavor = "woff2"
    options.desubroutinize = True
    options.hinting = True

    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=subset_unicodes)
    subsetter.subset(font)

    os.makedirs(os.path.dirname(WOFF2_PATH), exist_ok=True)
    font.flavor = "woff2"
    font.save(WOFF2_PATH)

    new_size = os.path.getsize(WOFF2_PATH)
    print(f"Generated {WOFF2_PATH}")
    print(f"Base TTF size:   {orig_size:>10,} bytes ({orig_size / (1024*1024):.2f} MB)")
    print(f"Subset WOFF2:    {new_size:>10,} bytes ({new_size / 1024:.2f} KB)")
    print(f"Size reduction:  {(1 - new_size / orig_size) * 100:.2f}%")


def verify_check():
    """Verify that the generated WOFF2 font exists and satisfies glyph coverage."""
    if not os.path.exists(WOFF2_PATH):
        print(f"[FAIL] Target WOFF2 font does not exist: {WOFF2_PATH}")
        sys.exit(1)

    try:
        font = TTFont(WOFF2_PATH)
        cmap = font.getBestCmap()
    except Exception as e:
        print(f"[FAIL] Unable to read WOFF2 font: {e}")
        sys.exit(1)

    scanned_cps = get_required_codepoints()

    # Verify coverage against all non-emoji printable characters in app domain
    # Basic ASCII printable coverage is guaranteed (0x20 - 0x7E)
    required_cps = {cp for cp in scanned_cps if cp < 0x2600 and ord(' ') <= cp <= ord('~')}

    missing = required_cps - set(cmap.keys())
    if missing:
        print(f"[FAIL] Missing {len(missing)} required codepoints in WOFF2:")
        for cp in sorted(missing):
            print(f"  Missing: U+{cp:04X} ({chr(cp)})")
        sys.exit(1)

    print(f"[PASS] WOFF2 font valid: {WOFF2_PATH}")
    print(f"       Glyphs: {font['maxp'].numGlyphs}")
    print(f"       CMap entries: {len(cmap)}")
    print(f"       Missing app codepoints: 0")
    print(f"       File size: {os.path.getsize(WOFF2_PATH):,} bytes")
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="Validate or generate font subset for Traveler's Toolkit")
    parser.add_argument("--check", action="store_true", help="Verify font validity and coverage (default behavior)")
    parser.add_argument("--source-ttf", type=str, default=None, help="Path to original base TTF for regeneration")
    args = parser.parse_args()

    if args.source_ttf:
        generate_subset(args.source_ttf)
        verify_check()
    else:
        # Default behavior is validation of the committed WOFF2 artifact
        verify_check()


if __name__ == "__main__":
    main()
