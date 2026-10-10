# Phase 0B: Test Gaps

**act(...) Warnings:**
- Root cause: Tests (e.g., `Changelog.test.jsx`, `Achievements.test.jsx`) are manually calling `act(() => root.render(...))` using raw `react-dom/client` instead of `@testing-library/react`.
- This bypasses standard testing environments and causes the "environment is not configured to support act" warnings. Indicates a highly fragile, custom test setup.

**Cancel Semantics (CRITICAL GAP):**
- ZERO tests exist for modal cancel behavior.
- CharacterModal, WeaponModal, and Settings imports do not have tests verifying that state is left pristine if the user aborts an action.
- This directly allowed finding F-007 (destructive mutations before save) to slip through.

**Error Boundaries:**
- The application completely lacks a React `ErrorBoundary`.
- A crash in any component (e.g., HoYoLAB sync data parsing) will result in a white screen of death for the entire app.
