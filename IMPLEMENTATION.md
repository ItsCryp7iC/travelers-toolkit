# Traveler's Toolkit — Achievements Implementation Plan

> Status: Planned / Pre-implementation
>
> Baseline before Achievements work: `3cc1de8`
>
> This document is the architectural source of truth for the Traveler's Toolkit Achievements feature.
>
> Any agent working on Achievements MUST read this document before modifying code.

---

## 1. Purpose

Traveler's Toolkit will gain a complete Genshin Impact achievement tracking system.

The feature should combine:

- a canonical static achievement database;
- local per-achievement completion tracking;
- live HoYoLAB achievement summary synchronization;
- category-level HoYoLAB reconciliation;
- search and filtering;
- version-aware tracking;
- Primogem progress statistics;
- local/Google backup compatibility;
- future import/export compatibility;
- future automated scanning/import workflows.

The design must remain maintainable across future Genshin versions.

This is not intended to be a one-off page containing checkboxes.

Achievements should be implemented as a first-class subsystem of Traveler's Toolkit.

---

## 2. Core Design Principle

Static achievement definitions and user progress MUST remain separate.

### Static data

Static achievement information belongs in canonical application data.

Example:

```js
{
  id: 84532,
  name: "Example Achievement",
  description: "Complete the required objective.",
  categoryId: 1,
  version: "7.1",
  primogems: 5,
  hidden: true,
  order: 1234
}
```

### User state

Only user-controlled progress belongs in Zustand persistence.

Example:

```js
achievementProgress: {
  "84532": {
    completed: true,
    completedAt: null
  }
}
```

DO NOT duplicate static achievement definitions inside persisted user state.

Wrong:

```js
achievementProgress: {
  "84532": {
    name: "Achievement",
    description: "...",
    primogems: 5,
    completed: true
  }
}
```

Static definitions may change between game versions.

User completion state must survive those changes.

---

## 3. Canonical Achievement Identity

Achievement names MUST NOT be used as identity.

Names may:

- change;
- be corrected;
- change punctuation;
- be translated;
- theoretically collide.

Use stable achievement IDs from the canonical source whenever available.

Example:

```text
Achievement ID: 84532
```

Persist:

```js
achievementProgress["84532"]
```

Do not persist:

```js
achievementProgress["Some Achievement Name"]
```

This identity rule applies to:

- React keys;
- Zustand state;
- imports;
- exports;
- backup data;
- HoYoLAB reconciliation where mappings exist;
- tests.

---

## 4. Known HoYoLAB Achievement Capability

A focused investigation performed before implementation found a current Genshin HoYoLAB Battle Chronicle achievement endpoint.

Current overseas endpoint:

```text
POST https://sg-public-api.hoyolab.com/event/game_record/genshin/api/achievement
```

Typical request body:

```json
{
  "role_id": "GENSHIN_UID",
  "server": "os_asia"
}
```

Community implementations currently using this endpoint include:

- TeyvatMoe/teyvat
- Genshin-bots/gsuid_core

Observed response shape:

```json
{
  "retcode": 0,
  "message": "OK",
  "data": {
    "achievement_num": 1430,
    "list": [
      {
        "id": "category-id",
        "name": "Wonders of the World",
        "icon": "...",
        "finish_num": 812,
        "percentage": 0,
        "show_percent": false
      }
    ]
  }
}
```

Important:

HoYoLAB currently appears to expose:

- total completed achievement count;
- achievement category list;
- category icons;
- completed count per category;
- category completion percentage where `show_percent` permits it.

No verified Genshin HoYoLAB API has been found that exposes:

- every individual achievement;
- individual completed/not-completed flags;
- individual achievement completion dates.

Therefore HoYoLAB synchronization MUST initially be treated as a reconciliation layer, not as the canonical individual progress source.

Do NOT assume HoYoLAB can automatically populate every achievement checkbox.

---

## 5. HoYoLAB Reconciliation Model

Traveler's Toolkit should eventually compare local progress against live HoYoLAB progress.

Example:

```text
HoYoLAB completed: 1430
Toolkit completed: 1426
Difference: +4
```

