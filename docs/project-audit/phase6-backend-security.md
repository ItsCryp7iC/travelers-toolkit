# Phase 6: Backend / API / Security Hardening Audit

> Status: Completed / Verified
> Baseline HEAD: `714132a` (`fix: harden domain data integrity`)
> Repository: `travelers-toolkit`

---

## 1. Executive Summary

Phase 6 hardens the FastAPI backend, API contracts, session security, encryption, and upstream service resilience for **Traveler's Toolkit**.

The backend serves as a secure, stateless companion to the frontend, handling:
1. **HoYoLAB session proxying**: Encrypting sensitive user credentials (`ltuid`, `ltoken`) into client-side HttpOnly cookies and proxying authenticated requests to miHoYo/HoYoLAB APIs (real-time resin/realm currency, character sync, achievement summaries).
2. **Google Drive backup integration**: Managing OAuth2 authorization and encrypted backup storage in the user's private Google Drive `appDataFolder`.

This audit establishes a concrete threat model, inventories all endpoints and data flows, documents verified security and reliability findings, and implements targeted defensive hardening without breaking frontend API contracts or introducing unnecessary infrastructure complexity.

---

## 2. Backend Inventory

| File / Component | Path | Responsibility |
| :--- | :--- | :--- |
| **FastAPI Entrypoint** | `backend/main.py` | App lifecycle, middleware, HoYoLAB endpoints (`/api/hoyolab/*`, `/api/notes`), health check, exception handlers |
| **Google Router** | `backend/google_api.py` | Google OAuth2 flow, Drive backup synchronization (`/api/google/*`), session refresh |
| **Service: Achievements** | `backend/hoyolab_achievements.py` | Pure normalization of raw HoYoLAB achievement category data |
| **Service: Character Sync** | `backend/hoyolab_character_sync.py` | Multi-step HoYoLAB character/weapon/talent fetch and aggregation (`build_sync_preview`) |
| **Configuration & Security** | `backend/config.py` | Environment loading, Fernet key validation, CORS origin parser, cookie policy helpers |
| **Dependencies** | `backend/requirements.txt` | Explicitly pinned Python dependencies (`fastapi`, `genshin`, `cryptography`, `httpx`, `pydantic`) |
| **Unit Tests** | `backend/tests/` | 98 tests covering config, achievements, character sync, and security hardening |

---

## 3. Threat Model

### 3.1 Assets
1. **HoYoLAB Credentials**: `ltuid` and `ltoken` granting access to the player's miHoYo account data.
2. **Encrypted Session Cookies**: `tt_hoyolab_session` and `tt_google_session` storing encrypted tokens in the user's browser.
3. **Backend Encryption Keys**: `HOYOLAB_SESSION_KEY` and `GOOGLE_SESSION_KEY` (AES-128-CBC + HMAC-SHA256 via Fernet).
4. **User Game Data**: Real-time resin, realm currency, character levels, talents, weapons, and achievement progress.
5. **Google Drive Backups**: Player backup payloads stored in `appDataFolder`.
6. **API Availability**: Resilience of the FastAPI server against unhandled exceptions, stalling upstreams, and resource exhaustion.

### 3.2 Trust Boundaries
```
[ Untrusted Client / Browser ]
           â”‚  (HTTPS / Cookie: HttpOnly, SameSite=Lax)
           â–¼
[ Traveler's Toolkit Backend (FastAPI) ]
           â”‚
     â”Œâ”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
     â”‚ (Outbound HTTPS)             â”‚ (Outbound HTTPS)
     â–¼                              â–¼
[ HoYoLAB / miHoYo APIs ]    [ Google OAuth / Drive APIs ]
```

### 3.3 Attacker Classes & Threat Scenarios
1. **Malicious External Website**: Attempting Cross-Site Request Forgery (CSRF) or Cross-Origin Resource Sharing (CORS) abuse to extract player game data or hijack sessions.
2. **Unauthenticated Public Caller**: Scanning endpoints, sending malformed payloads, or submitting oversized bodies to cause crashes or denial of service.
3. **Tampering / Session Replay Attacker**: Attempting to forge, truncate, modify, or replay stale encrypted session cookies.
4. **Upstream Failure / Slowloris**: HoYoLAB or Google endpoints becoming unresponsive, returning unexpected error codes, or sending malformed JSON.
5. **Information Leakage**: Leaking raw credentials, tracebacks, environment variables, or upstream error bodies through HTTP error responses or server logs.

---

## 4. Endpoint Inventory

