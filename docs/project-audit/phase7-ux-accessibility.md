# Phase 7: UX, Accessibility & Production Polish Audit

> Status: Complete
> Baseline HEAD: `26711d8` (`fix: harden backend security boundaries`)
> Repository: `travelers-toolkit`

---

## 1. Executive Summary

Phase 7 hardens the user experience, accessibility, and production readiness of **Traveler's Toolkit** without altering underlying store persistence, domain calculations, or backend contracts.

Key targets addressed in this phase:
1. **F-002: Native Dialog Remediation**: Replaced 29 blocking `alert()` calls across 8 components with a lightweight, accessible, Genshin-themed in-app notification system (`notify.success`, `notify.error`, `notify.warning`, `notify.info`).
2. **Destructive Confirmation Preservation**: Retained deliberate, blocking confirmation safeguards for all destructive operations (e.g. factory data reset, character/weapon deletions).
3. **F-008: Global Font-Weight Override Removal**: Removed the universal CSS hack `* { font-weight: normal !important; }` in `src/index.css`, restoring intentional typography hierarchy (`font-bold`, `font-semibold`, `font-medium`) across headings, tables, and buttons.
4. **Global React Error Boundary**: Implemented an application-level Error Boundary around `<App />` providing branded, user-friendly recovery UI and preventing blank-screen crashes.
5. **Keyboard & Semantic Accessibility**:
   - Replaced interactive `<div>` elements with semantic `<button>` elements on top-bar Google authentication controls (`aria-label`, `aria-expanded`, `aria-haspopup`).
   - Added `aria-expanded` and `aria-controls` to the mobile sidebar toggle.
   - Implemented a "Skip to main content" link for keyboard users.
   - Enhanced modal accessibility (`role="dialog"`, `aria-modal="true"`, `Escape` handling).
   - Added theme-consistent `:focus-visible` outlines and `@media (prefers-reduced-motion: reduce)` support.
6. **Production Legal & OAuth Pages**: Added public `/privacy` and `/terms` routes with transparent, implementation-accurate disclosures required for Google OAuth verification and publishing.

---

## 2. Issues & Findings Inventory

| ID | Severity | Classification | Description | Affected Files | Remediation | Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: |
| **UX-01** | **P2** | VERIFIED ISSUE | 29 blocking, inaccessible `alert()` calls across the app | `Settings.jsx`, `Dashboard.jsx`, `AppLayout.jsx`, etc. | Lightweight in-app toast notification system | **Remediated** |
| **UX-02** | **P2** | ACCESSIBILITY DEFECT | `* { font-weight: normal !important; }` suppresses all font weights | `src/index.css` | Remove universal override; retain font family | **Remediated** |
| **UX-03** | **P2** | VERIFIED ISSUE | Lack of global React Error Boundary causes blank-screen crash on render errors | `src/main.jsx` | Add `ErrorBoundary` component with recovery UI | **Remediated** |
| **UX-04** | **P2** | ACCESSIBILITY DEFECT | Non-semantic Google avatar controls (`div` with `onClick`) | `src/layouts/AppLayout.jsx` | Convert to `<button>` with ARIA labels and states | **Remediated** |
| **UX-05** | **P3** | ACCESSIBILITY DEFECT | Mobile sidebar toggle lacks `aria-expanded` and `aria-controls` | `src/layouts/AppLayout.jsx` | Add ARIA attributes and Escape key listener | **Remediated** |
| **UX-06** | **P3** | UX IMPROVEMENT | Route loading fallback lacks live region / status role | `src/App.jsx` | Add `role="status"` and `aria-live="polite"` | **Remediated** |
| **UX-07** | **P3** | UX IMPROVEMENT | Missing "Skip to main content" link for keyboard navigation | `src/layouts/AppLayout.jsx` | Add accessible skip link targeting `#page-content` | **Remediated** |
| **UX-08** | **P3** | ACCESSIBILITY DEFECT | Missing focus-visible ring on interactive elements | `src/index.css` | Add theme-consistent `:focus-visible` styling | **Remediated** |
| **UX-09** | **P3** | ACCESSIBILITY DEFECT | Smooth scrolling and animations lack `prefers-reduced-motion` check | `src/index.css` | Add `@media (prefers-reduced-motion: reduce)` | **Remediated** |
| **UX-10** | **P2** | UX IMPROVEMENT | Missing Privacy Policy and Terms of Service for Google OAuth verification | `src/pages/PrivacyPolicy.jsx`, `src/pages/TermsOfService.jsx` | Add `/privacy` and `/terms` public routes | **Remediated** |