More importantly, reconcile by category.

Example:

```text
Wonders of the World

HoYoLAB: 812
Toolkit: 809

Difference: +3
```

This tells the user where incomplete local tracking exists even when HoYoLAB cannot identify the individual missing achievements.

Example UI status:

```text
Wonders of the World
809 locally tracked
812 reported by HoYoLAB
3 unidentified completions
```

When counts match:

```text
✓ Synced with HoYoLAB
```

---

## 6. Existing HoYoLAB Session

Traveler's Toolkit already contains HoYoLAB authentication/session handling used for functionality such as:

- Original Resin;
- Realm Currency;
- related Daily Notes data.

Achievements SHOULD reuse the existing backend HoYoLAB session architecture.

Do not create a second independent authentication system unless technical investigation proves it necessary.

Expected architecture:

```text
Existing HoYoLAB session
        ↓
Backend request
        ↓
HoYoLAB achievement endpoint
        ↓
Backend normalization
        ↓
Traveler's Toolkit frontend
```

The browser SHOULD NOT directly manage sensitive HoYoLAB cookies.

---

## 7. Backend Normalization

The frontend should not depend directly on HoYoLAB's raw undocumented schema.

Create a normalized backend response when the HoYoLAB integration phase is implemented.

Target shape:

```json
{
  "connected": true,
  "totalCompleted": 1430,
  "categories": [
    {
      "hoyolabId": "1",
      "name": "Wonders of the World",
      "icon": "...",
      "completed": 812,
      "percentage": null
    }
  ]
}
```

`percentage` MUST support `null`.

HoYoLAB supplies `show_percent`.

If:

```text
show_percent === false
```

do not present the raw percentage as authoritative.

Normalize it to:

```text
percentage: null
```

unless later investigation establishes another correct interpretation.

---

## 8. First HoYoLAB Proof of Concept

Before the main UI is built, perform a focused authenticated proof-of-concept against the user's existing HoYoLAB session.

Goal:

inspect the actual response returned for the currently connected Genshin account.

Confirm:

- endpoint works with current authentication;
- overseas host;
- UID/server resolution;
- request headers/signing requirements;
- category IDs;
- category names;
- category icons;
- total achievement count;
- `finish_num`;
- `percentage`;
- `show_percent`;
- privacy/error behavior;
- disconnected-session behavior.

Do NOT design mappings based only on assumptions from third-party libraries.

The actual response should be inspected before committing the final backend contract.

Never expose or log HoYoLAB cookies/tokens.

---

## 9. Canonical Static Achievement Dataset

Individual achievements require a separate canonical static dataset.

Expected structure:

```text
src/data/achievements/
    categories.json
    achievements.json
```

Alternative layouts may be proposed during Phase A if justified.

Do NOT scrape Seelie.me or Paimon.moe dynamically at runtime.

Do NOT depend on another tracker's uptime or undocumented frontend data.

The canonical dataset must eventually support:

```js
{
  id,
  categoryId,
  name,
  description,
  version,
  primogems,
  hidden,
  order
}
```

Potential additional metadata may include:

```js
{
  sourceType,
  region,
  commissionNames,
  seriesId,
  stage,
  prerequisites
}
```

but those fields should only be introduced when supported by reliable source data.

---

## 10. Dataset Research Requirements

Before importing achievement data, evaluate sources for:

- completeness;
- current Genshin version coverage;
- stable IDs;
- category IDs;
- descriptions;
- Primogem rewards;
- hidden status;
- version/release metadata;
- licensing;
- update frequency;
- machine-readable availability;
- long-term maintainability.

Candidate sources may include:

- game-data-derived repositories;
- community datasets;
- wiki-derived datasets where licensing permits;
- structured open-source projects.

Do not choose a source only because it is easy to scrape.

Data provenance must be documented.

---

## 11. Dataset Update Pipeline

The achievement system must eventually support repeatable game-version updates.

Target concept:

```text
scripts/update-achievements.*
```

or equivalent.

The pipeline should transform source data into Traveler's Toolkit canonical data.

