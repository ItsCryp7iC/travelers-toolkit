# HoYoLAB Character Sync - Phase C: Safe Selectable Apply

**Status: Completed**

Live validation successfully covered:
- existing character update
- new character import
- new weapon creation
- existing weapon reuse/update
- weapon-only apply
- derived Traveler variant creation
- Traveler shared level/ascension behavior
- target preservation
- local-ahead safety
- stale preview protection
- idempotency
- atomic apply

## Objective
Enable users to selectively apply synchronization changes to their roster and tracked weapons based on the reconciliation preview.

## Architecture & Implementation Rules

### 1. Pure State Transformation
Applying changes must not directly mutate Zustand state step-by-step. Instead, it relies on a pure utility function (`src/utils/hoyolabSyncApply.js`) that takes:
- Current `roster`
- Current `trackedWeapons`
- Validation Plan / Selection configuration
- `uuidFactory` (for deterministic testability)

The apply utility returns `{ roster, trackedWeapons, result }`. The Zustand store then updates using a single, atomic `set()` operation to avoid partial state corruption.

### 2. No Deletion
Synchronization is strictly additive or updates existing items. It never deletes local characters, alternative Traveler variants, or older weapon instances (reassigned weapons become unassigned, but their instances are preserved).

### 3. Field-Level Local-Ahead Policy
If the user's local character/weapon state is functionally ahead of HoYoLAB (e.g. Toolkit level 90, HoYoLAB level 80), the default safe behavior is to **keep the local Toolkit value**. Users can explicitly override this via a dedicated button in the UI, which will apply only to the selected field type.

### 4. Target Preservation
Target fields (e.g., `targetLevel`, `targetAscension`, `targetTalents`, `targetRefinement`) are strictly preserved for existing entities. When new characters or weapons are created, sensible toolkit defaults are applied (e.g. 90/6/10 for characters, 90/6/currentRefinement for weapons) instead of matching the current HoYoLAB level.

### 5. Traveler Current-Only Sharing
Traveler syncing requires special handling:
- **Level and Ascension** are shared across all element variants of the Traveler.
- **Talents** are updated ONLY for the currently active Traveler element from HoYoLAB.
- **Planner targets** remain independent and preserved for each variant.

### 6. Weapon Ambiguity Resolution
When HoYoLAB reports a weapon that has multiple ambiguous candidates locally or has an equipment mismatch, it is categorized as needing attention. The user must explicitly choose how to resolve this (e.g. Create New, Use Existing Instance, Leave Unchanged) before they are permitted to sync the selection.

### 7. Stale-Preview Validation
The apply workflow relies on the frontend state tracking selections. The apply logic compares the plan against the latest Zustand state to prevent applying stale decisions (e.g. applying a weapon re-assignment that is no longer valid).

### 8. Idempotency
Applying the exact same HoYoLAB state twice will not duplicate characters, change targets incorrectly, or spawn additional redundant weapons. Reconciling a successfully synced roster will accurately label the characters as "Up to date".

### 9. Manekin Exclusion
Internal non-progression entities (`10000117` and `10000118`) are explicitly excluded and silently ignored. They will never appear in a generated sync plan.

### 10. Derived Traveler Variants
HoYoLAB's API limitations prevent fetching real account-specific talent levels for inactive Traveler elements. To account for this without breaking safe mapping:
- If the **active Traveler** is found in the HoYoLAB fetch, the UI permits selectively onboarding **inactive variants** as derived toolkit entries.
- These variants are entirely user-selected.
- They clone only the shared current `level` and `ascension` from the active Traveler.
- They initialize with standard empty baseline stats: `1/1/1` talents, `90/6/10/10/10` targets.
- They do **not** duplicate equipped weapons.
- Existing local variants are safely preserved and not overwritten.
