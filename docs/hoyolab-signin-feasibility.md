# HoYoLAB Sign-In Feasibility & Protocol Research Spike (Stage A)

**Document Status:** Complete
**Date:** 2026-10-13
**Target Repository:** Traveler's Toolkit (`C:\Users\Cryptic\Documents\GitHub\travelers-toolkit`)
**Baseline Commit:** `3b1e75f` (branch `main`)
**Feasibility Verdict:** **E. NOT CURRENTLY RECOMMENDED**

---

## 1. Executive Summary & Feasibility Verdict

The objective of Stage A was to investigate replacing or augmenting the manual cookie entry UX (`ltuid_v2`, `ltoken_v2`) with a seamless QR code authentication flow ("Sign in with HoYoLAB") for international/overseas users, similar to implementations observed in companion bots such as Hoyo Buddy, without collecting user passwords.

### Primary Findings
1. **Installed Library (`genshin==1.7.29`):**
   Does **NOT** support overseas QR login. The installed `genshin.py` library's QR login functions (`_create_qrcode`, `_check_qrcode`, and `login_with_qrcode`) are decorated with `@base.region_specific(types.Region.CHINESE)`. Calling `client.login_with_qrcode()` on a client configured with `Region.OVERSEAS` unconditionally raises a runtime exception:
   ```text
   RuntimeError: The method can only be used with client region set to cn
   ```
2. **Current Upstream `genshin.py` (`1.7.31` / `master`):**
   Does **NOT** support overseas QR login. An inspection of upstream releases (`v1.7.30`, `v1.7.31`) and the master branch confirms that QR code endpoints and methods remain hardcoded to Miyoushe (`passport-api.miyoushe.com`) and restricted to `Region.CHINESE`.
3. **Hoyo Buddy Source Inspection:**
   Inspection of `seriaati/hoyo-buddy` (`hoyo_buddy/api/routers/login.py`) reveals that Hoyo Buddy's QR code login is **strictly for Miyoushe (Chinese accounts)**:
   ```python
   # hoyo_buddy/api/routers/login.py
   client = ProxyGenshinClient(region=genshin.Region.CHINESE)
   result = await client._create_qrcode()
   ```
   For international HoYoLAB users (`Platform.HOYOLAB`), Hoyo Buddy **does not support QR code login**. It only provides email/password login (with complex Geetest v3/v4 solvers and email 2FA verification) or manual DevTools cookie entry.
4. **Overseas Passport & Network Probing:**
   No supported overseas HoYoLAB web QR endpoint was identified during this research; investigated candidate endpoints did not provide a usable flow. While game client QR login exists (`hk4e-sdk-os.hoyoverse.com/.../combo/panda/qrcode/fetch`), it only yields a `Game Token` for the game client executable, which cannot access HoYoLAB Battle Chronicle or Calculator records on global accounts.
5. **Third-Party Library Landscape:**
   No maintained third-party Python library providing a proven overseas HoYoLAB QR flow was identified during this research.
6. **Official Third-Party API:**
   **No official third-party OAuth/OIDC flow was identified.** HoYoverse does not offer a public developer portal or OAuth 2.0 authorization server for independent applications.

### Feasibility Decision
**E. NOT CURRENTLY RECOMMENDED.**
Attempting to implement an overseas QR login flow at this time would require reverse-engineering private mobile SDK protocols that do not yield Battle Chronicle web cookies, or collecting raw user email/passwords with Geetest captcha and 2FA handling (which is strictly rejected for V1). The existing manual cookie entry mechanism remains the only reliable, secure, and privacy-preserving method for international accounts.

---

## 2. Existing Traveler's Toolkit Auth Architecture