Validation should detect:

- duplicate achievement IDs;
- duplicate category IDs;
- missing category references;
- invalid reward values;
- missing names;
- invalid versions;
- malformed hidden flags;
- invalid sort ordering;
- unsupported records.

Future game updates should not require manually editing hundreds of records.

---

## 12. Category Data

Categories should have stable canonical identities.

Conceptual structure:

```js
{
  id: 1,
  name: "Wonders of the World",
  icon: "...",
  order: 1
}
```

Canonical category identity should not depend on display names if reliable IDs are available.

Eventually category metadata may also contain HoYoLAB mappings:

```js
{
  id: 1,
  hoyolabId: "1"
}
```

or a separate mapping table.

Do not assume HoYoLAB category IDs match game-data category IDs until verified.

---

## 13. Multi-Stage Achievements

Do not automatically merge achievements merely because they have similar names.

Some achievement series have multiple stages.

The canonical database should preserve the underlying game's identity model.

If the source represents three stages as three achievement IDs, retain three IDs.

The UI may visually group them later without destroying canonical identity.

Avoid synthetic merged IDs unless absolutely necessary.

---

## 14. Hidden Achievements

The system should understand hidden achievements explicitly.

Example field:

```text
hidden: true
```

Future filters:

```text
All
Visible
Hidden
```

Hidden status refers to how the achievement behaves in-game, not whether Traveler's Toolkit should conceal its name or description.

Unless a later product decision says otherwise, the tracker may display known hidden achievement information.

---

## 15. Version Metadata

Version tracking is a first-class feature.

Achievements should have release/version metadata where reliable source data exists.

Example:

```text
version: "7.1"
```

This enables:

```text
Version 7.1
12 / 23 completed
65 / 120 Primogems
```

Expected quick filter:

```text
New in 7.1
```

Do not derive version numbers from unreliable ordering heuristics if authoritative metadata exists.

---

## 16. Primogem Statistics

Primogem statistics should be derived, never independently persisted.

Overall:

```text
Achievements completed
Primogems earned
Primogems remaining
```

Category:

```text
Wonders of the World
809 / 994
X / Y Primogems
```

Version:

```text
Version 7.1
12 / 23
65 / 120 Primogems
```

Derived state prevents synchronization problems.

---

## 17. User Achievement Progress Schema

Initial target persisted model:

```ts
interface AchievementProgressEntry {
  completed: boolean;
  completedAt: string | null;
}
```

Store:

```ts
achievementProgress: Record<string, AchievementProgressEntry>;
```

Keys are canonical achievement IDs serialized as strings.

Do not store entries unnecessarily for untouched/incomplete achievements unless needed.

For example, an absent entry may mean incomplete.

That decision should be made explicitly during the store phase and covered by tests.

---

## 18. Completion Timestamps

Do not invent historical completion dates.

For a manually completed achievement:

```js
{
  completed: true,
  completedAt: "2026-09-30T..."
}
```

For an imported historical achievement whose true completion date is unknown:

```js
{
  completed: true,
  completedAt: null
}
```

Never set import time as historical completion time unless the import format actually provides a trusted timestamp.

---

## 19. Persistence

Achievement progress must integrate with the existing Zustand persistence architecture.

Current pre-feature persistence version:

```text
v6
```

Achievements are expected to require a persistence migration, likely:

```text
v7
```

but DO NOT bump versions until the persistence phase.

Persist only user state.

Static achievement definitions must not be persisted.

Migration requirements:

- existing users retain all current data;
- achievementProgress defaults safely;
- no auth/session fields become persisted accidentally;
- old backups remain importable where supported.

---

## 20. Backup Integration

Achievement progress must participate in:

- local JSON export;
- local JSON import;
- Google Drive backup;
- Google Drive restore;
- factory reset;
- backup schema validation.

Do not add progress only to Zustand persistence while forgetting backup serialization.

Backup schema changes require tests.

---

## 21. Import / Export Architecture

Future achievement import should normalize external formats into canonical achievement IDs.

Architecture:

