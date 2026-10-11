# Phase 3: Store / State Architecture & Static-Data Decoupling

## 1. Baseline Verification & Metrics

- **Repository**: `travelers-toolkit`
- **Baseline Git HEAD**: `b5f2f50`
- **Origin/Main**: `b5f2f50`
- **Working Tree**: Clean (`git diff --check` passed cleanly)

### Baseline Bundle Measurements (b5f2f50)

| Metric | Baseline Value |
|---|---|
| **useStore Chunk Raw** | 633.99 kB (`dist/assets/useStore-Ch35UoQT.js`) |
| **useStore Chunk Gzip** | 99.54 kB |
| **Initial Static Graph Raw** | 1,189.87 kB (closure: 5 chunks) |
| **Initial Static Graph Gzip** | 230.78 kB |
| **Entry Chunk (`index`)** | 365.78 kB raw / 101.47 kB gzip (`dist/assets/index-BP-Ooo-g.js`) |
| **Total Emitted JS** | 1,736.90 kB |
| **JS Chunk Count** | 14 chunks |
| **Largest Chunk** | `useStore-Ch35UoQT.js` (633.99 kB) |
| **Vite >500 kB Warning** | Yes: `(!) Some chunks are larger than 500 kB after minification.` |

### Exact Initial Static Chunk Closure

1. `dist/assets/index-BP-Ooo-g.js` (365.78 kB raw / 101.47 kB gzip)
2. `dist/assets/useStore-Ch35UoQT.js` (633.99 kB raw / 99.54 kB gzip)
3. `dist/assets/character_gems-DCbtC1Aa.js` (175.78 kB raw / 24.87 kB gzip)
4. `dist/assets/jsx-runtime-Cltr0gcK.js` (8.43 kB raw / 3.21 kB gzip)
5. `dist/assets/resolver-Bw5NPUsJ.js` (5.84 kB raw / 1.68 kB gzip)

---

## 2. Store Mapping & State Classification

Every slice in `src/store/slices/*` and helper in `src/store/helpers/*` has been inspected.

### 2.1 settingsSlice
- **Persisted state**:
  - `serverRegion`: PERSISTED USER STATE (default `'Asia'`)
  - `showDbBuilder`: PERSISTED USER STATE (default `false`)
  - `autoBackupEnabled`: PERSISTED USER STATE (default `false`)
  - `displayTimeZone`: PERSISTED USER STATE (default `'auto'`)
- **Ephemeral state**: None
- **Actions**:
  - `setServerRegion`: ACTION
  - `setShowDbBuilder`: ACTION
  - `setAutoBackupEnabled`: ACTION
  - `setDisplayTimeZone`: ACTION
- **Static data imports**: None
- **Cross-slice dependencies**: None
- **External side effects**: None
- **Architectural classification**: SAFE. Clean settings slice.

### 2.2 sessionSlice
- **Persisted state**: None (filtered by `partializeStore`; legacy auth removed in migration v5)
- **Ephemeral state**:
  - `googleConnected`: SESSION STATE (boolean)
  - `googleUser`: SESSION STATE (`object | null`)
  - `hoyolabConnected`: SESSION STATE (boolean)
- **Actions**:
  - `checkGoogleSession`: ACTION (network I/O `/api/google/session`)
  - `disconnectGoogleSession`: ACTION (network I/O `/api/google/session`)
  - `setHoyolabConnected`: ACTION
  - `checkHoyolabSession`: ACTION (network I/O `/api/hoyolab/session`)
  - `connectHoyolabSession`: ACTION (network I/O `/api/hoyolab/session`)
  - `disconnectHoyolabSession`: ACTION (network I/O `/api/hoyolab/session`)
- **Static data imports**: None
- **Cross-slice dependencies**: None
- **External side effects**: HTTP fetch to backend `/api/*` endpoints.
- **Architectural classification**: JUSTIFIED. Session state correctly unpersisted.

### 2.3 syncSlice
- **Persisted state**: None
- **Ephemeral state**:
  - `syncPayload`: EPHEMERAL UI STATE / SESSION STATE (Real-Time Notes data)
  - `isSyncing`: EPHEMERAL UI STATE (concurrency guard flag)
