# Phase 8: Assets, Delivery & Load Optimization Audit

> Status: Complete
> Baseline HEAD: `737b155` (`chore: add Google site verification`)
> Final Post-Purge Status: Verified & Approved
> Repository: `travelers-toolkit`

---

## 1. Executive Summary

Phase 8 optimizes static asset delivery, reduces network transfer payload, improves font loading and rendering behavior, and tightens static delivery caching without modifying application business logic, store persistence, API contracts, OAuth workflows, or visual fidelity.

Key objectives and verified outcomes:
1. **F-004: Font Delivery Optimization**: Converted oversized `public/fonts/genshin-font.ttf` (~11.45 MB) to a compact WOFF2 asset (`public/fonts/genshin-font.woff2`, 28,144 bytes, **99.75% reduction**) with proven 100% glyph coverage across all canonical game data, UI strings, and legal pages. Legacy TTF deleted.
2. **Background Image Delivery**: Optimized `public/bg.png` (1.84 MB, 1920x1080) to a high-fidelity WebP asset (`public/bg.webp`, 71,456 bytes, **96.11% reduction**, PSNR: 44.73 dB). Manual browser review accepted the visual result. Legacy PNG deleted.
3. **Oversized Static Asset Remediation**: Cleaned corrupted trailing junk payloads from navigation PNG icons (`Planner.png`, `Dashboard.png`, `Weapons.png`, `Forging.png`), achieving an immediate ~1.15 MB savings while retaining 100% pixel-identical lossless RGBA data.
4. **Google Fonts Delivery Audit**: Removed unused `Inter` family (5 unused requested weights) from `index.html` while retaining required `Cinzel` serif display font weights (400, 600, 700).
5. **Preload & Delivery Hints**: Preloaded critical above-the-fold `genshin-font.woff2` to eliminate FOUT and layout shifts while preserving preconnect hints.
6. **Preservation Invariants**: Strict byte-for-byte preservation of the Google Search Console verification meta tag in `index.html`. Direct SPA routes (`/`, `/privacy`, `/terms`, `/settings`, `/characters`) validated.

---

## 2. Baseline Static Asset Inventory (Pre-Implementation)

The following inventory details all static assets in `public/` and `src/assets/` sorted descending by raw file size, measured directly on disk at baseline HEAD `737b155`:

| Rank | Path | Type | Raw Size (Bytes) | Human Size | Loading Context / Reference | Initial Load? | Opportunity / Issue | Classification |
| :---: | :--- | :---: | :---: | :---: | :--- | :---: | :--- | :---: |
| 1 | `public/fonts/genshin-font.ttf` | `.ttf` | 11,451,456 | 10.92 MB | `src/index.css` (`@font-face`) | Yes (Global) | 33,965 glyphs (mostly CJK). Convert to Latin+symbols WOFF2 subset (~28 KB). | **P2** |
| 2 | `public/bg.png` | `.png` | 1,835,908 | 1.75 MB | `src/layouts/AppLayout.jsx` (`bg-[url('/bg.png')]`) | Yes (Global) | 1920x1080 RGB without alpha under 70% dark blend overlay. WebP conversion saves >96%. | **P2** |
| 3 | `public/Planner.png` | `.png` | 689,780 | 673.6 KB | `src/layouts/AppLayout.jsx`, `src/pages/Planner.jsx` | Yes (Sidebar) | 100x100 RGBA icon containing 676.7 KB of corrupted trailing bytes after `IEND`. Truncating recovers 98% losslessly. | **P2** |
| 4 | `public/Dashboard.png` | `.png` | 245,069 | 239.3 KB | `src/layouts/AppLayout.jsx`, `src/pages/Dashboard.jsx` | Yes (Sidebar) | 100x100 RGBA icon containing 236.2 KB of corrupted trailing bytes after `IEND`. Truncating recovers 96% losslessly. | **P2** |
| 5 | `public/Weapons.png` | `.png` | 233,360 | 227.9 KB | `src/layouts/AppLayout.jsx`, `src/pages/Weapons.jsx` | Yes (Sidebar) | 100x100 RGBA icon containing 220.3 KB of corrupted trailing bytes after `IEND`. Truncating recovers 94% losslessly. | **P2** |
| 6 | `public/Forging.png` | `.png` | 26,587 | 26.0 KB | `src/pages/Weapons.jsx` | No (Tab) | 100x100 RGBA icon containing 10.4 KB trailing bytes after `IEND`. | **P3** |
| 7 | `public/Characters.png` | `.png` | 17,780 | 17.4 KB | `src/layouts/AppLayout.jsx`, `src/pages/Characters.jsx` | Yes (Sidebar) | 100x100 RGBA clean icon. | **P4** |
| 8 | `public/favicon.svg` | `.svg` | 16,764 | 16.4 KB | `public/favicon.svg` | Yes (Head) | Vector favicon. | **P4** |
| 9 | `public/logo.svg` | `.svg` | 16,764 | 16.4 KB | `index.html`, `src/layouts/AppLayout.jsx` | Yes (Header) | Primary brand SVG logo. Lightweight and vector crisp. | **P4** |
| 10 | `public/Inventory.png` | `.png` | 13,746 | 13.4 KB | `src/layouts/AppLayout.jsx` | Yes (Sidebar) | 100x100 RGBA clean icon. | **P4** |
| 11 | `public/CurrencyExp.png` | `.png` | 7,601 | 7.4 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 12 | `public/WeaponAscMats.png` | `.png` | 6,884 | 6.7 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 13 | `public/CrownOfInsight.png`| `.png` | 6,718 | 6.6 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 14 | `public/HerosWit.png` | `.png` | 6,685 | 6.5 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 15 | `public/TalentMats.png` | `.png` | 6,212 | 6.1 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 16 | `public/CommonEnemy.png` | `.png` | 5,598 | 5.5 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 17 | `public/LocalSpecialties.png`| `.png` | 5,152 | 5.0 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 18 | `public/WeeklyBoss.png` | `.png` | 5,054 | 4.9 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 19 | `public/NormalBoss.png` | `.png` | 4,834 | 4.7 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 20 | `public/Gems.png` | `.png` | 4,243 | 4.1 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 21 | `public/EliteEnemy.png` | `.png` | 3,869 | 3.8 KB | Category material icon | Lazy | 128x128 palette PNG. Small. | **P4** |
| 22 | `public/vercel.json` | `.json` | 143 | 0.1 KB | Deployment configuration | No | Static config. | **P4** |

Total baseline `dist` output size: **16,481,240 bytes (15.72 MB)**.

---

## 3. Font Delivery, Glyph Coverage & Fallback Behavior

### 3.1 Font Inspection
- **Source File**: `public/fonts/genshin-font.ttf`
- **Family**: `SDK_JP_Web` (Heavy / 85W, Beijing HANYI KEYIN Information Technology Co.)
- **Original Size**: 11,451,456 bytes
- **Glyph Count**: 33,965 glyphs
- **CMap Size**: 33,964 characters
- **Weight**: Single font face (OS/2 `usWeightClass: 400`, styled `font-weight: normal`)
- **Reason for Bloat**: Contains full Japanese / Chinese / CJK ideograph sets (over 28,000 Hanzi/Kanji glyphs and Hangul syllables) despite Traveler's Toolkit being an English application.

### 3.2 Exact Deterministic Inclusion Strategy & Range Analysis
The subset generator (`scripts/build-font-subset.py`) employs a deterministic intersection strategy:
1. **Target Candidate Ranges**:
   - Basic Latin (`0x0020`–`0x007E`): 95 codepoints (100% complete in base font and WOFF2).
   - Latin-1 Supplement (`0x00A0`–`0x00FF`): 96 codepoints (100% complete in base font and WOFF2).
   - Candidate ranges for Latin Extended-A, Latin Extended-B, IPA Extensions, Spacing Modifiers, General Punctuation, Currency, Letterlike/Number Forms, Arrows, Math, Geometric Shapes, and Symbols.
2. **Base Font Filtering**: The base font physically contained only 355 Latin and punctuation characters total across all Unicode blocks.
3. **App Domain Scanning**: Analyzed all repository source and canonical data files (`characters.json`, `weapons.json`, `achievements/*.json`, materials, `PrivacyPolicy.jsx`, `TermsOfService.jsx`).
4. **Intersection & Union**: The subset contains **every single Latin/punctuation character supported by the base font** (355 codepoints) plus all scanned app domain characters.
5. **Emoji/Dingbat Segregation**: Standard emojis (⚙️, ☁️, ⚠️, 📜, ⚖️) are excluded from the font subset and handled by native system fallback fonts.