Traveler's Toolkit uses a stateless, serverless-ready architecture for HoYoLAB authentication, implemented in `backend/main.py` and `backend/config.py`.

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”      POST /api/hoyolab/session       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Frontend       â”‚ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€> â”‚ Backend               â”‚
â”‚ (SettingsModal)â”‚  { ltuid, ltoken, uid? }             â”‚ (backend/main.py)     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                                    â”‚ 1. sanitize_credential_token
                                                                    â”‚ 2. client = genshin.Client(...)
                                                                    â”‚ 3. client.get_genshin_notes(...)
                                                                    â–¼
                                                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                                        â”‚ HoYoLAB Upstream API  â”‚
                                                        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                                    â”‚ Real Authenticated Response
                                                                    â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  Set-Cookie: tt_hoyolab_session=...  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Frontend       â”‚ <â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ â”‚ Backend               â”‚
â”‚ (HttpOnly)     â”‚  Encrypted Fernet Token              â”‚ (HOYOLAB_FERNET)      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Current Backend Flow
1. **Endpoint:** `POST /api/hoyolab/session`
   - Accepts payload: `ltuid` (string, 1-128 chars), `ltoken` (string, 1-512 chars), `uid` (optional int). Extra fields are forbidden (`extra="forbid"`).
   - Sanitizes inputs via `sanitize_credential_token()`, handling whitespace, quotes, semicolons, and `key=value` pasting artifacts.
2. **Upstream Validation:**
   - Constructs `genshin.Client({"ltuid_v2": ltuid, "ltoken_v2": ltoken}, game=genshin.Game.GENSHIN)`.
   - Executes a live request: `await client.get_genshin_notes(uid)`.
   - If invalid, handles `genshin.errors.InvalidCookies` and returns HTTP 401 without persisting anything.
3. **Session Encryption & Cookie:**
   - On success, serializes the minimal session:
     ```json
     {
       "version": 1,
       "ltuid": "...",
       "ltoken": "..."
     }
     ```
   - Encrypts via Fernet (`HOYOLAB_FERNET` loaded from environment).
   - Issues `Set-Cookie` with:
     - Name: `tt_hoyolab_session`
     - `HttpOnly`: `True`
     - `SameSite`: `"lax"`
     - `Path`: `"/"`
     - `Secure`: `True` in production, `False` in development
     - `Max-Age`: 30 days (`2,592,000` seconds)
4. **Downstream Callers:**
   - Downstream endpoints call `_get_hoyolab_client(request)`:
     - Decrypts `tt_hoyolab_session` with `HOYOLAB_FERNET.decrypt(..., ttl=SESSION_COOKIE_MAX_AGE)`.
     - Reconstructs `genshin.Client({"ltuid_v2": ltuid, "ltoken_v2": ltoken}, game=genshin.Game.GENSHIN)`.
   - Callers include:
     - `POST /api/notes`: Real-time resin and realm currency recovery.
     - `POST /api/hoyolab/achievements`: Battle Chronicle achievement category summary.
     - `POST /api/hoyolab/character-sync-preview`: Character inventory, weapon ascensions, and talent levels.
5. **Disconnect Path:**
   - `DELETE /api/hoyolab/session`: Calls `response.delete_cookie(key="tt_hoyolab_session", **get_cookie_delete_options())`.

---

## 3. Installed `genshin.py` Version Audit

- **Specification in `backend/requirements.txt`:** `genshin==1.7.29`
- **Installed Package in Virtualenv:** `genshin 1.7.29` (verified via `pip show genshin`)
- **Package Location:** `backend\.venv\Lib\site-packages\genshin`
- **Source Repository:** `https://github.com/seriaati/genshin.py`

---

## 4. Installed `genshin.py` Login Capabilities

Detailed source inspection of `backend/.venv/Lib/site-packages/genshin/client/components/auth/`:

