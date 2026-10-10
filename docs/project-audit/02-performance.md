# Phase 0B: Performance Path Assessment

**Initial Bundle Contributors:**
Our previous assumption that data files were lazy was INCORRECT. The global Zustand store eagerly imports all major datasets:
- `weapons.json` (via `weaponsSlice.js` and `importSlice.ts`) - INITIAL
- `characters.json` (via `rosterSlice.js`) - INITIAL
- `costs.json` (via `calculator.js` imported by `rosterSlice.js`) - INITIAL
- `achievements.json` (via `achievementStats.js`) - INITIAL

Because `App.jsx` imports `useStore`, the store initializes immediately, pulling all these JSON files into the main bundle. Route splitting alone will NOT remove these from the initial load.

**Route Splitting Assessment:**
- **Changelog**: HIGH benefit. Imports a 127KB `changelog.js` file.
- **Achievements**: HIGH benefit. Massive component logic.
- **Settings/Planner/Weapons/Characters**: HIGH benefit for JS logic reduction, but data will still be loaded unless store is refactored.
- **Dashboard**: Low benefit, likely keep eager to avoid waterfall.

**Global Font Audit:**
- `genshin-font.ttf` (11MB) is mapped to the `body` and requested on INITIAL load by the browser.
- WOFF2 subsetting is required to resolve this bottleneck.