### 3.3 Glyph Coverage Results
- **Generated WOFF2 CMap Count**: **355 codepoints** (362 font glyphs including `.notdef`)
- **Required App Domain Codepoints (supported by base font)**: **122 codepoints**
- **Missing Required Codepoints**: **0** (100% verified coverage)
- **Base Font Status**: Permanently removed (`public/fonts/genshin-font.ttf` deleted) following manual browser sign-off.
- **WOFF2 File Size**: **28,144 bytes (27.48 KB)** — **`99.75%` reduction** vs base TTF.

### 3.4 Fallback Behavior for Arbitrary / User-Generated Text
The application font stack is declared in `src/index.css` and `tailwind.config.js` as:
```css
font-family: 'GenshinFont', sans-serif !important;
```
Characters not present in GenshinFont fall through to the browser/platform's generic sans-serif fallback; emoji use the platform's normal fallback/emoji font chain. This ensures characters render cleanly without tofu squares or layout errors.

---

## 4. Background Image Audit & Optimization

### 4.1 Image Inspection
- **Source File**: `public/bg.png`
- **Dimensions**: 1920 x 1080
- **Color Mode**: 24-bit RGB (no alpha channel)
- **Original Size**: 1,835,908 bytes (1.75 MB)
- **Usage**: Full-page background rendered with `bg-[#030712]/70 bg-blend-overlay bg-cover bg-fixed` in `AppLayout.jsx`.

### 4.2 WebP Quality & PSNR Evaluation
We tested candidate WebP quality levels and computed objective Peak Signal-to-Noise Ratio (PSNR) against the original 1920x1080 image:
- `quality=95`: 131,536 bytes (128.5 KB) | PSNR: 45.92 dB | 92.8% reduction
- **`quality=90` (Selected)**: **71,456 bytes (69.8 KB) | PSNR: 44.73 dB | 96.11% reduction**
- `quality=85`: 51,034 bytes (49.8 KB) | PSNR: 43.45 dB | 97.2% reduction
- `lossless`: 1,417,702 bytes (1.35 MB) | PSNR: inf dB | 22.8% reduction

PSNR was 44.73 dB; manual visual review accepted the result.
Original `public/bg.png` has been permanently deleted from the repository.

---

## 5. Cleaned Navigation Icons Validation

Navigation PNG icons were re-validated after truncating corrupted trailing bytes following `IEND`:
- `Planner.png`: 689,780 → 12,808 bytes (**98.14% reduction**)
- `Dashboard.png`: 245,069 → 8,296 bytes (**96.61% reduction**)
- `Weapons.png`: 233,360 → 12,564 bytes (**94.62% reduction**)
- `Forging.png`: 26,587 → 15,902 bytes (**40.19% reduction**)

**Validation Confirmation**:
- All 4 files parse successfully as valid PNGs.
- Dimensions remain exactly 100x100.
- Decoded RGBA pixel data is 100% identical to the pre-cleanup source.
- 0 trailing bytes after `IEND`.
- Bandwidth saved: **1,146,804 bytes (~1.15 MB)**.

---

## 6. Google Fonts & Resource Hints Audit

### 6.1 `index.html` Analysis
- Unused `Inter` family (weights 300, 400, 500, 600, 700) removed from Google Fonts request.
- Retained `Cinzel` serif display font with required weights (400, 600, 700). Unused weight 500 removed.
- Preconnect hints to `fonts.googleapis.com` and `fonts.gstatic.com` retained.

### 6.2 Font Preloading
Added high-priority preload link for `/fonts/genshin-font.woff2` in `index.html`. Preloading this 28 KB file eliminates FOUT and CLS during initial page load.

### 6.3 Google Site Verification Invariant
Google site verification meta tag preserved byte-for-byte in `index.html`.

---

## 7. Delivery & Caching Strategy

1. **Vite Bundled Hashed Assets (`/assets/*`)**: Vercel applies `Cache-Control: public, max-age=31536000, immutable`.
2. **Unhashed Static Assets (`/fonts/*`, `/bg.webp`, `/logo.svg`)**: Revalidated under standard Vercel edge caching.
3. **HTML Entrypoint (`index.html`)**: Never cached immutably, ensuring instantaneous deployment updates.
4. **Backend API Endpoints**: Retain strict `Cache-Control: no-store, private`.

---

## 8. Font Artifact Verification & Integrity Script