| Method / Symbol | Class / Module | Region | Endpoint Called | Output / Returns | Visibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `login_with_qrcode()` | `AuthClient` (`client.py:292`) | `Region.CHINESE` | Calls `_create_qrcode` & `_check_qrcode` | `QRLoginResult` (cookies) | Public |
| `_create_qrcode()` | `AppAuthClient` (`app.py:233`) | Undecorated (Calls CN URL) | `https://passport-api.miyoushe.com/account/ma-cn-passport/web/createQRLogin` | `QRCodeCreationResult(ticket, url)` | Private |
| `_check_qrcode(ticket)` | `AppAuthClient` (`app.py:249`) | Undecorated (Calls CN URL) | `https://passport-api.miyoushe.com/account/ma-cn-passport/web/queryQRLoginStatus` | `(QRCodeStatus, SimpleCookie)` | Private |
| `QRCodeStatus` | `genshin.models.auth.qrcode` | Any | N/A | Enum: `CREATED`, `SCANNED`, `CONFIRMED` | Model |
| `QRLoginResult` | `genshin.models.auth.cookie` | Any | N/A | `cookie_token_v2`, `account_mid_v2`, `account_id_v2`, `ltoken_v2`, `ltmid_v2`, `ltuid_v2` | Model |
| `os_login_with_password()` | `AuthClient` (`client.py:81`) | `Region.OVERSEAS` | `https://sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword` | `WebLoginResult` | Public |
| `login_with_app_password()`| `AuthClient` (`client.py:192`) | `Region.OVERSEAS` | `https://sg-public-api.hoyoverse.com/account/ma-passport/api/appLoginByPassword` | `AppLoginResult` | Public |
| `_shield_login()` | `GameAuthClient` (`game.py`) | Game / Both | `https://hk4e-sdk-os.hoyoverse.com/hk4e_global/mdk/shield/api/login` | Game ticket | Private |

### Code Evidence for Region Incompatibility
In `genshin/client/components/auth/client.py`, lines 291-293:
```python
@base.region_specific(types.Region.CHINESE)
async def login_with_qrcode(self) -> QRLoginResult:
    """Login with QR code, only available for Miyoushe users."""
```
Calling this method on an overseas client produces:
```python
>>> client = genshin.Client(region=genshin.Region.OVERSEAS)
>>> await client.login_with_qrcode()
RuntimeError: The method can only be used with client region set to cn
```

---

## 5. Region-Specific Question â€” Critical

> **Question:** Does `genshin.py 1.7.29` support a QR login flow for `Region.OVERSEAS` / HoYoLAB that produces valid HoYoLAB cookies?

### **Answer: NO**

#### Code Evidence:
1. `login_with_qrcode` is strictly guarded by `@base.region_specific(types.Region.CHINESE)`.
2. The internal routes in `genshin/client/routes.py` (lines 282-283) are instantiated as static `Route` objects targeting mainland China domains, rather than `InternationalRoute`:
   ```python
   CREATE_QRCODE_URL = Route("https://passport-api.miyoushe.com/account/ma-cn-passport/web/createQRLogin")
   CHECK_QRCODE_URL = Route("https://passport-api.miyoushe.com/account/ma-cn-passport/web/queryQRLoginStatus")
   ```
3. The request headers in `genshin/utility/auth.py` (lines 79-85) are configured with Chinese Miyoushe parameters:
   ```python
   QRCODE_HEADERS = {
       "x-rpc-app_id": "bll8iq97cem8",
       "x-rpc-client_type": "4",
       "x-rpc-game_biz": "bbs_cn",
       "x-rpc-device_fp": "38d7fa104e5d7",
       "x-rpc-device_id": "586f1440-856a-4243-8076-2b0a12314197",
   }
   ```
4. Calling `client.login_with_qrcode()` with `Region.OVERSEAS` fails synchronously at the decorator level with `RuntimeError: The method can only be used with client region set to cn`.

---

## 6. Upstream `genshin.py` Capabilities

An audit of the upstream repository (`seriaati/genshin.py`) was performed covering commits and releases from `1.7.29` through `1.7.31` (latest stable as of October 2026):
- **1.7.30 (2026-09-01):** Bug fixes for chronicle account timezone handling, Mimo point history, and Zenless Zone Zero Deadly Assault mode. No auth or QR changes.
- **1.7.31 (2026-10-01):** Added `on_cookie_update` client hook, wish authkey generation from cookie token, and ZZZ character properties. No QR changes.
- **Master Branch Inspection:** `login_with_qrcode` remains tagged with `@base.region_specific(types.Region.CHINESE)` and routes to `passport-api.miyoushe.com`.