| Method | Path | Auth Required? | Cookie Read | Cookie Written | Body Input | Query Input | Upstream Calls | Rate/Abuse Sensitive? | Response Contract |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `GET` | `/api/health` | No | None | None | None | None | None | No | `{"status": "ok"}` |
| `POST` | `/api/hoyolab/session` | No (initial) | None | `tt_hoyolab_session` | `AuthPayload` | None | HoYoLAB Notes test | High | `{"connected": True}` |
| `GET` | `/api/hoyolab/session` | Optional | `tt_hoyolab_session` | Delete on invalid | None | None | None (local decrypt) | Low | `{"connected": bool}` |
| `DELETE` | `/api/hoyolab/session` | No | None | `tt_hoyolab_session` (del) | None | None | None | Low | `{"connected": False}` |
| `POST` | `/api/notes` | Yes | `tt_hoyolab_session` | Delete on 401 | `NotesPayload` | None | HoYoLAB Notes | High | `{"resin": {...}, "realm_currency": {...}}` |
| `POST` | `/api/hoyolab/achievements` | Yes | `tt_hoyolab_session` | Delete on 401 | `AchievementPayload` | None | HoYoLAB Record | High | `{"connected": True, "totalCompleted": int, "categories": [...]}` |
| `POST` | `/api/hoyolab/character-sync-preview` | Yes | `tt_hoyolab_session` | Delete on 401 | `CalculatorSyncPayload` | None | HoYoLAB Characters/Calc | High | `{"characters": [...]}` |
| `GET` | `/api/google/auth/start` | No | None | `tt_google_oauth_state` | None | None | None (redirect) | Low | 307 Redirect to Google |
| `GET` | `/api/google/auth/callback` | State | `tt_google_oauth_state` | `tt_google_session` | None | `code`, `state` | Google Token | Low | HTML popup callback |
| `GET` | `/api/google/session` | Yes | `tt_google_session` | Delete on invalid | None | None | Google UserInfo | Low | `{"connected": bool, "user": {...}}` |
| `DELETE` | `/api/google/session` | No | None | `tt_google_session` (del) | None | None | None | Low | `{"connected": False}` |
| `POST` | `/api/google/backups/manual` | Yes | `tt_google_session` | None | `BackupEnvelope` | None | Google Drive Upload | High | `{"success": True}` |
| `PUT` | `/api/google/backups/auto` | Yes | `tt_google_session` | None | `BackupEnvelope` | None | Google Drive Upload | High | `{"success": True}` |
| `GET` | `/api/google/backups` | Yes | `tt_google_session` | Delete on 401 | None | None | Google Drive Search | Low | List of backup files |
| `GET` | `/api/google/backups/recovery` | Yes | `tt_google_session` | Delete on 401 | None | None | Google Drive Search/Get | Low | JSON file content |
| `GET` | `/api/google/backups/auto/status` | Yes | `tt_google_session` | Delete on 401 | None | None | Google Drive Search | Low | `{"exists": bool, "modifiedTime": str\|null}` |
| `GET` | `/api/google/backups/{file_id}` | Yes | `tt_google_session` | Delete on 401 | None | None | Google Drive Get | Low | JSON file content |

---

## 5. Security Audit Findings & Classifications