---

## 3. Native Dialog Inventory

| File | Line | Action | Current Message | Type | Blocking? | Destructive? | Replacement |
| :--- | :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `Settings.jsx` | 67 | HoYoLAB validate | "Please enter both ltuid and ltoken." | Warning | Yes | No | `notify.warning` |
| `Settings.jsx` | 76 | HoYoLAB connect | "HoYoLAB connected successfully!" | Success | Yes | No | `notify.success` |
| `Settings.jsx` | 78 | HoYoLAB connect fail | `Connection failed: ${res.message \|\| res.error}` | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 84 | HoYoLAB disconnect | "HoYoLAB disconnected." | Info | Yes | No | `notify.info` |
| `Settings.jsx` | 101 | Google backup list fail | "Failed to fetch backups from Google Drive." | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 111 | Google backup success | "Cloud sync successful!" | Success | Yes | No | `notify.success` |
| `Settings.jsx` | 117 | Google backup fail | "Failed to sync to Google Drive." | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 125 | Google restore validate | "Please connect to Google Drive first." | Warning | Yes | No | `notify.warning` |
| `Settings.jsx` | 135 | Google restore success | "Cloud restore successful!" | Success | Yes | No | `notify.success` |
| `Settings.jsx` | 137 | Google restore empty | "No backup found in Google Drive." | Info | Yes | No | `notify.info` |
| `Settings.jsx` | 144 | Google restore fail | "Failed to restore from Google Drive." | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 178 | Local JSON import | "Data imported successfully!" | Success | Yes | No | `notify.success` |
| `Settings.jsx` | 181 | Local JSON import fail | `Failed to import data...` | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 206 | GOOD import empty | "No recognized Traveler's Toolkit data was found..." | Info | Yes | No | `notify.info` |
| `Settings.jsx` | 212 | GOOD import fail | "Failed to parse GOOD data..." | Error | Yes | No | `notify.error` |
| `Settings.jsx` | 240 | GOOD import summary | `Imported X characters, Y weapons...` | Success | Yes | No | `notify.success` |
| `Settings.jsx` | 252 | Reset success | "Data reset successfully." | Info | Yes | No | `notify.info` |
| `Settings.jsx` | 245 | Factory Reset confirm | "Are you sure you want to delete all data?..." | Confirmation | Yes | Yes | Retained `window.confirm` |
| `Dashboard.jsx` | 80 | Real-Time Notes 401 | "Authentication failed. Please check your cookies." | Error | Yes | No | `notify.error` |
| `Dashboard.jsx` | 84 | Real-Time Notes fail | "Failed to sync Real-Time Notes: ..." | Error | Yes | No | `notify.error` |
| `Dashboard.jsx` | 100 | Quick Add Roster empty | "All available characters are already in your roster!" | Info | Yes | No | `notify.info` |
| `Dashboard.jsx` | 104 | Quick Add Roster confirm | "Are you sure you want to add all X missing characters..." | Confirmation | Yes | No | Retained `window.confirm` |
| `Dashboard.jsx` | 107 | Quick Add Roster success | `Successfully added ${missing.length} missing characters!` | Success | Yes | No | `notify.success` |
| `AppLayout.jsx` | 146 | Cloud recovery success | "Latest cloud state restored successfully." | Success | Yes | No | `notify.success` |
| `AppLayout.jsx` | 150 | Cloud recovery fail | `Restore failed: ${e.message}` | Error | Yes | No | `notify.error` |
| `BulkEditWeaponModal.jsx` | 127 | Overrides fail | "An error occurred while applying overrides..." | Error | Yes | No | `notify.error` |
| `CookiePromptModal.jsx` | 14 | Cookie prompt validate | "Please provide both ltuid and ltoken." | Warning | Yes | No | `notify.warning` |
| `CookiePromptModal.jsx` | 28 | Cookie prompt fail | `Connection failed: ${res.message \|\| res.error}` | Error | Yes | No | `notify.error` |
| `HoyolabSyncPreviewModal.jsx` | 214 | Sync apply fail | `Failed to apply sync: ${e.message}` | Error | Yes | No | `notify.error` |
| `BulkEditCharacterModal.jsx` | 160 | Overrides fail | "An error occurred while applying overrides..." | Error | Yes | No | `notify.error` |
| `StagingModal.jsx` | 35 | Staging JSON validate | "Invalid JSON format!" | Error | Yes | No | `notify.error` |
| `Characters.jsx` | 203 | Bulk delete characters | "Are you sure you want to delete these X characters?" | Confirmation | Yes | Yes | Retained `window.confirm` |
| `Weapons.jsx` | 184 | Bulk delete weapons | "Are you sure you want to delete these X weapons?" | Confirmation | Yes | Yes | Retained `window.confirm` |
| `Weapons.jsx` | 304 | Single delete weapon | "Are you sure you want to delete this weapon?" | Confirmation | Yes | Yes | Retained `window.confirm` |
| `AddWeaponModal.jsx` | 192 | Weapon reassign confirm | "Weapon is equipped to X. Reassign?" | Confirmation | Yes | Yes | Retained `window.confirm` |