```text
External format
      ↓
Importer
      ↓
Normalization / identity mapping
      ↓
Canonical achievement IDs
      ↓
achievementProgress
```

Do not store another application's data format directly.

Initial Traveler's Toolkit export concept:

```json
{
  "format": "travelers-toolkit-achievements",
  "version": 1,
  "achievements": [
    {
      "id": "84532",
      "completed": true,
      "completedAt": null
    }
  ]
}
```

The exact schema will be finalized during the import/export phase.

---

## 22. Third-Party Compatibility

Potential future import compatibility:

- Traveler's Toolkit native format;
- Paimon.moe-compatible exports;
- Seelie-compatible exports;
- achievement scanner/OCR outputs.

Do not implement third-party formats until their current schemas have been inspected.

Do not couple core state to third-party field names.

---

## 23. Automatic Achievement Scanning

HoYoLAB cannot currently identify every individual Genshin achievement completion.

Future alternatives may include:

- OCR achievement scanners;
- structured exports from achievement scanning tools;
- another trusted game-data source if one later becomes available.

Scanner support is NOT part of the initial phase.

The architecture should make future importer modules possible.

---

## 24. Main Navigation

Achievements should be a first-class top-level feature.

Expected sidebar placement:

```text
Dashboard
Characters
Weapons
Planner
Inventory
Achievements

Changelog
Settings
```

Do not nest Achievements inside Planner.

---

## 25. Base Route

Target route:

```text
/achievements
```

Filters should use query parameters where useful.

Examples:

```text
/achievements?category=1
/achievements?version=7.1
/achievements?status=incomplete
```

Combined:

```text
/achievements?category=1&version=7.1&status=incomplete
```

Do not create a separate React route for every category unless later architecture clearly benefits from it.

---

## 26. Main Page Overview

Target top-level information:

```text
Achievements

1,426 / 1,854
76.9% complete

Primogems earned
Primogems remaining

HoYoLAB reports: 1,430
Local difference: +4
```

The precise visual design must follow Traveler's Toolkit styling rather than copying another application.

Seelie.me and Paimon.moe may be used as UX references only.

Do not copy proprietary UI code/assets.

---

## 27. Category Overview

Users should be able to view category progress.

Example:

```text
Wonders of the World
809 / 994
81.4%
HoYoLAB: 812
+3 unidentified
```

Another:

```text
Mortal Travails: Series I
6 / 6
100%
✓ Synced with HoYoLAB
```

Category cards may eventually show:

- category icon;
- completed;
- total;
- percentage;
- Primogem totals;
- HoYoLAB reconciliation status.

---

## 28. Achievement List

Each achievement entry should support information such as:

```text
[✓] Achievement Name                         5 Primogems

Achievement description.

Version 7.1
Wonders of the World
Hidden
```

Completion must be independently toggleable.

Avoid rendering assumptions that depend on achievement name uniqueness.

React keys must use canonical IDs.

---

## 29. Search

Search should initially cover at least:

- achievement name;
- achievement description.

Potentially later:

- category;
- source metadata;
- commission names.

Initial matching may use normalized case-insensitive substring matching.

Do not introduce heavy fuzzy-search dependencies without a demonstrated need.

---

## 30. Filters

Expected filters:

```text
Category
Version
Status
Reward
Visibility
```

Status:

```text
All
Incomplete
Completed
```

Reward:

```text
All
5
10
20
```

Visibility:

```text
All
Visible
Hidden
```

Additional shortcut:

```text
Hide completed
```

Filter behavior should be deterministic and testable.

---

## 31. Sorting

Potential sorting:

```text
Default / Game Order
Name
Version
Reward
Completion
```

Do not make completion sorting mutate canonical data order.

Sorting should operate on derived arrays.

---

## 32. Bulk Controls

Possible category controls:

```text
Mark category complete
Mark category incomplete
```

Potential broader bulk operations must require confirmation.

Do not allow one accidental click to mark hundreds of achievements.

Bulk operations must use canonical IDs.

---

## 33. HoYoLAB Sync UX

Potential action:

```text
Sync Achievement Summary
```

