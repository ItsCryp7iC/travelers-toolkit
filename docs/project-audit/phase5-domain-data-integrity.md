# Phase 5 Audit: Domain & Data Integrity / Calculation Correctness

**Status**: Initial Audit / In Progress
**Baseline Commit**: `7189577`
**Date**: October 2026

---

## 1. Overview & Baseline Safety

Phase 5 focuses strictly on **Domain Correctness**, data integrity, calculation precision, and invariant preservation.

### Scope Boundaries
- **No UI redesign or visual style alterations**
- **No changes to Zustand persistence key or version (remains `v8`)**
- **No replacement of Zustand or store architecture**
- **No changes to HoYoLAB API / backend contracts**
- **No changes to route structure**
- **No casual modification or scraping of live Genshin data**
- **No commits or pushes**

### Baseline State Verification
- Branch: `main`
- HEAD: `7189577`
- origin/main: `7189577`
- Working tree: Clean (`git diff --check` and `git status` passed)
- Baseline Tests: 45 test files, 468 passed
- Generator Checks: `scripts/update-achievements.mjs --check` and `scripts/update-hoyolab-map.mjs --check` passed cleanly

---

## 2. Domain Invariant Table

| Domain Entity | Invariant Rule | Current Enforcement | Target Status |
| :--- | :--- | :--- | :--- |
| **Character** | Canonical identity must match `characters.json` or `traveler.json` | Validated in GOOD parser & store lookups | Enforced |
| **Character** | Current Level $\in [1, 90]$ (plus custom 95, 100 for Stella Fortuna) | Clamped / validated in calculator & UI | Enforced |
| **Character** | Ascension Phase $\in [0, 6]$ | Enforced via `ASCENSION_CAPS` and `clampLevel` | Enforced |
| **Character** | Level/Ascension compatibility: Level must fall within $[min(A), max(A)]$ | `clampLevel(level, ascension)` | Enforced |
| **Character** | Talents $\in [1, 15]$ (1-10 base, up to 15 for constellation bonuses) | Validated in GOOD parser ($1 \le t \le 15$) | Enforced |
| **Character** | Target progression below current progression yields zero cost | Returns `{}` (Policy C: zero cost) | Consistent across all calculators |
| **Weapon** | Canonical identity must match `weapons.json` | Validated via `resolveGoodWeaponKey` & `weaponsData` | Enforced |
| **Weapon** | Instance UUID uniqueness: Each tracked weapon has a unique UUID | Generated via `crypto.randomUUID()` | **Bug in GOOD import with duplicate unassigned weapons** (F-504) |
| **Weapon** | Current Level $\in [1, 90]$, Ascension $\in [0, 6]$ | Validated in parser & clamp helpers | Enforced |
| **Weapon** | Refinement: Gameplay $R \in [1, 5]$; uncrafted crafting queue $R=0$ permitted | Validated in GOOD parser ($1 \le r \le 5$), clamped in store ($[0, 5]$) | Enforced |
| **Weapon** | Bidirectional assignment: Non-Traveler character `equippedWeaponId === weapon.id` $\iff$ `weapon.assignedTo === character` | Managed in `weaponsSlice` & `rosterSlice` | Enforced for non-Travelers |
| **Weapon** | Exclusivity: One weapon instance cannot be equipped by multiple characters; ordinary character owns $\le 1$ equipped weapon | Reassignment unassigns prior owner | Enforced |
| **Traveler** | Shared current level and ascension across all unlocked Traveler elements | `syncTravelerAscension` / `syncTravelerCurrentProgression` | Enforced |
| **Traveler** | Per-element talent isolation (talents are unique per element) | Independent talent maps in roster entries | Enforced |
| **Traveler** | Shared weapon representation: Traveler variants **must never** store `equippedWeaponId` directly on roster entries (`equippedWeaponId: null`) | Phase 1 rule; weapon identity resolved via `trackedWeapons[].assignedTo` and `getTravelerAwareWeaponId` | **Violated in `weaponsSlice`, `rosterSlice`, and `importSlice`** (F-501, F-503, F-505) |
| **Material** | Canonical material key must match items in `getPrimaryInventoryList()` | Set lookup in `importSlice` & `goodIdentity` | Enforced |
| **Material** | Quantities: Canonical import requires non-negative integers ($q \ge 0$); legacy state preserves historical negatives | Validated in GOOD parser ($q \ge 0$, integer); backup import preserves legacy negatives | Enforced |
| **Material** | Unknown material fallbacks must not pollute persisted inventory or calculations | Fallbacks use `SAFE_FALLBACK` in UI only | Enforced |

