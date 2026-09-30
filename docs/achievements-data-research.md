# Achievements Data Research

This document outlines the investigation into candidate data sources for the canonical Traveler's Toolkit achievements dataset, leading to schema and identity decisions.

## 1. Candidate Source Matrices

### Comparison Table

| Feature | `genshin-db` (theBowja) | `Dimbreath/AnimeGameData` (Raw) |
| :--- | :--- | :--- |
| **Inspected Version** | Package v5.2.14 (Data covers up to Game v7.1) | Latest |
| **Individual Achievement IDs** | YES (e.g., `id: [80212, 80213]`) | YES (`id: 80001`) |
| **Category IDs** | YES (`achievementGroupId`) | YES (`goalId`) |
| **Name** | YES (Localized) | NO (Requires `TextMap` join via `titleTextMapHash`) |
| **Description** | YES (Localized) | NO (Requires `TextMap` join via `descTextMapHash`) |
| **Reward** | YES (`reward: { id: 201, name: 'Primogem', count: 5 }`) | YES (`finishRewardId: 800001`) (Requires `RewardExcelConfigData` join) |
| **Hidden Flag** | YES (`isHidden: true`) | YES (`isShow: 'SHOWTYPE_HIDE'`) |
| **Version Introduced** | CURATED SECONDARY METADATA (Requires dual-source join) | NO (Must be inferred from file history) |
| **Ordering** | YES (`sortOrder`) | YES (`orderId`) |
| **Localization** | YES (All languages) | YES (Via `TextMap`) |
| **Primary Suitability** | Excellent | Poor (Too raw) |

### Licensing & Provenance

**WARNING:** "genshin-db is MIT" does **not** mean the game data is MIT.
- The `theBowja/genshin-db` and `genshin-db-dist` repositories provide wrapper code/scripts under the MIT License.
- The upstream game data (text, images, IDs) belongs to HoYoVerse (Cognosphere).
- The parsed data originates from `Dimbreath/AnimeGameData` (or similar raw data dumps).
- **Recommendation:** Provide clear attribution in the application stating that game data and assets are the property of HoYoVerse. The generated data files should be considered derivative game data, not MIT-licensed software.

### Rejected Sources

- **Paimon.moe / Seelie.me**: Rejected. We must not scrape their runtime/minified frontend data, nor copy their proprietary code.
- **Raw GenshinData (Dimbreath/Sycamore0)**: Rejected as the *direct* primary source. While it is the ultimate ground truth, it requires heavy joining with `TextMap` and `RewardExcelConfigData`, and lacks explicit `version` metadata fields. `genshin-db` already performs this normalization accurately.

---

## 2. Canonical Identity Decisions

### Individual Achievement Identity
**Decision:** The canonical game achievement numeric ID.

- **Source Field:** `id` in `genshin-db`.
- **GOODScanner Compatibility**: A known Genshin scanner extension (GOODScanner extension to GOOD v3) adds an `"achievements": [80001, 80002, 81001]` array to GOOD exports. 
  - **Semantics**: 
    - Field present (including `[]`): importer replaces achievement completion state.
    - Field omitted: importer preserves existing achievement state.
  - Testing these exact IDs against `genshin-db` yields perfect 1:1 matches to canonical game IDs:
    - `80001` -> "The Wind and The Star Traveler"
    - `80002` -> "Of Mountains High"
    - `81001` -> "The Remains of the Gale"
  This confirms that scanner extensions use the exact same canonical ID space.

### Category Identity & HoYoLAB Mapping
**Decision:** The canonical game category numeric ID.

- **Source Field:** `achievementGroupId` in `genshin-db`.
- **HoYoLAB Mapping:** `set(genshinDbGroupIds) === set(hoyolabIds)`.
  - `genshin-db` exposes exactly 73 categories.
  - HoYoLAB live data returned exactly 73 categories.
  - There are 0 missing IDs on either side and 0 duplicates.
  - Spot checks confirm perfect alignment: `0` = Wonders of the World, `17` = Memories of the Heart, `65` = Mortal Travails: Series VI, `71` = Mortal Travails: Series VII.
- **Schema Impact:** Because `canonicalCategoryId === hoyolabId` for all 73 categories, we do not need a separate `hoyolabId` field today. The canonical category ID itself will serve as the reconciliation ID.
- **Future-Safe Rule:** The updater/reconciliation layer must validate this equality (`set(genshinDbGroupIds) === set(hoyolabIds)`) when updating game data. If a future version diverges, do not silently overwrite canonical IDs; introduce an explicit mapping layer then.

---

## 3. Real Record Examples & Semantics (genshin-db)

### 1. Multi-Stage Achievement Unrolling
`genshin-db` groups multi-stage achievements into arrays. For example, "A Candle in the Wind?" (Group 37):
```json
{
  "id": [ 80212, 80213, 80214 ],
  "name": "A Candle in the Wind?",
  "stages": 3,
  "stage1": { "progress": 30, "reward": { "id": 201, "count": 5 } },
  "stage2": { "progress": 150, "reward": { "id": 201, "count": 10 } },
  "stage3": { "progress": 300, "reward": { "id": 201, "count": 20 } }
}
```
**Decision:** To strictly maintain canonical game identity, we will unroll these arrays. This example will produce three separate canonical achievements (`80212`, `80213`, `80214`) in our persistence layer. UI grouping can be derived later using the shared name.

### 2. Reward Semantics
- **Reward ID 201:** Mapped from `MaterialExcelConfigData.json`, Item 201 is strictly "Primogem".
- **Observed Counts:** Exhaustive inspection of `genshin-db` shows achievement reward counts are strictly one of: `5, 10, 20`.