or synchronization integrated into existing HoYoLAB refresh flows.

Possible statuses:

```text
Synced just now
HoYoLAB not connected
Battle Chronicle unavailable
Achievement summary private
Sync failed
```

Never present a category as fully synchronized merely because the API request succeeded.

"Synced" should mean the relevant local and HoYoLAB counts match.

---

## 34. HoYoLAB Privacy Behavior

The HoYoLAB endpoint may depend on Battle Chronicle visibility/privacy settings.

Do not automatically change account privacy settings without explicit user understanding.

If access is unavailable, provide a clear application-level error.

Never leak raw tokens, cookies, DS signatures, or sensitive headers to browser logs.

---

## 35. Error Handling

Expected frontend states:

```text
HoYoLAB not connected
HoYoLAB session expired
Achievement data unavailable
Achievement summary private
Temporary HoYoLAB error
Static achievement database unavailable
```

The achievement page itself must remain usable for local tracking even when HoYoLAB is unavailable.

Live synchronization is an enhancement, not a dependency for core functionality.

---

## 36. Performance

The dataset may exceed 1,800 achievements.

Do not automatically render every achievement card into the DOM if unnecessary.

Initial strategies may include:

- category filtering;
- pagination;
- "Load more";
- rendering filtered subsets.

Example:

```text
100 achievements per page
```

Virtualization should only be introduced if profiling proves necessary.

Avoid adding a large dependency preemptively.

---

## 37. Static Assets

Do not bundle unnecessary thousands of achievement-specific images.

Individual achievements generally do not require unique icons.

Useful assets may include:

- category icons;
- Primogem icon;
- status indicators.

Prefer canonical existing/public assets and the project's established asset pipeline.

---

## 38. Accessibility

Interactive achievement rows must be keyboard usable.

Completion toggles must use accessible controls.

Search/filter controls require labels.

Do not make completion state visible only through color.

Hover-only information should also be accessible through focus where relevant.

---

## 39. Responsive Design

The feature must work on:

- desktop;
- tablet;
- mobile.

Large category grids should gracefully reduce columns.

Filters must remain usable on narrow screens.

Achievement content must not require horizontal scrolling for ordinary use.

---

## 40. Testing Requirements

Each phase must add appropriate tests.

Important test categories include:

- canonical achievement identity;
- category mapping;
- progress toggling;
- progress counts;
- Primogem calculations;
- filtering;
- searching;
- version selection;
- hidden status;
- HoYoLAB normalization;
- HoYoLAB category reconciliation;
- persistence migration;
- backup/restore;
- import normalization;
- duplicate IDs;
- malformed static data.

Regression tests should target real bugs discovered during implementation.

---

## 41. Validation Commands

Unless a phase explicitly requires otherwise, frontend changes should finish with:

```powershell
npm run test:run
npm run typecheck
npm run build
git diff --check
```

Backend changes should additionally run:

```powershell
python -m unittest discover -s backend/tests -p "test_*.py" -v
```

Check:

```powershell
git status --short
```

before reporting completion.

---

## 42. Manual Browser Validation

Agents may perform browser testing if available, but user manual browser testing is the final UI validation.

Important checks eventually include:

- `/achievements`;
- category navigation;
- search;
- filters;
- completion toggles;
- duplicate-free React rendering;
- persistence after reload;
- HoYoLAB connected/disconnected states;
- reconciliation values;
- responsive behavior;
- no console errors;
- no failed asset requests.

---

## 43. Git Workflow

Traveler's Toolkit uses staged incremental work.

For each phase:

1. inspect relevant existing architecture;
2. implement only the agreed scope;
3. run automated checks;
4. report exact files changed;
5. do NOT commit;
6. do NOT push;
7. wait for user/assistant review;
8. perform cleanup if requested;
9. user manually validates where applicable;
10. only commit/push after explicit approval.

Never combine unrelated cleanup or refactors with an Achievements phase.

---

## 44. Current Stable Baseline

Pre-Achievements baseline:

```text
3cc1de8 fix: use tracked weapon ids in planner cards
```

