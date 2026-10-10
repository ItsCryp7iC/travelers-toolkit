# Remediation Roadmap (Phase 0B)

**Phase 1 â€” Critical correctness & reliability**
- Target: F-007 (CharacterModal mutation before save bug).
- Implement Cancel semantics tests.

**Phase 2 â€” Frontend performance & loading**
- Target: F-003 (Route-level code splitting via `React.lazy`).

**Phase 3 â€” Store/state architecture**
- Target: F-009 (Fix `useStore()` destructuring in Settings).
- Refactor heavy `useStore(s => s.roster)` subscriptions in Characters/Weapons tables.
- Strategy: Move JSON imports out of store slices if possible, or lazy load data.

**Phase 4 â€” React/component cleanup**
- Target: F-006 (Extract logic from `HoyolabSyncPreviewModal.jsx`).
- Target: F-001 (Document `CharacterModal` intentional exhaustive-deps bypass).

**Phase 5 â€” Domain/data integrity**
- Standardize dataManager.js.

**Phase 6 â€” Backend/API/security**
- Security verification confirmed: Sessions use Fernet properly, HttpOnly, and strict CORS. `SameSite=Lax` is acceptable since there are no mutating GET requests, but CSRF considerations remain. No code changes immediately required.

**Phase 7 â€” UX/accessibility**
- Target: F-002 (Replace `alert` usage with proper toasts).
- Target: F-008 (Remove `* { font-weight: normal !important; }` global CSS hack).
- Implement global Error Boundary.

**Phase 8 â€” Assets/delivery**
- Target: F-004 (Convert 11MB `genshin-font.ttf` to WOFF2 subset).
- Compress `bg.png`.

**Phase 9 â€” Tests/tooling/maintainability**
- Target: F-005 (ESLint/Prettier).
- Migrate raw `root.render` tests to `@testing-library/react` to fix `act(...)` warnings.

**Phase 10 â€” Final integration hardening**
- Ensure all pieces work together securely before production.