- **Actions**:
  - `setSyncPayload`: ACTION
  - `setIsSyncing`: ACTION
  - `handleSyncNotes`: ACTION (network I/O `/api/notes`)
- **Static data imports**: None
- **Cross-slice dependencies**: Calls `get().hoyolabConnected` and `get().setHoyolabConnected`.
- **External side effects**: HTTP fetch to `/api/notes`.
- **Architectural classification**: JUSTIFIED. Concurrency-guarded background sync.

### 2.4 resinSlice
- **Persisted state**:
  - `resinCount`: PERSISTED USER STATE (number, clamped 0-200)
  - `resinTimestamp`: PERSISTED USER STATE (timestamp of manual update)
- **Ephemeral state**: None
- **Actions**:
  - `setResin`: ACTION
- **Static data imports**: None
- **Cross-slice dependencies**: None
- **External side effects**: None
- **Architectural classification**: SAFE. Clean minimal slice.

### 2.5 inventorySlice
- **Persisted state**:
  - `inventory`: PERSISTED USER STATE (`Record<string, number>`)
- **Ephemeral state**: None
- **Actions**:
  - `setInventory`: ACTION
  - `incrementInventory`: ACTION
- **Static data imports**: None
- **Cross-slice dependencies**: None
- **External side effects**: None
- **Architectural classification**: SAFE. Clean dictionary of material key -> quantity.

### 2.6 goalsSlice
- **Persisted state**:
  - `goals`: PERSISTED USER STATE (`Array<Goal>`)
- **Ephemeral state**: None
- **Actions**:
  - `addGoal`: ACTION
  - `removeGoal`: ACTION
- **Static data imports**: None
- **Cross-slice dependencies**: None
- **External side effects**: None
- **Architectural classification**: SAFE. Minimal array management.

### 2.7 helpersSlice
- **Persisted state**: None
- **Ephemeral state**: None
- **Actions / Getters**:
  - `getRosterCount`: ACTION / DERIVED GETTER (`Object.keys(get().roster).length`)
  - `getFiveStarCount`: ACTION / DERIVED GETTER (filters roster by `characters` array passed as argument)
- **Static data imports**: None
- **Cross-slice dependencies**: Reads `get().roster`.
- **External side effects**: None
- **Architectural classification**: SAFE.

### 2.8 hoyolabSyncSlice
- **Persisted state**:
  - `lastHoyolabCharacterSyncAt`: PERSISTED USER STATE (`number | null`, sync timestamp)
- **Ephemeral state**: None
- **Actions**:
  - `applyHoyolabSync`: ACTION (atomic transaction executing plan against `state.roster` and `state.trackedWeapons`)
- **Static data imports**: None
- **Cross-slice dependencies**: Mutates `roster` and `trackedWeapons` atomically within a single `set()` call.
- **External side effects**: None
- **Architectural classification**: JUSTIFIED. Atomic transactional update designed in Phase 0.

### 2.9 rosterSlice
- **Persisted state**:
  - `roster`: PERSISTED USER STATE (`Record<string, RosterEntry>`)
    - Fields: `level`, `ascension`, `targetLevel`, `targetAscension`, `talents`, `targetTalents`, `equippedWeaponId`, `tracked`.
    - `calculatedCosts`: DERIVED STATE (cached inside each roster entry).
- **Ephemeral state**: None
- **Actions**:
  - `addCharacter`: ACTION
  - `saveCharacterDraft`: ACTION (atomic transactional save for character modal)
  - `batchAddCharacters`: ACTION
  - `removeCharacter`: ACTION
  - `batchRemoveCharacters`: ACTION
  - `updateCharacter`: ACTION
  - `bulkUpdateCharacters`: ACTION
  - `isInRoster`: ACTION / DERIVED GETTER
- **Static data imports**:
  - Via `src/store/helpers/rosterHelpers.js`:
    - `src/utils/characters.js` -> `src/data/characters.json` + `src/data/traveler.json`
    - `src/utils/calculator.js` -> `src/data/costs.json`
- **Cross-slice dependencies**:
  - `saveCharacterDraft`, `removeCharacter`, `batchRemoveCharacters`, `bulkUpdateCharacters`:
    Read and mutate `state.trackedWeapons` alongside `state.roster` to keep weapon assignment in sync.