At this baseline:

```text
Frontend test files: 21
Frontend tests: 167 passing
Backend tests: 17 passing
Typecheck: passing
Production build: passing
Working tree: clean
```

Future reports should state whether these counts changed.

---

## 45. Implementation Roadmap

The feature should be implemented incrementally.

Execution note: Although Phase A is listed first as the data/schema workstream, the immediate execution order begins with Phase B. The HoYoLAB proof-of-concept must be completed and reviewed before Phase A is finalized, because verified live category identity and response behavior may affect canonical mapping decisions.

### Phase A — Data Research & Canonical Schema

Status: Complete — research and schema finalized.

Goals:

- evaluate current achievement data sources;
- determine licensing/provenance;
- inspect stable achievement IDs;
- inspect category IDs;
- inspect version metadata;
- inspect rewards;
- inspect hidden status;
- design canonical schemas;
- create validation tooling/prototype;
- no user progress UI yet.

Exit criteria:

- source selected;
- schema documented;
- source provenance documented;
- validator strategy established;
- no ambiguous identity decisions remain.

Phase A Research Decisions:

- **Primary Source**: `genshin-db-dist` via HTTP (avoids `npm` dependency). Provides highly structured data derived from Raw GenshinData.
- **Secondary Source**: `Dimbreath/AnimeGameData` for manual ground-truth verification.
- **Licensing/Provenance**: The `genshin-db` parser scripts are MIT, but the generated data originates from HoYoVerse game data. We will attribute ownership accordingly and treat this as derivative data.
- **Canonical Achievement ID**: The numeric game ID. Multi-stage achievements (provided as ID arrays in `genshin-db`) will be **unrolled** into separate individual canonical achievement records to strictly maintain game identity. Scanner exports (like Akasha Scanner) use this exact canonical ID space.
- **Canonical Category ID**: The numeric game category ID (`achievementGroupId` in `genshin-db`).
- **HoYoLAB Mapping Strategy**: Direct 1:1 mapping. The canonical category ID perfectly matches the HoYoLAB ID (verified `set(genshinDbGroupIds) === set(hoyolabIds)` for all 73 categories). The numeric canonical category ID itself will serve as the HoYoLAB reconciliation ID with no additional mapping needed. If a future version diverges, we will introduce an explicit mapping layer.
- **Version Metadata Strategy**: Rely on the `version` field from `genshin-db`. This is **curated secondary metadata**, not native game data, but is highly reliable.
- **Dataset Update Strategy**: An update script (Phase C) will consume pinned `genshin-db-dist` JSONs via HTTP (fetching exact commits/tags, not mutable `main`). It will unroll multi-stage achievements, extract integer `primogems` from rewards, enforce validation (unique IDs, observed 5/10/20 rewards), and output perfectly deterministic JSON files (`categories.json`, `achievements.json`) with no embedded timestamps inside the generation output. 
- **Managed Risks**: Handled via strict schema validation before generation, pinned source tracking in the manifest, and explicit validation of HoYoLAB ID equality.

### Phase B — HoYoLAB Achievement Proof of Concept

Status: Complete — implemented, live-validated, and reviewed.

Phase B Verified Findings:

- HoYoLAB category ID "0" is VALID ("Wonders of the World").
- ID "17" is "Memories of the Heart".
- Category IDs are non-sequential and must be treated as opaque identifiers.
- Do NOT infer category identity from list position or numeric ordering.
- All 73 categories returned usable/non-empty icon values in the live response.
- Normalized percentage was null only for ID "0" (Wonders) and "17" (Memories of the Heart); other categories exposed numeric percentages where `show_percent` was true.
- Category ordering returned by HoYoLAB may be useful for display but MUST NOT be treated as identity.
- The `genshin.py 1.7.29` package has no public Genshin achievement method. The internal `_request_genshin_record` method is used as the transport. This is a version-sensitive dependency that should be rechecked when genshin.py is upgraded.
- Live-verified behavior: authenticated success path, UID/default account resolution, endpoint accessibility, total count, 73-category response, response field shape, category ID format, icon presence, percentage normalization behavior.
- Tested through mocks/error handling only (not observed in live production): expired cookie, Battle Chronicle privacy disabled, HoYoLAB rate limit, malformed upstream schema.

