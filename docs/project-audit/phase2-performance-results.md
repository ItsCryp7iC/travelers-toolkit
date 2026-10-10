# Phase 2 Performance Results

## Baseline Metrics (ecd85b1)
- **A. ENTRY CHUNK SIZE**: 1,732.29 kB (`index-[hash].js`) | Gzip: 356.11 kB
- **B. INITIAL STATIC JS GRAPH**: 1,732.29 kB | Gzip: 356.11 kB
- **C. TOTAL EMITTED JS**: 1,732.29 kB
- **CSS Size**: 82.29 kB (`index-[hash].css`)
- **Number of JS Chunks**: 1
- **Vite Warnings**: `(!) Some chunks are larger than 500 kB after minification.`

## After Route Code-Splitting
- **A. ENTRY CHUNK SIZE**: 365.78 kB (`index-[hash].js`) | Gzip: 101.47 kB
- **B. INITIAL STATIC JS GRAPH**: 1,189.87 kB | Gzip: 230.78 kB
- **C. TOTAL EMITTED JS**: 1,736.63 kB
- **Number of JS Chunks**: 15
- **Largest Chunk**: `useStore-[hash].js`: 633.99 kB
- **Vite Warnings**: `(!) Some chunks are larger than 500 kB after minification.` (triggered by useStore)

### Initial Static Graph Reduction
- **Raw Size Reduction**: 31.31%
- **Gzip Size Reduction**: 35.19%

### Exact Chunks in Initial Static JS Graph
1. `index-[hash].js` (365.78 kB)
2. `useStore-[hash].js` (633.99 kB)
3. `character_gems-[hash].js` (175.78 kB)
4. `jsx-runtime-[hash].js` (8.43 kB)
5. `resolver-[hash].js` (5.84 kB)

### Data Bundling Analysis
1. `src/data/changelog.js` -> **ROUTE CHUNK**: Only imported by the lazy loaded `Changelog.jsx` route component.
2. `src/data/characters.json` -> **INITIAL STATIC GRAPH**:
   `App.jsx` -> `Dashboard.jsx` -> `src/utils/characters.js` -> `src/data/characters.json`.
3. `src/data/weapons.json` -> **INITIAL STATIC GRAPH**:
   `App.jsx` -> `Dashboard.jsx` -> `src/data/weapons.json`.
4. `src/data/costs.json` -> **INITIAL STATIC GRAPH**:
   `App.jsx` -> `Dashboard.jsx` -> `src/utils/calculator.js` -> `src/data/costs.json`.
5. `src/data/achievements/achievements.json` -> **INITIAL STATIC GRAPH**:
   `App.jsx` -> `useStore.js` -> `achievementSlice.js` -> `achievementProgress.js` -> `achievements.json`.