**Conclusion:** Upgrading `genshin.py` to `1.7.31` or building from `master` does **not** provide overseas QR login support.

---

## 7. Hoyo Buddy Implementation Analysis

Source inspection of `hoyo-buddy` (`seriaati/hoyo-buddy`, file `hoyo_buddy/api/routers/login.py`):

1. **QR Code Router (`/qrcode/create` and `/qrcode/check`):**
   ```python
   @router.post("/qrcode/create", response_model=QRCodeResponse)
   async def create_qrcode(...):
       """Generate a QR code for Miyoushe login."""
       client = ProxyGenshinClient(region=genshin.Region.CHINESE)
       result = await client._create_qrcode()
       ...

   @router.post("/qrcode/check", response_model=QRCodeStatusResponse)
   async def check_qrcode(...):
       client = ProxyGenshinClient(region=genshin.Region.CHINESE)
       status, cookies = await client._check_qrcode(ticket)
       ...
   ```
   **Hoyo Buddy explicitly restricts QR code authentication to Miyoushe (`genshin.Region.CHINESE`).**
2. **Overseas HoYoLAB Handling in Hoyo Buddy:**
   - Hoyo Buddy supports HoYoLAB overseas accounts via `/email-password`:
     - Calls `client._app_login(email, password, device_id=...)`.
     - Integrates interactive Geetest v3/v4 solvers (`SessionMMT` / `SessionMMTv4`).
     - Implements email verification code handling (`_send_verification_email`, `_verify_email`, `ActionTicket`).
   - Hoyo Buddy also provides manual entry fallbacks:
     - `/dev-tools`: accepts individual cookies (`ltuid_v2`, `account_id_v2`, `ltoken_v2`, `ltmid_v2`, `account_mid_v2`).
     - `/raw-cookies`: accepts a raw cookie string pasted from devtools.

**Conclusion:** Hoyo Buddy's QR login does not work for overseas HoYoLAB users; the common assumption that Hoyo Buddy offers overseas QR login is mistaken.

---

## 8. Protocol Reference & Community Ecosystem

Analysis of community reverse-engineering resources (e.g. `UIGF-org/mihoyo-api-collect`):

| Classification | Protocol / Flow | Target Endpoint | Resulting Credentials | Compatibility with Battle Chronicle |
| :--- | :--- | :--- | :--- | :--- |
| **UNDOCUMENTED / PRIVATE** | Web Passport QR (CN) | `passport-api.miyoushe.com/.../createQRLogin` | `ltoken_v2`, `ltuid_v2`, `cookie_token_v2` | Chinese Miyoushe only; rejected by overseas API |
| **UNSUPPORTED** | Web Passport QR (OS) | `sg-public-api.hoyolab.com/...` | None | No supported overseas HoYoLAB web QR endpoint was identified during this research; investigated candidate endpoints did not provide a usable flow |
| **REVERSE-ENGINEERED** | Game Client QR (OS) | `hk4e-sdk-os.hoyoverse.com/.../combo/panda/qrcode/fetch` | `game_token`, `combo_token`, `uid` | **No.** Game tokens cannot query Battle Chronicle or Calculator records on global servers |
| **REVERSE-ENGINEERED** | App Password Login (OS) | `sg-public-api.hoyoverse.com/.../appLoginByPassword` | `stoken`, `ltuid_v2`, `account_id_v2` | Requires password, Geetest solving, and device simulation |

---

## 9. Official Support & Policy Question

**"No official third-party OAuth/OIDC flow was identified."**

HoYoverse does not publish a public OAuth 2.0 or OpenID Connect specification for third-party web developers. Private and undocumented endpoints must never be referred to as "OAuth".

---

## 10. Rejection of Email/Password Collection for V1