Total native alerts: 29 (all replaced).
Total native confirms: 6 (all preserved safely for destructive/confirmation actions).

---

## 4. Notification Architecture

- **Store/Manager**: Module-level event emitter / reactive subscriber pattern (`src/utils/notify.js`). No external libraries.
- **Methods**:
  - `notify.success(message)`
  - `notify.error(message)`
  - `notify.warning(message)`
  - `notify.info(message)`
- **Accessibility**:
  - Container uses `role="region"` and `aria-label="Notifications"`.
  - Informational/Success/Warning toasts use `role="status"` and `aria-live="polite"`.
  - Error toasts use `role="alert"` and `aria-live="assertive"`.
  - Dismiss button has `aria-label="Dismiss notification"`.
- **Timing & Persistence**:
  - Success/Info: 4,000ms auto-dismiss.
  - Warning: 6,000ms auto-dismiss.
  - Error: 8,000ms auto-dismiss (longer reading time) + manual dismiss button.
  - Active duplicate messages are deduplicated to avoid visual floods.

---

## 5. Global Error Boundary Architecture

- **Component**: `src/components/ErrorBoundary.jsx`.
- **Placement**: Top-level wrapper in `src/main.jsx` around `<App />`.
- **Behavior**:
  - Catches unhandled React render and lifecycle errors.
  - Suppresses unstyled blank page crashes.
  - Logs detailed error information to `console.error` for developer diagnostics.
  - Displays a clean, Genshin-styled card with friendly messaging.
  - Prevents leaking raw internal stack traces to end users.
  - Offers "Reload Application" (`window.location.reload()`) and "Return to Dashboard" (`window.location.href = '/'`).
  - Does NOT perform destructive resets or clear localStorage.

---

## 6. Typography & Styling Audit

- **Universal Override Removal**:
  - Removed `* { font-weight: normal !important; }` in `src/index.css`.
  - Verified headings, card titles, table headers, and badges now reflect intended weights (`font-bold`, `font-semibold`, `font-medium`).
  - Body text remains clean and readable without artificial bold distortion.
- **Font-Family**:
  - `body { font-family: 'GenshinFont', sans-serif !important; }` remains intact. Font subsetting and format conversion are deferred to Phase 8.

---

## 7. Keyboard & Semantic Navigation Audit

