# Phase 0: Architecture Map

**Frontend Lifecycle:**
`main.jsx` -> `App.jsx` -> `AppLayout` -> `Routes (eagerly loaded)` -> Components -> Zustand store.

**Store Architecture (Zustand):**
Store is modularized into slices under `src/store/slices/`:
- settingsSlice, sessionSlice, syncSlice, importSlice, resinSlice, rosterSlice, weaponsSlice, inventorySlice, goalsSlice, helpersSlice, achievementSlice, hoyolabSyncSlice.
- Single global store persists data using `zustand/middleware`'s `persist`. Migration logic is in `persistence.ts`.

**Backend Architecture (FastAPI):**
- Modular routers (`main.py`, `google_api.py`, `hoyolab_achievements.py`, `hoyolab_character_sync.py`).
- Security via Fernet-encrypted cookies (`tt_hoyolab_session`).
- Stateless server model depending on client-sent cookies for sessions.

**Data Flow:**
Static data generated via scripts -> stored in `src/data/` -> queried by domain utilities (`calculator.js`, `dataManager.js`) -> presented by components.