Goals:

- reuse existing HoYoLAB session;
- call Genshin achievement endpoint;
- inspect actual account response;
- verify `os_asia` behavior;
- verify category IDs/names/icons;
- verify privacy/error responses;
- normalize backend response;
- add backend tests.

Do NOT yet bind HoYoLAB categories permanently to local categories until actual response has been reviewed.

Exit criteria:

- authenticated endpoint works;
- normalized response defined;
- no credentials exposed;
- tests pass.

### Phase C — Achievement Static Data Pipeline

**Status**: Complete — generation pipeline implemented, deterministic, validated, and awaiting commit.

**Generator Architecture & Validation**:
- **Generator Script**: `scripts/update-achievements.mjs`
- **Output Artifacts**: `src/data/achievements/{categories.json, achievements.json, manifest.json}`
- **Modes Supported**: `--write` (default, writes to disk) and `--check` (generates in-memory and asserts identical byte-for-byte output against disk).
- **Validation**: Enforces 73 category count constraint, validates ID uniqueness (including ID `0`), asserts expected primogem counts (`5, 10, 20`), and verifies stable categorical integrity.

**Snapshot Details**:
- **Source Definitions**: Pinned `genshin-db-dist` commit `371c228cabc9e182995919e595d67409823a0bbe`.
- **Source Metadata**: Pinned `genshin-db` commit `fab708f16795231fde199f39ecfb6ffb9eeb0b4e`.
- **Game Version**: `7.1` (Toolkit database corresponds to `genshin-db v5.2.14`)
- **Category Count**: 73 categories
- **Achievement Count**: 1854 canonical records (unrolled from 1558 raw source objects: 1410 scalar, 148 multi-stage)
- **Version Coverage**: 100% (1854 mapped, 0 null)
- **Visibility**: 1002 hidden, 852 visible
- **Reward Distribution**: 1281 (5 Primogems), 378 (10 Primogems), 195 (20 Primogems)

### Phase D — Achievement Store & Persistence

Goals:

- add `achievementProgress`;
- add actions/selectors;
- integrate persistence;
- perform store migration;
- integrate backup/export/import;
- integrate factory reset;
- add tests.

Likely persistence target:

```text
v7
```

but bump only after reviewing current store migration architecture.

Exit criteria:

- old users migrate safely;
- backups round-trip;
- no auth state persisted accidentally.

### Phase E — Base Achievements Page

Goals:

- add sidebar entry;
- add `/achievements`;
- overall summary;
- category overview;
- achievement list;
- completion toggling.

No advanced filters required yet.

Exit criteria:

- canonical IDs used everywhere;
- progress persists;
- counts accurate;
- UI responsive;
- browser console clean.

### Phase F — Search, Filters & Version Tracking

Goals:

- search;
- category filter;
- version filter;
- completion status;
- Primogem reward filter;
- hidden/visible filter;
- hide completed;
- URL query state where appropriate.

Exit criteria:

- deterministic filtering;
- test coverage;
- useful new-version workflow.

### Phase G — HoYoLAB Reconciliation UI

Goals:

- surface total HoYoLAB completed count;
- compare local vs HoYoLAB totals;
- compare category counts;
- display mismatch counts;
- display matching/synced states;
- handle disconnected/private/error states.

Exit criteria:

- no implication of individual automatic sync;
- reconciliation remains accurate.

### Phase H — Achievement Import / Export

Goals:

- native achievement export;
- native import;
- safe merge behavior;
- potential compatible importer architecture;
- imported historical timestamps remain null unless known.

Exit criteria:

- import idempotent;
- invalid IDs handled safely;
- backups unaffected;
- tests cover merges.

### Phase I — Extended Metadata

Potential future scope:

- commission-linked achievements;
- region grouping;
- achievement chains;
- prerequisites;
- multi-stage UI grouping;
- source hints.