| ID | Severity | Category | Description | Evidence | Fix | Test | Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **SEC-01** | **P2** | Reliability / DoS | Missing timeouts on external HTTP requests | `google_api.py` instantiated `httpx.AsyncClient()` with default/no explicit timeouts across 8 endpoints; `main.py` HoYoLAB upstream calls lacked async timeout guards. | Introduce `GOOGLE_HTTP_TIMEOUT = httpx.Timeout(15.0, connect=5.0)` and `HOYOLAB_UPSTREAM_TIMEOUT = 15.0` with `asyncio.wait_for`. | Unit test mocking timeout returning 504 | **Fixed** |
| **SEC-02** | **P2** | Info Disclosure | Unsanitized upstream error responses and tracebacks in logs | `main.py` raised raw `str(e)` in `HTTPException` (lines 136, 219, 321) and printed full tracebacks via `print(traceback.format_exc())`. | Replace `str(e)` with sanitized, mapped error details; replace `print` with structured logger redacting secrets. | Unit tests asserting error bodies and log hygiene | **Fixed** |
| **SEC-03** | **P2** | Input Validation | Unbounded request fields, UID out-of-range, and unparsed pasted cookies | `uid` in payloads was unconstrained integer; `ltuid`/`ltoken` had no length caps; pasted `ltuid_v2=...;` strings were passed raw. | Enforce Genshin UID bounds (`ge=100000000, le=9999999999`), max field lengths, and add `sanitize_credential_token` helper. | Unit tests for invalid UID, oversized tokens, pasted cookie formatting | **Fixed** |
| **SEC-04** | **P2** | Data Privacy | Missing `Cache-Control: no-store` on authenticated API responses | Responses carrying private game stats (resin, characters, achievements, backups) did not instruct intermediaries not to store data. | Add `Cache-Control: no-store, no-cache, must-revalidate` to authenticated endpoints via security middleware. | Response header verification tests | **Fixed** |
| **SEC-05** | **P3** | Session Security | Fernet token decryption lacked server-side TTL enforcement | `_get_hoyolab_client` and `get_valid_access_token` called `fernet.decrypt()` without verifying timestamp TTL against `SESSION_COOKIE_MAX_AGE`. | Add `ttl=SESSION_COOKIE_MAX_AGE` (30 days) to Fernet decrypt calls for both HoYoLAB and Google sessions to prevent indefinite replay. | Session expiry tests for both session types | **Fixed** |
| **SEC-06** | **P3** | Input Safety | Google Drive `file_id` path parameter not URL-encoded in upstream request | `f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"` interpolated raw `file_id`. | Safely URL-quote `file_id` with `urllib.parse.quote(str(file_id), safe="")`. | Unit test for file_id quoting | **Fixed** |
| **SEC-07** | **P4** | CORS / CSRF | Cross-Origin / Cross-Site Request analysis | Current cookie-based CSRF risk is mitigated by `SameSite=Lax`, exact credentialed CORS allowlisting, JSON-only mutation request bodies, and OAuth state verification. | Documented architecture; a separate CSRF token mechanism is not currently required for the existing API design. | CORS preflight test | **Mitigated by Design** |
| **SEC-08** | **P4** | Secret Hygiene | Tracked-file credential scan | Explicit scan over current git-tracked files for key/credential patterns. Excluded `.git`, `node_modules`, `dist`, `backend/.venv`. (Note: git history was not scanned). | Zero production secrets found. Only mock keys and `.env.example` placeholders exist. | Regex pattern scan on `git ls-files` | **Verified Safe** |
| **SEC-09** | **P2** | API Contract Regression | Google backup endpoints rejected valid schema-v1 payloads with 422 | Strict Pydantic `BackupData` validation used `ConfigDict(extra="forbid")` but omitted `displayTimeZone` and `achievementProgress`, rejecting valid frontend backup uploads (`POST /api/google/backups/manual`, `PUT /api/google/backups/auto`). Discovered via manual browser testing. | Explicitly represent `displayTimeZone: Optional[str] = "auto"` and `achievementProgress: Optional[dict] = Field(default_factory=dict)` in `BackupData` while keeping `extra="forbid"`. | Regression tests 16â€“20 in `test_security.py` covering manual POST, auto PUT, field preservation, and unknown field rejection | **Fixed / Verified** |

---

## 6. Detailed Architectural Analysis

### 6.1 Session Cookie Architecture
- **Cookie Names**: `tt_hoyolab_session`, `tt_google_session`, `tt_google_oauth_state`
- **Security Flags**:
  - `HttpOnly`: `True` on all session and state cookies (inaccessible to JavaScript).
  - `Secure`: `True` in production (`ENVIRONMENT=production`), `False` during local development over HTTP.
  - `SameSite`: `"lax"` (prevents cross-site credential leakage during subresource requests).
  - `Path`: `"/"`
  - `Max-Age`: `30 days` (2,592,000 seconds) for sessions; `10 minutes` (600 seconds) for OAuth state.
- **Server-Side Fernet TTL**:
  - Both `tt_hoyolab_session` and `tt_google_session` enforce `ttl=SESSION_COOKIE_MAX_AGE` (30 days) on server-side decryption.
  - Active Google sessions refresh access tokens and re-encrypt the cookie every ~1 hour, keeping active sessions fresh.
  - Inactive or stolen sessions older than 30 days fail decryption with `InvalidToken`, return 401, and purge the client cookie.
- **Payload Minimization**:
  - HoYoLAB cookie payload contains only `{"version": 1, "ltuid": "...", "ltoken": "..."}` (~90 bytes raw JSON).
  - Serialized Fernet ciphertext is ~180-220 bytes, well below the 4096-byte browser limit.
  - Zero game data, profile data, or upstream responses are stored in cookies.

### 6.2 Outbound Redirect Behavior
The application involves three distinct redirect contexts:
1. **Google OAuth Browser Redirect (`/api/google/auth/start`)**:
   - The browser receives a 307 redirect to `https://accounts.google.com/o/oauth2/v2/auth`.
   - A cryptographically random 32-byte state token is set in an HttpOnly cookie and validated upon callback using timing-safe `secrets.compare_digest`.
