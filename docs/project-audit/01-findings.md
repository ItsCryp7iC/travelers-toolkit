# Phase 0B: Verified Findings

**ID: F-001** (DOWNGRADED)
- **Severity**: P4 (was P1)
- **Area**: Frontend Correctness
- **File(s)**: src/components/CharacterModal.jsx
- **Symbol**: useEffect on line 227
- **Evidence**: `eslint-disable-line react-hooks/exhaustive-deps` used for `rosterEntry`.
- **User impact**: Negligible.
- **Root cause**: Intentionally suppressed. If `rosterEntry` was a dependency, external syncs or unrelated renders would overwrite the user's unsaved local draft edits (level, ascension).
- **Recommended direction**: Add a comment explaining the intentional omission, or refactor to use a ref for initial state copy.
- **Risk**: Low.
- **Tests required**: None.
- **Remediation phase**: Phase 4

**ID: F-002** (CONFIRMED)
- **Severity**: P2
- **Area**: Error Handling / UX
- **File(s)**: src/pages/Settings.jsx, src/pages/Dashboard.jsx, src/components/BulkEditCharacterModal.jsx
- **Symbol**: alert()
- **Evidence**: `alert("Failed to sync Real-Time Notes: " + res.error)` in Dashboard. `alert(error.message)` in Settings.
- **User impact**: Blocking UI. Raw exceptions from backend are exposed directly to the user.
- **Root cause**: Lack of a centralized toast notification system.
- **Recommended direction**: Implement a Toast context/provider. Filter backend errors before display.
- **Risk**: Low.
- **Tests required**: None.
- **Remediation phase**: Phase 7

**ID: F-003** (RECLASSIFIED)
- **Severity**: P2 (was P1)
- **Area**: Performance / Loading
- **File(s)**: src/App.jsx
- **Symbol**: Imports
- **Evidence**: Eager routing imports all major pages.
- **User impact**: Massive initial bundle size (~1.73MB).
- **Root cause**: Missing `React.lazy()` for route-level components.
- **Recommended direction**: Wrap routes in `React.lazy` and `Suspense`.
- **Risk**: Medium.
- **Tests required**: Smoke test lazy boundaries.
- **Remediation phase**: Phase 2

**ID: F-004** (CONFIRMED)
- **Severity**: P2
- **Area**: Performance / Assets
- **File(s)**: public/fonts/genshin-font.ttf
- **Symbol**: @font-face
- **Evidence**: `genshin-font.ttf` is 11MB and forced globally on `body`.
- **User impact**: 11MB blocking network request on initial load.
- **Root cause**: Unoptimized TTF format and global CSS selector.
- **Recommended direction**: Convert to WOFF2 subset, apply lazy font-display: swap.
- **Risk**: Low.
- **Tests required**: Visual inspection.
- **Remediation phase**: Phase 8

**ID: F-005** (CONFIRMED)
- **Severity**: P3
- **Area**: Tooling
- **File(s)**: package.json
- **Symbol**: devDependencies
- **Evidence**: No ESLint, Prettier configured.
- **User impact**: Inconsistent codebase, higher review overhead.
- **Root cause**: Missing setup.
- **Recommended direction**: Implement ESLint/Prettier.
- **Risk**: Low.
- **Tests required**: None.
- **Remediation phase**: Phase 9

**ID: F-006** (CONFIRMED)
- **Severity**: P2
- **Area**: Component Architecture
- **File(s)**: src/components/HoyolabSyncPreviewModal.jsx
- **Symbol**: HoyolabSyncPreviewModal
- **Evidence**: 756 lines long, mixes data fetching, massive table rendering, and state mapping.
- **User impact**: High maintenance burden.
- **Root cause**: Over-centralization of logic.
- **Recommended direction**: Split UI rows and custom hooks.
- **Risk**: High.
- **Tests required**: Sync flow integration tests.
- **Remediation phase**: Phase 4

**ID: F-007** (NEW - HIGH PRIORITY)
- **Severity**: P1
- **Area**: Data Integrity / State Mutation
- **File(s)**: src/components/CharacterModal.jsx
- **Symbol**: onChange handlers for Weapon Select/Sliders
- **Evidence**: Modifies global Zustand store `addTrackedWeapon`, `unassignWeapon`, `updateTrackedWeapon` immediately when a weapon is changed in the draft UI, before "Save" is clicked.
- **User impact**: Pressing "Cancel" leaves orphaned weapons in the store, corrupting inventory state and silently modifying weapon levels.
- **Reproduction**: Open character -> equip weapon -> click Cancel -> weapon is now tracked globally.
- **Root cause**: Directly calling store mutators in a modal that is supposed to be a draft.
- **Recommended direction**: Use local state for the draft weapon object. Only commit to store in `handleSave`.
- **Risk**: Medium.
- **Tests required**: Cancel semantics test.
- **Remediation phase**: Phase 1

**ID: F-008** (NEW)
- **Severity**: P2
- **Area**: CSS / UX
- **File(s)**: src/index.css
- **Symbol**: `* { font-weight: normal !important; }`
- **Evidence**: Overrides all Tailwind font-weight utilities.
- **User impact**: All text is rendered normal weight; `font-bold` and `font-semibold` are silently broken application-wide.
- **Root cause**: Attempted brute-force application of the custom font.
- **Recommended direction**: Remove the `*` selector override. Use standard font families.
- **Risk**: Medium (visual changes across app).
- **Tests required**: Visual regression.
- **Remediation phase**: Phase 7

**ID: F-009** (NEW)
- **Severity**: P1
- **Area**: Performance / Store Subscriptions
- **File(s)**: src/pages/Settings.jsx
- **Symbol**: `const { ... } = useStore();`
- **Evidence**: Settings page subscribes to the ENTIRE store without a selector.
- **User impact**: Settings page re-renders on EVERY state change across the app.
- **Root cause**: Destructuring `useStore()` directly.
- **Recommended direction**: Use granular selectors `useStore(s => s.field)`.
- **Risk**: Low.
- **Tests required**: None.
- **Remediation phase**: Phase 3