The optimized webfont `public/fonts/genshin-font.woff2` is preserved as a checked-in static asset in the repository. The original uncompressed source font (`genshin-font.ttf`, ~11.5 MB) was intentionally purged from the repository following Phase 8 optimization to eliminate oversized assets. Because the original source file is no longer checked in, the font script functions as a **validation/checker-only** script in standard operation:

`scripts/build-font-subset.py`:
- **Validation / Checker Role (Default & `--check`)**:
  - Validates `public/fonts/genshin-font.woff2` exists, is readable, and is well-formed.
  - Verifies 100% glyph coverage across all repository code and canonical data files (0 missing codepoints).
  - Exits with status 0 on success.
- **External Generation Mode (`--source-ttf <path>`)**:
  - Re-subsetting is only possible if a developer manually provides an external base TTF file.

---

## 9. Final Build Metrics & Transfer Reduction Summary

### 9.1 Active Initial Page Load Static Transfer Payload

| Asset Category | Pre-Optimization Bytes | Post-Purge Bytes | Reduction (Bytes) | Reduction (%) |
| :--- | :---: | :---: | :---: | :---: |
| **Primary Sans Font (`genshin-font`)** | 11,451,456 (TTF) | 28,144 (WOFF2) | -11,423,312 | **-99.75%** |
| **Full Page Background Image (`bg`)** | 1,835,908 (PNG) | 71,456 (WebP) | -1,764,452 | **-96.11%** |
| **Navigation Icons (`Planner`, `Dashboard`, `Weapons`)** | 1,168,209 (Corrupted PNG) | 33,668 (Clean PNG) | -1,134,541 | **-97.12%** |
| **Total Active Static Delivery Payload** | **14,455,573 bytes (~14.46 MB)** | **133,268 bytes (~133 KB)** | **-14,322,305 bytes** | **-99.08%** |

### 9.2 Build Output (`dist/`) Deployment Statistics

- **Total `dist` Size (Pre-Optimization Baseline)**: 16,481,240 bytes (15.72 MB)
- **Total `dist` Size (Final Post-Purge Output)**: **2,148,371 bytes (2.05 MB)**
- **Total `dist` Size Reduction**: **14,332,869 bytes (-86.96%)**
- **JS Bundles**: Unchanged (44.2 kB gzip critical index chunk; total JS runtime identical)
- **CSS Bundle**: 86.2 kB (15.9 kB gzip)

### 9.3 Top 10 Largest Public / Dist Assets After Purge

| Rank | Asset Path | Type | Raw Size (Bytes) |
| :---: | :--- | :---: | :---: |
| 1 | `public/bg.webp` | `.webp` | 71,456 |
| 2 | `public/fonts/genshin-font.woff2` | `.woff2` | 28,144 |
| 3 | `public/Characters.png` | `.png` | 17,780 |
| 4 | `public/favicon.svg` | `.svg` | 16,764 |
| 5 | `public/logo.svg` | `.svg` | 16,764 |
| 6 | `public/Forging.png` | `.png` | 15,902 |
| 7 | `public/Inventory.png` | `.png` | 13,746 |
| 8 | `public/Planner.png` | `.png` | 12,808 |
| 9 | `public/Weapons.png` | `.png` | 12,564 |
| 10 | `public/Dashboard.png` | `.png` | 8,296 |

---

## 10. Validation Matrix & Status

| Validation Check | Command / Procedure | Result | Notes |
| :--- | :--- | :---: | :--- |
| **User Manual Browser Validation** | Manual visual inspection by user | **PASSED** | Visual fidelity accepted across all views |
| **Font Subset Integrity** | `python scripts/build-font-subset.py --check` | **PASS (0 missing)** | 355 codepoints; 0 missing across app domain |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (code 0)** | Zero type errors |
| **Frontend Test Suite** | `npm run test:run` | **PASS (52/52 files, 523/523 tests)** | All store, router, component, and asset tests pass |
| **Achievement Generator** | `node scripts/update-achievements.mjs --check` | **PASS (code 0)** | Static achievement data verified up-to-date |
| **HoYoLAB Map Generator** | `node scripts/update-hoyolab-map.mjs --check` | **PASS (code 0)** | Pinned mappings intact |
| **Production Build** | `npm run build` | **PASS (code 0)** | Clean build in 4.64s |
| **Git Working Tree Hygiene**| `git diff --check` | **CLEAN** | No whitespace or newline issues |
| **Google Verification Meta**| Inspection of `index.html` line 12 | **PASS** | Byte-for-byte preserved; token unexposed |