- **External side effects**: None
- **Architectural classification**: JUSTIFIED cross-slice coordination (Character <-> Weapon assignment invariants). Coupling to `characters.json` and `costs.json` stems from inline synchronous `recalculateCharacterCosts`.

### 2.10 weaponsSlice
- **Persisted state**:
  - `trackedWeapons`: PERSISTED USER STATE (`Array<TrackedWeapon>`)
    - Fields: `id`, `weapon_id`, `weaponName`, `level`, `ascension`, `targetLevel`, `targetAscension`, `currentRefinement`, `targetRefinement`, `assignedTo`, `createdAt`.
    - `costs`: DERIVED STATE (added only by `bulkUpdateWeapons`).
- **Ephemeral state**: None
- **Actions**:
  - `addTrackedWeapon`: ACTION
  - `removeTrackedWeapon`: ACTION
  - `batchRemoveWeapons`: ACTION
  - `updateTrackedWeapon`: ACTION
  - `bulkUpdateWeapons`: ACTION
  - `assignWeaponToCharacter`: ACTION
  - `unassignWeapon`: ACTION
- **Static data imports**:
  - `src/data/weapons.json` (used ONLY in `bulkUpdateWeapons`)
  - `src/utils/calculator.js` -> `src/data/costs.json` (used ONLY in `bulkUpdateWeapons`)
- **Cross-slice dependencies**:
  - Coordinates weapon assignment with `state.roster` (`equippedWeaponId`).
- **External side effects**: None
- **Architectural classification**: Coupling to `weapons.json` is narrow (only `bulkUpdateWeapons` imports it).

### 2.11 importSlice
- **Persisted state**: None
- **Ephemeral state**: None
- **Actions**:
  - `importData`: ACTION (replaces all user data slices from normalized backup)
  - `importGoodData`: ACTION (ingests GOOD format materials, characters, weapons)
  - `resetStore`: ACTION (resets all user slices to default empty states)
- **Static data imports**:
  - `charactersData` from `src/utils/characters.js` (UNUSED import in file)
  - `weaponsData` from `src/data/weapons.json` (used in `importGoodData`)
  - `getPrimaryInventoryList` from `src/utils/dataManager.js` (pulls `character_gems.json`, `misc_materials.json`, etc.)
  - `calculateWeaponCost` from `src/utils/calculator.js` (pulls `costs.json`)
  - `rosterHelpers.js` (pulls `characters.json`, `traveler.json`, `costs.json`)
- **Cross-slice dependencies**: Sets all store slices.
- **External side effects**: None
- **Architectural classification**: SHOULD BE EXTRACTED / DECOUPLED. Importing `dataManager.js` eagerly forces the 176 kB `character_gems` chunk into the initial static bundle even though `importGoodData` is only invoked from Settings.

### 2.12 achievementSlice
- **Persisted state**:
  - `achievementProgress`: PERSISTED USER STATE (`Record<string, { completed: boolean, completedAt: string | null }>`)
- **Ephemeral state**: None
- **Actions**:
  - `setAchievementCompleted`: ACTION
  - `toggleAchievement`: ACTION
  - `setAchievementProgress`: ACTION
  - `clearAchievementProgress`: ACTION
- **Static data imports**:
  - `src/utils/achievementProgress.js` -> `src/data/achievements/achievements.json` (505.6 kB raw!)
- **Cross-slice dependencies**: None
- **External side effects**: None
- **Architectural classification**: PRIMARY BOTTLENECK. Importing `achievementProgress.js` forces the entire 505.6 kB `achievements.json` database into the central store and the initial static graph.

---

## 3. Persistence Contract

The persistence contract is implemented in `src/store/persistence.ts`:

- **Storage Key**: `'travelers-toolkit-store'` (in `localStorage`). **MUST NEVER CHANGE.**
- **Storage Engine**: Browser `localStorage` via Zustand `persist` middleware.
- **Current Version**: `8`
- **Persisted Fields (via `partializeStore`)**:
  1. `roster`: `state.roster`
  2. `trackedWeapons`: `state.trackedWeapons`
  3. `inventory`: `state.inventory`
  4. `goals`: `state.goals`
  5. `resinCount`: `state.resinCount`
  6. `resinTimestamp`: `state.resinTimestamp`
  7. `serverRegion`: `state.serverRegion`
  8. `showDbBuilder`: `state.showDbBuilder`
  9. `autoBackupEnabled`: `state.autoBackupEnabled`
  10. `displayTimeZone`: `state.displayTimeZone`
  11. `achievementProgress`: `state.achievementProgress`
  12. `lastHoyolabCharacterSyncAt`: `state.lastHoyolabCharacterSyncAt`