Collecting email and password in Traveler's Toolkit is strictly rejected for the following reasons:
1. **User Trust & Liability:** Handling user passwords carries severe security and reputational risk for an independent fan application.
2. **Captcha Obstacles:** Upstream triggers Geetest v3/v4 challenges (`SessionMMT`) on almost all unverified IP addresses, necessitating complex frontend captcha solver widgets.
3. **Two-Factor Authentication:** HoYoverse triggers mandatory email verification codes (`ActionTicket`) for unrecognized devices.
4. **Device Fingerprinting:** Requires generating and spoofing device fingerprints (`x-rpc-device_fp`, `device_id`), which frequently break and risk account action.

---

## 11. Cookie Output Audit & Existing Session Compatibility

If a candidate authentication flow produces cookies, the credentials map as follows:

| Cookie Key | Current Toolkit Session | Downstream Sync Requirement | Status |
| :--- | :--- | :--- | :--- |
| `ltuid_v2` | Required (`ltuid`) | Required by `notes`, `achievements`, `sync-preview` | **REQUIRED** |
| `ltoken_v2` | Required (`ltoken`) | Required by `notes`, `achievements`, `sync-preview` | **REQUIRED** |
| `account_id_v2` | Not Stored | Redundant with `ltuid_v2` | **UNNECESSARY** |
| `account_mid_v2` | Not Stored | Optional for read-only sync | **OPTIONAL** |
| `ltmid_v2` | Not Stored | Optional for read-only sync | **OPTIONAL** |
| `cookie_token_v2`| Not Stored | Only required for mutating operations (e.g. daily check-in) | **OPTIONAL** |
| `stoken` | Not Stored | Mobile app token, not required for web chronicle | **UNNECESSARY** |
| `game_token` | Not Stored | Game client executable only | **INCOMPATIBLE** |

### Existing Session Compatibility
Current Traveler's Toolkit session schema:
```json
{
  "version": 1,
  "ltuid": "100200300",
  "ltoken": "v2_CAIS..."
}
```
**Compatibility Verdict:** **YES**. If an authentication flow returns `ltuid_v2` and `ltoken_v2`, normalizing the result into the existing session schema preserves 100% compatibility with all current backend sync functions without requiring schema migration.

---

## 12. Serverless State Storage Architecture & QR Expiry Lifetime

Because Traveler's Toolkit runs in a serverless environment (e.g. Vercel), in-memory global dictionaries (`qr_sessions = {}`) cannot be used, as polling requests may hit different worker instances.

### QR Ticket Lifetime Assessment
Community evidence for other HoYoverse QR flows indicates a short-lived ticket of roughly a few minutes. Since overseas QR is not supported or being implemented in this spike, exact expiry cannot be definitively fixed; if revisited in the future, the exact ticket expiry must be derived from the active upstream protocol. Any future client-side timeout or serverless state TTL (such as the 120-second window evaluated during mock PoC testing) must align with that live protocol lifetime.

### Proposed Architecture: Encrypted HttpOnly State Cookie
- **Lifecycle:**
  1. `POST /api/hoyolab/login/qr` initiates the session and returns an encrypted state cookie (`tt_hoyolab_qr_state`).
  2. The state payload is encrypted using the existing `HOYOLAB_FERNET`:
     ```json
     {
       "ticket": "upstream_ticket_string",
       "exp": 1792000000,
       "created": 1791999880
     }
     ```
  3. Size: Serialized JSON is ~90 bytes; Fernet ciphertext is ~160 characters, comfortably below the 4,096-byte browser cookie limit.
  4. Polling endpoint reads `tt_hoyolab_qr_state`, decrypts the ticket, polls upstream, and deletes the cookie upon `confirmed` or `expired` status.
  5. **No database or Redis instance required.**

---

## 13. Security Threat Modeling