Only implement metadata supported by trustworthy data.

### Phase J — Scanner Compatibility

Potential future scope:

- OCR/scanner imports;
- external achievement-reader compatibility;
- reconciliation assistance.

This is not required for initial release.

### Phase K — Final Stabilization

Run:

- complete frontend tests;
- complete backend tests;
- typecheck;
- production build;
- persistence migration tests;
- backup/restore tests;
- live HoYoLAB smoke tests;
- responsive browser tests;
- console/network inspection;
- Vercel production smoke test.

No release until regressions are resolved.

---

## 46. Explicit Non-Goals for Initial Release

Initial Achievements release does NOT require:

- automatic detection of every individual completion through HoYoLAB;
- OCR scanning;
- commission-route planning;
- social comparison;
- leaderboards;
- achievement guides generated by AI;
- automatic Wiki scraping at runtime;
- localization into every Genshin language;
- thousands of individual achievement icons.

These may be future additions.

---

## 47. Security Rules

HoYoLAB cookies/tokens are credentials.

Never:

- expose them to frontend JavaScript unnecessarily;
- put them in query strings;
- log them;
- include them in errors;
- include them in Git;
- include them in backup files;
- include them in screenshots/reports.

HoYoLAB requests should remain server-side.

Existing session-security architecture should be reused.

---

## 48. Data Integrity Rules

Never silently discard achievement progress.

Never remap IDs based only on names without explicit migration logic.

Never fabricate completion state from HoYoLAB category totals.

Example:

If HoYoLAB reports:

```text
Wonders: 812
```

and Toolkit locally knows:

```text
809 individual achievements
```

DO NOT arbitrarily mark three achievements complete.

Display:

```text
3 unidentified completions
```

until the user identifies/imports them.

This is a critical product rule.

HoYoLAB category ID "0" is valid.

Never use truthiness to determine whether a HoYoLAB category ID exists.

Bad conceptual logic:

```python
if not category_id:
    reject
```

or JavaScript equivalent:

```javascript
if (!category.id)
```

Correct validation must distinguish:

missing/null/undefined

from:

0 / "0"

This rule must be clearly documented because "Wonders of the World" uses ID "0".

---

## 49. Source-of-Truth Hierarchy

Use the following conceptual hierarchy:

```text
Canonical static dataset
        ↓
Defines what achievements exist

Local achievementProgress
        ↓
Defines which individual achievements the user has marked/imported

HoYoLAB
        ↓
Provides live aggregate/category reconciliation
```

HoYoLAB aggregate counts must never overwrite individual state without reliable identity information.

---

## 50. Agent Startup Requirement

Before performing ANY Achievements task, the agent must:

```text
1. Read IMPLEMENTATION.md.
2. Read relevant current source files.
3. Check git status.
4. Confirm current baseline and existing uncommitted changes.
5. Work only within the requested phase.
6. Never commit/push without explicit approval.
```

If implementation reality conflicts with this document:

- stop;
- report the conflict;
- propose an amendment;
- do not silently diverge from the architecture.

---

## 51. Document Maintenance

`IMPLEMENTATION.md` should evolve as verified technical facts become available.

Update it when:

- canonical data source is selected;
- real HoYoLAB response is inspected;
- persistence schema is finalized;
- import formats are finalized;
- important architectural decisions change.

Do not rewrite completed architectural history without reason.

Mark decisions clearly when they become final.

---

## 52. Immediate Next Step

After Phase B is finalized, the next implementation task is:

```text
Phase A — Data Research & Canonical Schema
```

Reason:

Phase B has now verified the real HoYoLAB achievement summary contract and category behavior. The next task is to research and select the canonical individual-achievement dataset, and design mapping schemas with those verified HoYoLAB facts in mind.

---

## Final Principle

Traveler's Toolkit should not merely reproduce another achievement tracker.

The target is:

```text
Complete static achievement tracking
+
live HoYoLAB reconciliation
+
version-aware filtering
+
Primogem statistics
+
safe backup/sync
+
future import/scanner compatibility
```

while preserving canonical identity and user data across future Genshin updates.