### Migration Chain (`migrateStore`)

- `fromVersion < 2`: Converts legacy string `equippedWeapon` on roster entries into standalone `trackedWeapons` records with generated UUIDs; sets `equippedWeaponId` on roster entries.
- `fromVersion < 3`: Initializes `craftQueue: []`.
- `fromVersion < 4`: Deletes `craftQueue`; adds `currentRefinement: 1`, `targetRefinement: 1` to all `trackedWeapons`.
- `fromVersion < 5`: Strips obsolete Google tokens (`googleAccessToken`, `tokenExpiry`, `googleUser`) and HoYoLAB cookies (`hoyolabLtuid`, `hoyolabLtoken`) from persistent state.
- `fromVersion < 6`: Initializes `displayTimeZone: 'auto'`.
- `fromVersion < 7`: Sanitizes `achievementProgress` if present.
- `fromVersion < 8`: Initializes `lastHoyolabCharacterSyncAt: null`.

### Merge & Reset Behavior

- **Merge Behavior**: Zustand default shallow object merge on hydration.
- **Reset Behavior**: `resetStore()` resets all user state to empty objects/arrays and default flags. It preserves no user data.
- **Import/Export Assumptions**:
  - Backup Payload V1 format: `{ app: 'travelers-toolkit', schemaVersion: 1, createdAt: ISO, data: { ...persistedFields } }`.
  - Normalization validates top-level types and safely defaults absent fields.

---

## 4. Store Dependency Graph (Static Datasets)

```
useStore.js
â”œâ”€â”€ achievementSlice.js
â”‚   â””â”€â”€ achievementProgress.js
â”‚       â””â”€â”€ [DATA] src/data/achievements/achievements.json (505.64 kB)  <-- MAJOR BOTTLENECK
â”œâ”€â”€ persistence.ts
â”‚   â””â”€â”€ achievementProgress.js
â”‚       â””â”€â”€ [DATA] src/data/achievements/achievements.json (505.64 kB)  <-- MAJOR BOTTLENECK
â”œâ”€â”€ rosterSlice.js
â”‚   â””â”€â”€ rosterHelpers.js
â”‚       â”œâ”€â”€ characters.js
â”‚       â”‚   â”œâ”€â”€ [DATA] src/data/characters.json (30.16 kB)
â”‚       â”‚   â””â”€â”€ [DATA] src/data/traveler.json (3.35 kB)
â”‚       â””â”€â”€ calculator.js
â”‚           â””â”€â”€ [DATA] src/data/costs.json (21.46 kB)
â”œâ”€â”€ weaponsSlice.js
â”‚   â”œâ”€â”€ [DATA] src/data/weapons.json (36.93 kB)
â”‚   â””â”€â”€ calculator.js
â”‚       â””â”€â”€ [DATA] src/data/costs.json (21.46 kB)
â””â”€â”€ importSlice.ts
    â”œâ”€â”€ [DATA] src/data/weapons.json (36.93 kB)
    â”œâ”€â”€ dataManager.js
    â”‚   â”œâ”€â”€ [DATA] src/data/character_gems.json (175.78 kB chunk)     <-- MAJOR BOTTLENECK
    â”‚   â”œâ”€â”€ [DATA] src/data/misc_materials.json (8.22 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/normal_boss.json (5.71 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/weekly_boss.json (4.89 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/common_enemy.json (7.12 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/elite_enemy.json (11.45 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/local_specialty.json (13.82 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/forging_materials.json (2.95 kB)
    â”‚   â”œâ”€â”€ [DATA] src/data/talent_materials.json (7.34 kB)
    â”‚   â””â”€â”€ [DATA] src/data/weapon_ascension.json (8.15 kB)
    â””â”€â”€ rosterHelpers.js
        â””â”€â”€ (characters.json, traveler.json, costs.json)
```

