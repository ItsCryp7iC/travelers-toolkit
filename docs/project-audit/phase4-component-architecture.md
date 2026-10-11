# Phase 4 Audit: React Component Architecture & Render Efficiency

**Status**: Initial Audit / In Progress
**Baseline Commit**: `43888f5`
**Date**: October 2026

---

## 1. Overview & Scope

Phase 4 focuses on component structure, render-time hot paths, unnecessary rerenders, unstable props/callbacks, and testability across key frontend views and modals.

Per phase constraints:
- No UI redesign or global styling changes
- No changes to route structure or persistence keys
- No changes to backend APIs or HoYoLAB semantics
- No changes to Traveler weapon resolution semantics
- No commits / pushes

---

## 2. Component Size & Complexity Baseline (LOC)

Ranked list of largest React components and table hooks:

| File | Baseline LOC | Primary Responsibilities | Structural Issues |
| :--- | :--- | :--- | :--- |
| `src/components/HoyolabSyncPreviewModal.jsx` | 756 | HoYoLAB reconciliation preview, diff display, conflict resolution, weapon assignment choices, Traveler element selection, confirmation modal | Monolithic render tree, inline 175-line `renderCharacterCard`, repeated $O(N)$ scans over characters per selection event |
| `src/components/Table/characters/useCharacterColumns.jsx` | 654 | TanStack column definitions for 30+ columns, cell formatters, inline editors, ascension level stepper | Entire column definition array rebuilt on every checkbox toggle (`[selectedNames]`), repeated `resolveCharacterMaterials` (20+ calls per row) |
| `src/components/CharacterModal.jsx` | 523 | Character progression modal, talent level stepper, weapon draft sliders, transactional saving | Unused broad store subscription (`fullRoster = useStore(s => s.roster)`), large combined JSX |
| `src/components/CharacterCard.jsx` | 503 | Character card display, avatar/element badges, talent progression, required materials grid | Subscribes to `inventory` across all cards, rendering unused or low-frequency materials grids |
| `src/components/Table/weapons/useWeaponColumns.jsx` | 497 | Weapon table columns, sorting comparators, forging cost calculation, enhancement quantities | Entire column array rebuilt on selection toggle, $O(N \log N)$ repeated linear scans `weaponsData.find` inside sort comparators |
| `src/pages/Dashboard.jsx` | 485 | Overview dashboard, resin notes sync, farmable today view, quick stats | Allocates keys array in selector, mix of direct data and widget wrappers |
| `src/pages/Characters.jsx` | 405 | Roster table/card view, filtering, sorting, batch modal controls | Dead code (`isAscended`, unused imports), repeated linear scans `charactersData.find` and `findIndex` in `rostered` |
| `src/pages/Weapons.jsx` | 379 | Armory table/card view, filtering, sorting, forging panel toggle | Subscribes to `roster` solely to pass to `calculateWeaponCost` (which does not use it), repeated linear scans `weaponsData.find` in sort comparators, dead code (`isAscended`, `MatCell`) |
| `src/components/WeaponCard.jsx` | 335 | Weapon card display, rarity badge, enhancement costs, assigned character | Subscribes to `inventory` and `roster`, performs $O(N)$ scan over roster entries when `armoryEntry.assignedTo` is already tracked directly |

---

## 3. Findings & Classifications (P1 â€“ P4)

### P1: Correctness & Reliability
- **P1-A: WeaponCard Equipping Traveler Detection** (`src/components/WeaponCard.jsx`)
  - Finding: `WeaponCard` searches `Object.entries(roster).find(([char, entry]) => entry.equippedWeaponId === armoryEntry.id)`. In Traveler variants, `entry.equippedWeaponId` is intentionally `null` to prevent desync across elements. Consequently, weapons assigned to Traveler display as unassigned on `WeaponCard`.
  - Fix: Read `armoryEntry.assignedTo` directly, which properly records the assigned character including Traveler variants.

### P2: Performance & UX Hot Paths
- **P2-A: Column Definitions Recreated on Every Checkbox Toggle** (`useCharacterColumns.jsx`, `useWeaponColumns.jsx`)
  - Finding: `useCharacterColumns` has `[selectedNames, setSelectedNames, updateCharacter, removeCharacter]` and `useWeaponColumns` has `[selectedIds, setSelectedIds, updateWeapon, removeWeapon]` in their `useMemo` dependencies. Selecting a single row invalidates and completely reallocates 30+ column configuration objects, header functions, and cell functions.
  - Fix: Decouple selection state by accessing selection via TanStack table `table.options.meta` (e.g. `meta.selectedNames`), allowing the columns definition `useMemo` to remain stable across selection toggles.
- **P2-B: Repeated $O(N)$ Lookups and Material Calculations per Row** (`useCharacterColumns.jsx`, `Characters.jsx`)
  - Finding: Inside `useCharacterColumns.jsx`, `resolveCharacterMaterials(row)` is called over 20 times per row across accessors and cell renderers. With 50 rostered characters, this results in >1,000 dictionary and JSON searches per render. In addition, `Characters.jsx` performs `charactersData.find` and `charactersData.findIndex` for each roster entry.
  - Fix: Precompute `characterByName` and `weaponByName` lookup Maps. Precompute `resolvedMaterials` once in `Characters.jsx` and attach to each enriched character row object, eliminating redundant calls in table cells and accessors.