- **Skip Link**: Added `<a href="#page-content">Skip to main content</a>` visually hidden until focused via Tab.
- **Header Landmarks**:
  - `<header className="topbar">`
  - Signed-out Google trigger: converted from `<div>` to semantic `<button type="button">` with `aria-label="Sign in with Google"`.
  - Signed-in Google trigger: converted from `<div>` to `<button type="button">` with `aria-label="Google account menu"`, `aria-expanded`, and `aria-haspopup="true"`.
  - Google dropdown closes on `Escape` and outside click.
- **Mobile Sidebar**:
  - `#sidebar-toggle` has `aria-expanded={sidebarOpen}` and `aria-controls="app-sidebar"`.
  - `Escape` closes mobile sidebar drawer.
  - Selecting a route closes the mobile sidebar drawer.
- **Sidebar Legal Navigation**:
  - Added dedicated `<nav className="sidebar-legal-nav" aria-label="Legal navigation">` at the bottom of the sidebar.
  - Expanded Desktop & Mobile: Displays icons (`ðŸ“œ`, `âš–ï¸`) alongside readable labels ("Privacy Policy", "Terms of Service").
  - Collapsed Desktop: Preserves both icons centered in the 72px dock (`aria-label` and `title` attributes retained for accessibility) while hiding only `.legal-link-label` via CSS media query.
- **Main Landmark**: `<main id="page-content" className="flex-1 p-6 md:p-8" tabIndex="-1">`.
- **Footer Landmark**:
  - Added semantic `<footer>` with links to `/privacy` and `/terms` and non-affiliation disclaimer:
    *"Traveler's Toolkit is an independent fan-made tool and is not affiliated with HoYoverse."*

---

## 8. Legal & Production Readiness

- **Public Routes Added**:
  - `/privacy` -> `src/pages/PrivacyPolicy.jsx`
  - `/terms` -> `src/pages/TermsOfService.jsx`
- **Implementation Accuracy**:
  - Explains that app state is stored client-side in browser `localStorage`.
  - Explains that Google Drive backup uses the restricted `appDataFolder` and stores only user toolkit state.
  - Explains that HoYoLAB credentials (`ltuid`, `ltoken`) are encrypted in HttpOnly session cookies solely for proxying miHoYo game data.
  - States clearly that no personal data is sold or shared with third-party advertisers.
  - Explains how users can disconnect Google/HoYoLAB or perform a complete local data reset.
  - Incorporates Google API Limited Use compliance statement reflecting actual use.
  - *Note: Legal pages provide plain, implementation-accurate product disclosures, not formal legal advice.*

---

---

## 9. Automated Verification Results

- **TypeScript (`npm run typecheck`)**: Passed (0 errors).
- **Frontend Test Suite (`npm run test:run`)**:
  - Test files: 51 passed / 51 total (100%).
  - Total tests: 516 passed / 516 total (100%).
  - New test suites added:
    - `src/utils/notify.test.js`: 6/6 passed.
    - `src/components/ErrorBoundary.test.jsx`: 4/4 passed.
    - `src/layouts/AppLayout.test.jsx`: 5/5 passed.
    - `src/pages/Settings.test.jsx`: 3/3 passed.
- **Generator Integrity Checks**:
  - `node scripts/update-achievements.mjs --check`: Passed (up to date).
  - `node scripts/update-hoyolab-map.mjs --check`: Passed (up to date).
- **Production Build (`npm run build`)**: Passed (Vite built 176 modules in ~7.3s, including `PrivacyPolicy` and `TermsOfService` chunks).
- **Git Hygiene**:
  - `git diff --check`: Passed (0 whitespace errors).
  - No backend files touched.
  - No Zustand persistence key or storage mechanics touched.

---

## 10. Deferred Items

- **Phase 8 (Assets / Delivery)**: Font WOFF2 conversion, font subsetting, image asset compression (`bg.png`).
- **Phase 9 (Tooling / Linting)**: ESLint/Prettier configuration, migrating legacy component test suites to React Testing Library.