Also, in the initial static application graph:
```
AppLayout.jsx
â””â”€â”€ backupUtils.ts
    â””â”€â”€ achievementProgress.js
        â””â”€â”€ [DATA] src/data/achievements/achievements.json (505.64 kB)
```

### Dataset Status Summary

| Dataset | Size (raw) | Baseline Location | Desired Target State |
|---|---|---|---|
| `achievements.json` | 505.64 kB | Initial (`useStore` + `AppLayout`) | **LAZY ROUTE** (`/achievements` & Settings import/export) |
| `character_gems.json` | 175.78 kB | Initial (`character_gems-[hash].js`) | **LAZY ROUTE** (`/inventory`, `/planner`) |
| `characters.json` | 30.16 kB | Initial (`useStore` + `Dashboard`) | Initial (needed by Dashboard roster cards) |
| `weapons.json` | 36.93 kB | Initial (`useStore` + `Dashboard`) | Initial (needed by Dashboard weapon cards) |
| `costs.json` | 21.46 kB | Initial (`useStore` + `Dashboard`) | Initial (needed by synchronous cost engine) |
| `changelog.js` | 127 kB | Route chunk (`Changelog.jsx`) | Route chunk (isolated in Phase 2) |

---

## 5. Phase 3 Architecture Results & Performance Metrics

### 5.1 Architecture Decoupling & Pre-Commit Corrections

1. **Lightweight Prerequisite Mapping (`achievementStagePrereqs.js`)**:
   - Extracted stage progression mapping into a lightweight deterministic table (`STAGE_PREREQUISITES`).
   - `normalizeStageProgress` evaluates prerequisite chaining purely from stage ID patterns and this table when canonical definitions are not passed, decoupling `achievementSlice` and `persistence.ts` from `achievements.json`.
   - Generated and verified by `scripts/update-achievements.mjs`.

2. **Deterministic Canonical ID Validation (`achievementCanonicalIds.js`)**:
   - `scripts/update-achievements.mjs` deterministically generates `src/utils/achievementCanonicalIds.js` exporting `ACHIEVEMENT_IDS` directly from in-memory canonical achievements.
   - `achievementProgress.js` creates a Set from `ACHIEVEMENT_IDS`, preserving 100% of pre-Phase-3 canonical membership semantics (`isValidAchievementId(id) === canonicalIds.has(id)`).
   - Structurally-valid but unknown IDs, made-up IDs, non-string tokens, and prototype-pollution keys are strictly rejected.

3. **Generator Ownership & Drift Detection (`update-achievements.mjs`)**:
   - `scripts/update-achievements.mjs` generates AND `--check` verifies both `achievementCanonicalIds.js` and `achievementStagePrereqs.js`.
   - Running `node scripts/update-achievements.mjs --check` verifies that all 5 artifacts (`categories.json`, `achievements.json`, `manifest.json`, `achievementCanonicalIds.js`, `achievementStagePrereqs.js`) are synchronized. Any drift causes an immediate exit with code 1 and a detailed list of drifted files.
   - **Manifest Decision**: `manifest.json` schema intentionally covers data JSONs (`categories.json`, `achievements.json`) per existing contract. Code artifacts in `src/utils/` are validated against in-memory generator output directly during `--check`.

4. **Domain Catalog Module (`achievementCatalog.js`)**:
   - Static achievement definitions and catalog query methods (`getAchievementDefinitions`, `isCanonicalAchievementId`, `getAchievementById`, `normalizeAchievementCatalogProgress`) reside in a dedicated domain module.
   - This catalog is imported only by `/achievements` components, achievement import/export helpers, and backup ingestion.

5. **Split Backup Payload Module (`backupPayload.ts`)**:
   - `getBackupPayload` and `isLocalUserDataEmpty` were isolated into `src/utils/backupPayload.ts` without importing achievement catalog or backup parsing logic.
   - `AppLayout.jsx` imports only `backupPayload.ts`, ensuring initial shell loading never pulls the backup validation engine or `achievements.json`. `restoreLatestRecoveryBackup` is dynamically imported on demand during interactive recovery.

### 5.2 Performance Metrics Comparison