2. **Server-Side HTTPX Client Redirects (`google_api.py`)**:
   - In `httpx.AsyncClient()`, `follow_redirects` defaults to `False`. Outbound calls to Google OAuth and Drive endpoints do not automatically follow 3xx redirects. Unexpected redirects return raw 3xx status codes rather than blindly forwarding credentials to new destinations.
3. **Upstream HoYoLAB Client Redirects (`genshin` / `aiohttp`)**:
   - Inside `genshin.Client`, `aiohttp.ClientSession` has `allow_redirects=True` by default up to `max_redirects=10`.
   - However, all requests target hardcoded miHoYo API paths (e.g. `routes.GENSHIN_RECORD_URL`), and the client strictly validates `response.content_type == "application/json"`. Non-JSON responses (such as captive portal HTML or external redirect landing pages) immediately raise `GenshinException` and are safely handled.
*(Note: OAuth state validation verifies browser callback provenance, whereas outbound HTTP client redirect behaviors are governed independently by HTTPX and aiohttp client configurations.)*

### 6.3 CORS & CSRF Defense
1. **CORS Policy**:
   - `allow_credentials=True` is strictly paired with explicit, non-wildcard origins in `FRONTEND_ORIGINS`.
   - Origins must specify `http` or `https`, valid hostname and port, no userinfo, and no path/query/fragment.
   - Wildcards (`*`) are explicitly rejected on startup.
2. **CSRF Mitigation**:
   - Current cookie-based CSRF risk is mitigated by `SameSite=Lax`, exact credentialed CORS allowlisting, JSON-only mutation request bodies, and OAuth state verification.
   - All state-changing endpoints (`POST`, `PUT`, `DELETE`) require `Content-Type: application/json` and parse strict Pydantic models. Standard HTML forms cannot send JSON payloads without triggering a CORS preflight (`OPTIONS`) request, which is rejected by `CORSMiddleware` for untrusted origins.
   - A separate CSRF token mechanism is not currently required for the existing API design.

### 6.4 Rate Limiting & Abuse Resistance
- **Application Level**:
  - No distributed/global application-level rate limiter was added in this phase.
  - Invalid requests fail early via Pydantic model validation (<1ms rejection before upstream calls).
  - Upstream calls are protected with bounded timeouts (15.0s connect/read limits).
  - Upstream `429 Too Many Requests` responses from HoYoLAB and Google are caught and propagated cleanly as HTTP 429.
- **Architecture & Residual Consideration**:
  - Because the application is designed to deploy on serverless or multi-instance platforms (e.g. Vercel / containers), naive process-local in-memory rate limiters would be incomplete and provide false security guarantees.
  - Platform/edge-level rate limiting (e.g. via reverse proxy, WAF, or Vercel firewall rules) remains a residual production deployment consideration.

### 6.5 Request Size & Body Validation
- **Explicit Application Bounds**:
  - HoYoLAB credential strings are capped: `ltuid` ($\le 128$ chars), `ltoken` ($\le 512$ chars).
  - UID fields are constrained to Genshin 9-10 digit integer ranges (`ge=100000000, le=9999999999`).
  - Structured request models (`AuthPayload`, `NotesPayload`, `AchievementPayload`, `CalculatorSyncPayload`, `BackupEnvelope`) enforce `extra="forbid"` to reject unknown payloads.
- **Backup Payloads**:
  - Google Drive backup request bodies (`BackupEnvelope`) validate JSON schema and field types, but do not enforce an explicit application-level byte limit.
  - Platform/deployment limits (such as Vercel's 4.5MB serverless request body ceiling) govern maximum payload size at the infrastructure boundary.

### 6.6 Frontend API Compatibility & Dependencies
1. **Frontend API Compatibility**:
   - Initial Phase 6 hardening introduced a contract regression where `BackupData` did not represent all valid frontend schema-v1 backup fields (`displayTimeZone`, `achievementProgress`), causing 422 Unprocessable Content during manual browser testing of manual backups and post-restore auto backups.
   - With `BackupData` corrected to explicitly represent all canonical schema-v1 fields, existing frontend success-path request/response shapes remain compatible.
   - Invalid-input and failure-path semantics were intentionally hardened, including 422 validation and 504 timeout responses.
2. **Backend Dependencies**:
   - Backend dependencies in `requirements.txt` are exactly pinned.
   - No external vulnerability-database scan was performed as part of this phase.

### 6.7 Secret Fail-Safe & Deployment
- `HOYOLAB_SESSION_KEY` is required on startup; missing or malformed Fernet keys immediately halt the server with `ValueError`.
- An explicit pattern scan across current git-tracked files found zero committed production credentials. (Note: Git commit history was not scanned).
- In production on Vercel (`vercel.json`), the frontend and backend are unified under the same origin via `/api/(.*)` rewrites.