### 3. Hidden Semantics
- **Flag:** `isHidden` (boolean) correctly represents the in-game hidden status (e.g., "Boared to Death" is `isHidden: true`).
- **Clarification:** `isHidden != !show_percent`. HoYoLAB's `show_percent` governs progress bar visibility, whereas `isHidden` governs whether the achievement is visible in-game prior to completion.

### 4. Version Metadata Semantics
- **Origin:** The `version` metadata (e.g. `version: '7.1'`) is **not** natively serialized inside the `genshin-db-dist` minified achievement JSON arrays.
- **Artifact:** `genshin-db` curates this as secondary metadata located explicitly at `src/data/version/achievements.json` in the `genshin-db` repository. This file is keyed by internal `genshin-db` string identifiers (e.g., `thewindandthestartraveler`), **not** canonical numeric IDs.
- **Deterministic Pipeline:** The generator performs the following strict resolution:
  1. Load pinned `genshin-db-dist` achievement definitions.
  2. Acknowledge each source achievement has both an internal `genshin-db` identifier and canonical numeric game achievement ID(s).
  3. Load curated version metadata keyed by the internal identifier from the pinned `genshin-db` metadata artifact.
  4. Resolve the internal identifier against that SAME pinned source record.
  5. Expand the version onto the canonical numeric ID(s).
  6. Build `canonicalVersionMap` keyed exclusively by canonical numeric ID.
  7. Canonical generation thereafter joins ONLY by canonical ID.
- **Invariants:** Never join by display name. Never fuzzy-match. Unknown version identifiers, duplicate canonical version mappings, and ambiguous mappings must fail the pipeline. The internal string identifier is strictly discarded and never becomes a Traveler's Toolkit identity.
- **Null Fallback:** If the `genshin-db` metadata artifact genuinely lacks a mapping for an identifier, it gracefully falls back to `null` to ensure schema stability without fabricating versions.

### 5. Ordering Semantics
- **Category Order:** Determined by the source-native `sortOrder` field (which dictates in-game category display).
- **Achievement Order:** Determined by the source-native `sortOrder` field.

---

## 4. Proposed Canonical Schema

### Category Schema (`categories.json`)
```typescript
interface AchievementCategoryDefinition {
  id: string;          // Canonical numeric ID cast to string. Also serves as HoYoLAB ID.
  name: string;        // Localized name
  order: number;       // Source-native `sortOrder`
  icon: string;        // `images.filename_icon`
}
```

### Achievement Schema (`achievements.json`)
```typescript
interface AchievementDefinition {
  id: string;          // Canonical Game ID (unrolled from stages)
  categoryId: string;  // Matches category.id
  name: string;        // Localized name
  description: string; // Text description
  primogems: number;   // Integer extracted from reward.count (validated against 5, 10, 20)
  hidden: boolean;     // `isHidden` flag
  version: string;     // Curated metadata (e.g. '1.0', '7.1')
  order: number;       // Source-native `sortOrder`
}
```

### Source Provenance Manifest
The updater must embed a top-level manifest to avoid duplication per record and ensure strict reproducibility.
```json
{
  "schemaVersion": 1,
  "gameVersion": "7.1",
  "source": {
    "definitions": {
      "repository": "theBowja/genshin-db-dist",
      "revision": "371c228cabc9e182995919e595d67409823a0bbe",
      "genshinDbVersion": "5.2.14",
      "groupsSha256": "...",
      "achievementsSha256": "..."
    },
    "metadata": {
      "repository": "theBowja/genshin-db",
      "revision": "fab708f16795231fde199f39ecfb6ffb9eeb0b4e",
      "versionsSha256": "..."
    }
  },
  "artifacts": { ... }
}
```
*Note:* Generation must be perfectly deterministic. Do NOT use current date/time inside deterministic generated data if it makes identical builds differ (e.g. `generatedAt`).

---

## 5. Updater Architecture (Phase C Design)

**Target:** `scripts/update-achievements.js`
- **Pinned-Source Strategy:** Phase C updater must NOT fetch mutable `main` as the canonical generation input. It must pin two precise immutable revisions:
  - **Definitions Source**: `genshin-db-dist` pinned commit (supplies canonical groups and achievements arrays)
  - **Metadata Source**: `genshin-db` pinned commit (supplies curated version metadata file)
  (For the currently researched source: `genshin-db-dist` commit `371c228`, `genshin-db` commit `fab708f`, game data version `7.1`).
- **Dependency:** Fetch pinned raw JSON from `theBowja/genshin-db-dist` via HTTP during generation. **No npm dependency** (`dependencies` or `devDependencies`) will be added to Traveler's Toolkit, keeping the project light.
- **Normalization steps:**
  1. Fetch `achievementgroups.json` and `achievements.json` from `genshin-db-dist` (pinned revision).
  2. Write categories using canonical ID mapping.
  3. Iterate achievements and unroll arrays into separate canonical ID entries.
  4. Extract `count` from `reward` (where `id === 201`).
  5. Validate dataset (no duplicate IDs, strictly `5/10/20` rewards, valid strings, verify category ID equality with HoYoLAB).
  6. Write to `src/data/achievements/` deterministically.

---

## 6. Managed Risks / Future Validation Requirements

While the architecture is sound, the following are managed risks:
- `genshin-db` schema may change between releases.
- Curated version metadata can contain maintainer errors.
- Remote source availability can fail.
- Upstream category IDs could theoretically diverge from HoYoLAB in a future version.
- Game-derived text/data has separate provenance from repository code licensing.

**Mitigations:**
- Pin exact source revision.
- Validate schema before generation; fail closed on unknown fields/schema changes.
- Compare canonical category IDs against HoYoLAB when updating.
- Review generated diffs carefully.
- Preserve source attribution/provenance in the documentation and app UI.