| Threat Vector | Risk Description | Proposed Mitigation |
| :--- | :--- | :--- |
| **Ticket Theft** | Eavesdropping on ticket correlation | Ticket kept exclusively in encrypted HttpOnly cookie; never exposed to frontend JavaScript |
| **Replay Attack** | Reusing a confirmed ticket | Upstream tickets are single-use; state cookie has strict TTL enforced by Fernet |
| **Session Fixation** | Attacker pre-creates state for victim | State cookie scoped to origin with `SameSite=Lax` and encrypted nonce |
| **Polling Abuse** | Frontend flood of upstream API | **Required future mitigation:** backend rate limiting / debounce per state ticket (note: this is a required future mitigation for a hypothetical QR implementation, not an existing app-level distributed limiter in the current codebase) |
| **Serverless Loss** | Request routed to different container | State is client-carried (encrypted HttpOnly cookie), eliminating server memory dependencies |
| **Credential Leakage**| Sensitive tokens logged | Logging sanitization ensures tickets and raw cookies are never included in log messages |

---

## 14. Stage B Architecture Plan (If Future Support Emerges)

If upstream `genshin.py` adds proven overseas QR support in a future release, Stage B should be implemented as follows:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        Backend                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  POST /api/hoyolab/login/qr                            â”‚
â”‚  - Creates QR session, sets short-lived state cookie   â”‚
â”‚  - Returns { status: "pending", qrData: "..." }        â”‚
â”‚                                                        â”‚
â”‚  GET /api/hoyolab/login/qr/status                      â”‚
â”‚  - Reads state cookie, polls upstream                  â”‚
â”‚  - On confirmed: normalizes cookies, sets session      â”‚
â”‚  - Returns { status: "pending|scanned|confirmed|..." } â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
                           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        Frontend                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Settings Modal UX:                                    â”‚
â”‚  - [ Sign in with HoYoLAB ] (Preferred)               â”‚
â”‚  - [ Enter cookies manually ] (Fallback/Advanced)      â”‚
â”‚  - Polling loop (derived from active protocol cadence) â”‚
â”‚  - Accessible QR display, countdown timer, error statesâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 15. Privacy Policy & Terms Impact

1. **Privacy Policy:**
   No immediate update is required for Stage A. If Stage B is eventually implemented, the Privacy page should be amended to state:
   *"Traveler's Toolkit can connect to HoYoLAB either through a sign-in flow or manual cookie entry. Authentication credentials returned by HoYoLAB are handled by the backend and stored in an encrypted HttpOnly session cookie."*
2. **Terms / Affiliation Language:**
   Future UI elements must avoid phrases implying official endorsement (e.g. "Official HoYoLAB Login"). Recommended label:
   *"Sign in with HoYoLAB â€” Community integration. Not affiliated with HoYoverse."*

---

## 16. Protocol Stability Classification

- **Current Overseas Web QR:** **UNSUPPORTED**
  No supported overseas HoYoLAB web QR endpoint was identified during this research; investigated candidate endpoints did not provide a usable flow.
- **Chinese Miyoushe QR:** **UNDOCUMENTED BUT LIBRARY-SUPPORTED** (`genshin.py`).
- **Game SDK QR:** **REVERSE-ENGINEERED PRIVATE API** (Produces `game_token`, incompatible with web Battle Chronicle).

---

## 17. Final Feasibility Decision & Recommendations

### **Decision: E. NOT CURRENTLY RECOMMENDED**

### **Justification:**
1. Installed `genshin.py 1.7.29` explicitly prohibits overseas QR login at the code level.
2. Upstream `genshin.py` (`1.7.31` / `master`) does not add overseas QR login.
3. Hoyo Buddy's QR login is strictly limited to Chinese Miyoushe accounts.
4. No supported overseas HoYoLAB web QR endpoint was identified during this research; investigated candidate endpoints did not provide a usable flow.
5. Game QR tokens cannot be exchanged for Battle Chronicle cookies on overseas accounts.
6. No maintained third-party Python library providing a proven overseas HoYoLAB QR flow was identified during this research.
7. Email/password collection is ruled out for V1 due to security, liability, and Geetest/2FA fragility.

### **Immediate Recommendation for Traveler's Toolkit:**
Retain guided manual `ltuid_v2` / `ltoken_v2` entry as the recommended V1 flow, supplemented by clearer instructions and visual help in the UI. Do not collect user passwords, and do not introduce browser credential-scraping helpers or bookmarklets. Monitor upstream `genshin.py` for any future overseas authentication developments.