| Metric | Phase 3 Baseline (Before) | Phase 3 Decoupled (After) | Change | % Change |
|---|---|---|---|---|
| `useStore` chunk (raw) | 633.99 kB | 233.83 kB | -400.16 kB | **-63.11%** |
| `useStore` chunk (gzip) | 99.54 kB | 23.37 kB | -76.17 kB | **-76.52%** |
| Initial static graph (raw) | 1,189.87 kB | 806.93 kB | -382.94 kB | **-32.18%** |
| Initial static graph (gzip) | 230.78 kB | 161.53 kB | -69.25 kB | **-30.01%** |
| Total JS emitted (raw) | 1,741.52 kB | 1,755.29 kB | +13.77 kB | +0.79% |
| Total JS emitted (gzip) | 360.84 kB | 369.78 kB | +8.94 kB | +2.48% |
| Emitted JS chunk count | 14 chunks | 17 chunks | +3 chunks | N/A |
| Largest chunk in build | 633.99 kB (`useStore`) | 398.42 kB (`achievements` lazy) | -235.57 kB | **-37.16%** |
| Vite >500 kB chunk warning | 1 warning (`useStore`) | 0 warnings | -1 warning | **ELIMINATED** |

### 5.3 Initial Static Closure Breakdown (After Phase 3 Correction)

The true initial static dependency closure for `index.html` consists of exactly 6 chunks:

| Chunk | Raw Size | Gzip Size | Role / Contents |
|---|---|---|---|
| `index-D-6tdoh2.js` | 363.91 kB | 100.33 kB | Application entry, routing shell, layout components |
| `useStore-DpBRaU1I.js` | 233.83 kB | 22.65 kB | Zustand store slices, sync logic, character/weapon state |
| `character_gems-DCbtC1Aa.js` | 175.78 kB | 25.00 kB | Static material catalog (pulled via `dataManager.js` in `importSlice`) |
| `achievementProgress-BQUEtS-4.js` | 19.14 kB | 7.04 kB | Canonical achievement IDs (18.5 kB raw), stage prereq map, progress sanitizers |
| `jsx-runtime-Cltr0gcK.js` | 8.43 kB | 3.23 kB | React 19 JSX runtime shared chunk |
| `resolver-DA1ZrN61.js` | 5.84 kB | 1.68 kB | Hookform resolver utility |
| **Total Initial Static Graph** | **806.93 kB** | **159.92 kB** | **True Initial JS Graph** |

### 5.4 Static Dataset Classification

| Dataset | Size (Raw) | Role / Classification | Status After Phase 3 |
|---|---|---|---|
| `achievements.json` | 505.64 kB | **LAZY ROUTE / NO LONGER STORE-REACHABLE** | Extracted into lazy route chunk `achievements-bXNXCMV4.js` (398.42 kB raw / 74.79 kB gzip), loaded strictly on `/achievements` or Settings backup ingestion. |
| `characters.json` | 30.16 kB | **INITIAL / CORE REFERENCE** | Required synchronously for character roster definitions, calculations, and Dashboard cards. |
| `traveler.json` | 3.35 kB | **INITIAL / CORE REFERENCE** | Required for Traveler multi-element progression resolution and weapon sync. |
| `weapons.json` | 36.93 kB | **INITIAL / CORE REFERENCE** | Required synchronously for weapon roster definitions, calculations, and Dashboard cards. |
| `costs.json` | 21.46 kB | **INITIAL / CORE REFERENCE** | Required synchronously by the cost engine for character and weapon ascension/talent calculations. |
| `character_gems.json` + materials | 175.78 kB | **INITIAL / PENDING DECOUPLING** | Statically reached via `dataManager.js` -> `importSlice.ts` (`importGoodData`). Retained in Phase 3 to preserve zero-risk synchronous GOOD import semantics; identified for Phase 4 decoupling. |
| `changelog.js` | 127 kB | **LAZY ROUTE / NO LONGER STORE-REACHABLE** | Isolated to `/changelog` route chunk in Phase 2. |

---

## 6. Validation & Testing Status

- **AUTOMATED VALIDATION**: **PASSED** (43 test files passed, 458 tests passed; TypeScript typecheck passed; generator check passed).
- **AGENT BROWSER VALIDATION**: **UNAVAILABLE** (Playwright driver 1.57.0 download failed with 404 from Azure CDN on Windows host environment).
- **USER MANUAL BROWSER VALIDATION**: **PENDING** (To be performed interactively by the user).