- **P2-C: $O(N \log N)$ Linear Scans in Weapon Table Sorting** (`useWeaponColumns.jsx`, `Weapons.jsx`)
  - Finding: Inside `useWeaponColumns.jsx` sorting functions, `weaponsData.find(w => w.name === rowA.original.weaponName)` is executed twice per pair comparison, even though `rowA.original.data` already contains the weapon metadata. Inside `Weapons.jsx` character sort, `charactersData.find(c => c.name === charA_Name)` is called on every comparison even though `a.assignedChar` was already enriched.
  - Fix: Use `row.original.data` directly in `useWeaponColumns.jsx`. Use `a.assignedChar` directly in `Weapons.jsx` sort comparator.
- **P2-D: Broad Roster Subscription in Weapons Page** (`src/pages/Weapons.jsx`)
  - Finding: `Weapons.jsx` subscribes to `roster = useStore(s => s.roster)` solely to pass `roster` to `calculateWeaponCost`. In `calculator.js`, `calculateWeaponCost` does not use the `charactersRoster` parameter. As a result, modifying any character in the roster causes the entire `Weapons` page and all weapon rows to re-render.
  - Fix: Remove the `roster` subscription from `Weapons.jsx`.
- **P2-E: Unused Broad Store Subscriptions** (`src/components/CharacterModal.jsx`, `src/components/WeaponCard.jsx`)
  - Finding: `CharacterModal.jsx` subscribes to `fullRoster = useStore(s => s.roster)`, which is completely unused in the component. Every store change to any roster entry triggers a rerender of `CharacterModal`. `WeaponCard.jsx` subscribes to `inventory = useStore(s => s.inventory)` and `roster`, causing all weapon cards to rerender on any material count change.
  - Fix: Remove unused store subscriptions.
- **P2-F: Repeated Linear Searches in HoYoLAB Sync Modal** (`src/components/HoyolabSyncPreviewModal.jsx`)
  - Finding: Selection counts (`selectedCharCount`) and `canApply` run linear searches `reconciliationResult.characters.find(...)` on every selection update.
  - Fix: Create an $O(1)$ Map index `charactersByHoyolabId` for fast lookups.

### P3: Maintainability & Component Boundaries
- **P3-A: Monolithic HoYoLAB Modal Structure** (`src/components/HoyolabSyncPreviewModal.jsx`)
  - Finding: Monolithic 756-line component containing an inline 175-line `renderCharacterCard` function, complex weapon resolution radio group rendering, and Traveler variants selection.
  - Fix: Extract pure presentational subcomponents: `HoyolabCharacterSyncRow.jsx` and `HoyolabWeaponResolver.jsx` in `src/components/hoyolabSync/`.
- **P3-B: Dead Code and Unused Imports in Pages** (`src/pages/Characters.jsx`, `src/pages/Weapons.jsx`)
  - Finding: Dead functions `isAscended` and `MatCell` in `Weapons.jsx` and unused calculator imports in `Characters.jsx`.
  - Fix: Clean up dead code and unused imports.

### P4: Minor / Cosmetic
- **P4-A: Filter Regex Recompilation** (`Characters.jsx`, `Weapons.jsx`)
  - Finding: In filter callbacks, `parseInt(rarityFilter.match(/\d+/)?.[0] || '0', 10)` is evaluated repeatedly per item in the array.
  - Fix: Parse `rFilterNum` once outside the `.filter()` callback.

---

## 4. Render Data Flow Analysis

### Characters Page
- **Zustand Subscriptions**:
  - `roster` (used for character list)
  - `trackedWeapons` (used for equipped weapon lookup)
  - `updateCharacter`, `removeCharacter`, `batchRemoveCharacters`, `bulkUpdateCharacters` (stable actions)
  - `hoyolabConnected`, `lastHoyolabCharacterSyncAt` (header status)
- **Derived Arrays**:
  - `rostered`: Derived from `roster` + `trackedWeapons`. Previously performed linear `.find()` and `.findIndex()` for each character.
  - `filtered`: Derived from `rostered`, filters and sort orders.
- **Column Rebuilding**:
  - Previously destroyed on every selection change due to `[selectedNames]` dependency. Decoupled via `table.options.meta`.

### Weapons Page
- **Zustand Subscriptions**:
  - `trackedWeapons` (used for list)
  - `roster` (**REMOVED**: was completely unused by calculation)
  - `removeTrackedWeapon`, `batchRemoveWeapons`, `updateTrackedWeapon`, `bulkUpdateWeapons` (stable actions)
- **Derived Arrays**:
  - `enriched`: Derived from `trackedWeapons`. Previously scanned `weaponsData` and `charactersData` linearly.
  - `filtered`: Derived from `enriched`, filters and sorts.

---

## 5. Implementation Plan

1. **Card Subscriptions**: Clean up `CharacterCard.jsx` and `WeaponCard.jsx` subscriptions.
2. **Character & Weapon Column Hooks**: Decouple selection state via table meta; pre-resolve materials; eliminate redundant `.find()` calls in sorting functions.
3. **Characters & Weapons Pages**: Implement Map lookups, hoist filter parsing, clean dead code, pass pre-resolved materials to table.
4. **CharacterModal**: Remove unused `fullRoster` subscription.
5. **HoYoLAB Sync Modal**: Precompute `charactersByHoyolabId` Map; extract pure presentational subcomponents `HoyolabCharacterSyncRow` and `HoyolabWeaponResolver`.
6. **Validation**: Automated test suite, typecheck, build, and generator scripts.