---

## 3. Domain Types & Policy Clarifications

### 3.1 Refinement Domain Contract
The application distinguishes three distinct refinement concepts:
1. **Canonical Gameplay Refinement**:
   - In Genshin Impact and the GOOD standard, an in-game weapon instance has $R \in [1, 5]$. A weapon is acquired at R1 and can be refined up to R5.
   - [goodParser.js](file:///C:/Users/Cryptic/Documents/GitHub/travelers-toolkit/src/utils/goodParser.js#L6) strictly validates $1 \le r \le 5$ for external in-game exports.
2. **Legacy Persisted Value Range**:
   - In persisted application history (Zustand schema v1â€“v8), `currentRefinement` and `targetRefinement` were typed as `number`.
   - Missing fields in legacy v3 saves migrated to `1` in schema v4.
   - However, uncrafted craftable weapons historically permitted `0` so the forging cost calculator (`calculateForgingCost`) could calculate material deltas from 0 crafted copies to a target refinement ($0 \le R \le 5$).
3. **Runtime Mutation Policy**:
   - Store actions ([updateTrackedWeapon](file:///C:/Users/Cryptic/Documents/GitHub/travelers-toolkit/src/store/slices/weaponsSlice.js#L140)) clamp values to $[0, 5]$ (`Math.max(0, Math.min(5, Number(val) || 0))`) to support manual table inputs (`min={0} max={5}`) and uncrafted forging queue workflows.
   - New weapon creations ([addTrackedWeapon](file:///C:/Users/Cryptic/Documents/GitHub/travelers-toolkit/src/store/slices/weaponsSlice.js#L18)) default to `currentRefinement: 1, targetRefinement: 1`.

### 3.2 Inventory Quantity & Negative Value Compatibility
The application defines distinct policies across data boundaries:
1. **GOOD Import Policy**:
   - External GOOD files enforce canonical in-game rules: material quantities must be non-negative integers ($q \ge 0$). Negative or fractional numbers are rejected and logged in `unresolved.materials`.
2. **Normal Backup Import Policy**:
   - Backup files (`v1` and legacy `v0`) accept shallow validated `Record<string, unknown>` for inventory. Does NOT destructively alter, clamp, or reject historical inventories that may contain negative quantities, preserving legacy data fidelity.
3. **Existing Persisted / Hydrated Legacy Policy**:
   - Historical negative values stored in localStorage are preserved as-is. Neither `persistence.ts` migrations nor Zustand hydration strip or normalize existing negative values.
4. **Manual Inventory Mutation Policy**:
   - `setInventory(mat, qty)` enforces `Math.max(0, qty)` (preventing negative manual input via direct setting), while `incrementInventory(mat, amount)` allows relative adjustments.

### 3.3 Domain Types Audit
Inspection of `src/types/domain.ts`, `src/types/good.ts`, and `src/types/backup.ts` revealed:
1. **`GoodWeaponEntry` omitted `refinement`**:
   `src/types/good.ts` typed `GoodWeaponEntry` without `refinement: RefinementLevel`. Consequently, `importGoodData` dropped refinement during import even though `goodParser.js` parsed it. (Fixed in Phase 5).
2. **`TrackedWeapon.currentRefinement` vs `RefinementLevel`**:
   `RefinementLevel` is typed `number`, matching $[0, 5]$ runtime behavior.
3. **`RosterEntry.calculatedCosts` optionality**:
   `calculatedCosts` is nullable (`CharacterCalculatedCosts | null`) and derived. It is recomputed upon user updates and imports.

---

## 4. Findings & Classifications

### 4.1 Verified P1 Bugs (User-Data Loss / Broken Invariants)

#### F-501: `bulkUpdateWeapons` Unassigns Traveler's Weapon
- **Severity**: P1
- **File**: `src/store/slices/weaponsSlice.js` (lines 191â€“198)
- **Evidence**:
  ```js
  // Second pass: unassign weapons that were replaced
  const currentlyEquippedWeaponIds = Object.values(updatedRoster).map(c => c.equippedWeaponId).filter(Boolean);
  const finalArmory = updatedArmory.map(w => {
    if (w.assignedTo && !currentlyEquippedWeaponIds.includes(w.id)) {
      return { ...w, assignedTo: null };
    }
    return w;
  });
  ```
- **Root Cause**: Traveler variants have `c.equippedWeaponId === null` by design. When `bulkUpdateWeapons` executes its second pass, `currentlyEquippedWeaponIds` does not contain the Traveler's weapon ID. If `w.assignedTo` is any Traveler variant (e.g. `'Traveler Geo'`), the condition `!currentlyEquippedWeaponIds.includes(w.id)` evaluates to true and strips the weapon (`assignedTo: null`).
- **User Impact**: Any bulk weapon update instantly disarms the Traveler.
- **Fix**: Check whether `w.assignedTo.startsWith('Traveler ')` or whether the owner is a Traveler variant before unassigning in the second pass.

#### F-502: `importGoodData` Drops Weapon Refinement
- **Severity**: P1
- **File**: `src/store/slices/importSlice.ts` (lines 95â€“105), `src/types/good.ts` (line 16)
- **Evidence**: `goodParser.js` parses `refinement` (1â€“5) and includes it in `parsed.weapons`. However, `GoodWeaponEntry` lacks the field, and `importGoodData` instantiates `newWeapon` with only `level`, `ascension`, `targetLevel`, `targetAscension`, `assignedTo`, `createdAt`.
- **Root Cause**: Missing property assignment in `importGoodData`.
- **User Impact**: All weapons imported via GOOD lose their refinement, defaulting to `undefined` / 1.
- **Fix**: Update `GoodWeaponEntry` to include `refinement: RefinementLevel;` and map `currentRefinement: w.refinement, targetRefinement: existing?.targetRefinement ?? w.refinement`.

#### F-503: `importGoodData` Violates Traveler `equippedWeaponId` Invariant
- **Severity**: P1
- **File**: `src/store/slices/importSlice.ts` (lines 123â€“125)
- **Evidence**:
  ```ts
  if (w.location && newRoster[w.location]) {
    newRoster[w.location].equippedWeaponId = id;
  }
  ```
- **Root Cause**: When `w.location` is a Traveler variant, `equippedWeaponId` is written directly into that variant's roster entry, breaking the shared weapon representation established in Phase 1.
- **User Impact**: Cross-element desync where individual Traveler variants have conflicting `equippedWeaponId` values.
- **Fix**: Guard assignment: `if (w.location && newRoster[w.location] && !w.location.startsWith('Traveler '))`.

#### F-504: `importGoodData` Duplicate Weapon Collisions
- **Severity**: P1
- **File**: `src/store/slices/importSlice.ts` (line 93)
- **Evidence**:
  ```ts
  const existing = state.trackedWeapons.find(ew => ew.weaponName === w.weaponName && ew.assignedTo === w.location);
  const id = existing ? existing.id : crypto.randomUUID();
  ```
- **Root Cause**: If a user has multiple unassigned copies of the same weapon (e.g. two "Favonius Sword" with `assignedTo: null`), both imported entries match the first unassigned instance and reuse the exact same `id`.
- **User Impact**: Distinct weapon instances collapse into duplicate UUIDs in `trackedWeapons`.
- **Fix**: Track matched existing IDs in a `Set<string>` so each existing weapon instance is claimed at most once.

#### F-505: Store Actions Set `equippedWeaponId` on Traveler Variants
- **Severity**: P1
- **Files**: `src/store/slices/weaponsSlice.js` (`addTrackedWeapon`, `updateTrackedWeapon`, `assignWeaponToCharacter`), `src/store/slices/rosterSlice.js` (`bulkUpdateCharacters`)
- **Evidence**: Actions write `equippedWeaponId: weaponId` directly into `state.roster[charName]` even when `charName.startsWith('Traveler ')`.
- **Root Cause**: Missing check for Traveler variants when updating roster entries.
- **User Impact**: Inadvertent violation of Traveler weapon invariant during direct store mutations.
- **Fix**: Only update `equippedWeaponId` on roster entries if `!charName.startsWith('Traveler ')`. For Traveler variants, update `w.assignedTo` to point to the Traveler variant while keeping roster `equippedWeaponId: null`.

---

### 4.2 Verified P2 Bugs (Incorrect Calculation / Import Behavior)

#### F-506: `calculateWeaponCost` Discount Parameter Mismatch
- **Severity**: P2
- **File**: `src/utils/calculator.js` (lines 758â€“759)
- **Evidence**:
  ```js
  const hasRaiden = charactersRoster && Object.keys(charactersRoster).includes('Raiden Shogun');
  const hasWanderer = charactersRoster && Object.keys(charactersRoster).includes('Wanderer');
  ```
  Callers in `weaponsSlice.js` and `importSlice.ts` pass `Object.values(state.roster)` (an Array).
- **Root Cause**: `Object.keys(array)` yields indices `["0", "1", ...]` which never match `'Raiden Shogun'` or `'Wanderer'`.
- **User Impact**: 50% weapon ascension mora discounts for Raiden Shogun (Swords/Polearms) and Wanderer (Bows/Catalysts) never apply when array-based roster is passed.
- **Fix**: Support both Record and Array shapes for `charactersRoster`.

#### F-507: Canonical Character Dataset Typo in Vodyanitsa Gem Reference
- **Severity**: P2
- **File**: `src/data/characters.json` (line 1918), `src/pages/devBuilder/constants.js` (line 9)
- **Evidence**: Character "Vodyanitsa" has `"gem_family_id": "VarunadaLazulite"` (with an `l`). Canonical `character_gems.json` has `"id": "VarunadaLazurite"` (with an `r`).
- **Root Cause**: Typo in character definition and dev builder constant.
- **User Impact**: Vodyanitsa's gem family fails resolution and falls back to `{ name: 'Unknown', id: 'unknown', tiers: {} }`.
- **Fix**: Correct `"VarunadaLazulite"` to `"VarunadaLazurite"`.

---

### 4.3 Verified P3 Maintainability / State Mutation Findings

#### F-508: `recalculateCharacterCosts` In-Place Parameter Mutation
- **Severity**: P3
- **File**: `src/store/helpers/rosterHelpers.js` (line 19)
- **Evidence**: `charEntry.calculatedCosts = { ascCosts, talentCosts };` mutates the input argument directly.
- **Root Cause**: Mutating input object before returning it.
- **Fix**: Return `{ ...charEntry, calculatedCosts: { ascCosts, talentCosts } }`.

#### F-509: Duplicated `SAFE_FALLBACK` Declaration
- **Severity**: P3
- **File**: `src/utils/dataManager.js` (line 29 and line 76)
- **Evidence**: `SAFE_FALLBACK` is defined at file scope and shadowed inside `resolveWeaponMaterials`.
- **Fix**: Remove shadowed inner declaration and use module-level constant.

---

### 4.4 Intentional Behaviors (Confirmed False Positives)

1. **Levels 95 and 100 in `calculator.js`**:
   - `rawFromLv < 95 && rawToLv >= 95 stellaFortuna += 1`
   - `rawFromLv < 100 && rawToLv === 100 stellaFortuna += 2`
   - *Status*: INTENTIONAL BEHAVIOR. This is an intentional application feature supporting custom post-90 constellation/awakening rewards (`masterless_stella_fortuna`).
2. **Traveler `equippedWeaponId: null`**:
   - *Status*: INTENTIONAL BEHAVIOR. Established in Phase 1 to prevent per-element desynchronization.
3. **Target Progression Below Current Progression Yields Zero Cost**:
   - *Status*: INTENTIONAL BEHAVIOR. Both character and weapon calculators return empty cost objects (`{}`) when target $\le$ current.

---

## 5. Canonical Data Integrity Audit Results

An automated cross-reference script was executed across all canonical datasets:
- **Characters**: 127 total (7 Traveler elements, 120 base)
  - Duplicate Names: 0
  - Duplicate IDs: 0
  - Normalized Name Collisions: 0
- **Weapons**: 251 total
  - Duplicate Names: 0
  - Duplicate IDs: 0
  - Normalized Name Collisions: 0
  - Material Family Resolution: 251 / 251 (100% resolved)
- **Character Material Cross-References**:
  - World Boss References: 100% valid
  - Weekly Boss References: 100% valid
  - Local Specialty References: 100% valid
  - Talent Family References: 100% valid
  - Enemy Family References: 100% valid
  - Gem Family References: 126 / 127 valid (1 typo: Vodyanitsa `VarunadaLazulite` -> fixed to `VarunadaLazurite`)

---

## 6. Target < Current Policy Statement

Across all components, stores, and calculators, the application implements **Policy C**:
- If `targetLevel <= level` and `targetAscension <= ascension`, progression calculation returns `{}` (zero additional materials needed).
- If `targetTalent <= currentTalent`, talent calculation returns `{}`.
- If weapon `targetLevel <= level` and `targetAscension <= ascension`, weapon calculation returns `{}`.
- The UI allows users to freely configure target values without throwing runtime errors or creating negative material diffs.

---

## 7. Summary of Fixes Implemented

1. **`src/store/slices/weaponsSlice.js`**:
   - Fixed `bulkUpdateWeapons` line 194 to exempt Traveler weapons from being unassigned in the second pass.
   - Enforced Traveler invariant in `addTrackedWeapon`, `assignWeaponToCharacter`, and `updateTrackedWeapon`: assigns weapon to Traveler element via `w.assignedTo` while strictly maintaining `equippedWeaponId: null` on all Traveler roster entries.
   - Fixed Traveler re-assignment to unassign any previously equipped weapon from ANY Traveler variant before assigning the new weapon.
2. **`src/store/slices/importSlice.ts` & `src/types/good.ts`**:
   - Added `refinement: RefinementLevel;` to `GoodWeaponEntry` in `good.ts`.
   - In `importGoodData`: mapped `currentRefinement: w.refinement ?? 1` and `targetRefinement: existing?.targetRefinement ?? (w.refinement ?? 1)`.
   - Prevented `newRoster[w.location].equippedWeaponId = id` from polluting Traveler roster entries.
   - Tracked claimed existing weapon IDs using a `Set<string>` to prevent multiple unassigned duplicate weapons from collapsing into the same UUID.
   - Resolved assignment conflicts deterministically: if multiple weapons claim the same owner in a single GOOD payload, the previous weapon is unassigned.
3. **`src/store/slices/rosterSlice.js`**:
   - In `bulkUpdateCharacters`: enforced `updatedEntry.equippedWeaponId = isTraveler ? null : finalWeaponId;`. If a weapon is assigned to Traveler, it unassigns any weapon previously assigned to any Traveler variant and sets `w.assignedTo = name` while keeping roster `equippedWeaponId: null`.
4. **`src/utils/calculator.js`**:
   - Updated `hasRaiden` and `hasWanderer` weapon ascension discount checks to accept both Record and Array formats for `charactersRoster`.
   - Fixed level 90 -> 95/100 Stella Fortuna calculation when progressing from level 90.
5. **`src/data/characters.json` & `src/pages/devBuilder/constants.js`**:
   - Fixed canonical dataset typo: `"VarunadaLazulite"` -> `"VarunadaLazurite"`.
6. **`src/store/helpers/rosterHelpers.js`**:
   - Prevented in-place mutation of `charEntry` in `recalculateCharacterCosts`.
7. **`src/utils/dataManager.js`**:
   - Removed duplicated `SAFE_FALLBACK` declaration inside `resolveWeaponMaterials`.

---

## 8. Test Suite & Verification Results

- **Canonical Data Integrity Test Suite (`src/data/dataIntegrity.test.js`)**:
  - Validates 127 characters (7 travelers, 120 base) and 251 weapons.
  - Verifies 0 duplicate names, 0 duplicate IDs, and 0 normalized collisions.
  - Validates 100% material reference resolution across all categories.
- **Weapon Assignment & Traveler Invariant Tests (`src/store/slices/weaponsSlice.test.js`)**:
  - 8 new unit tests proving bidirectional consistency, Traveler protection, bulk update safety, and refinement bounds.
- **Calculator Tests (`src/utils/calculator.test.js`)**:
  - Added array-based discount tests, input immutability tests, and table-driven character progression boundaries (44 tests total).
- **Store & GOOD Import Tests (`src/store/useStore.test.js`)**:
  - Added tests for refinement preservation, duplicate unassigned weapon UUID uniqueness, assignment conflict resolution, and Traveler protection (27 tests total).
- **Overall Vitest Suite**:
  - **Baseline**: 45 test files, 468 tests passed
  - **Phase 5**: 47 test files, 497 tests passed (0 failures)
- **TypeScript Typecheck**:
  - `npm run typecheck`: 0 errors
- **Generators**:
  - `node scripts/update-achievements.mjs --check`: Data is up to date.
  - `node scripts/update-hoyolab-map.mjs --check`: Data is up to date.
- **Production Build**:
  - `npm run build`: Built successfully in 7.46s.

---

## 9. Browser Validation Status

- **Interactive Browser**: Reported UNAVAILABLE in this isolated sandbox environment due to Playwright driver download network restriction (404 Not Found from CDN). Automated end-to-end unit and integration tests verify all store, DOM, and calculation interactions.

---

## 10. Backward Compatibility Statement

- **Persistence Schema**: Unchanged.
- **Persistence Storage Key & Version**: Unchanged (`v8`).
- **HoYoLAB API & backend contracts**: Unchanged.
- **Route Structure & Layout**: Unchanged.
- **No commits or pushes performed.**
