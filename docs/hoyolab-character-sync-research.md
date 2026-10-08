# HoYoLAB Character Sync Research

## 1. Battle Chronicle Basic Findings
The basic Battle Chronicle API (`/character/list`) provides character identity, element, level, constellation, friendship, and equipped weapon (including weapon level and refinement). However, it **does not** contain any information about character or weapon ascension phases.

## 2. Calculator Detail Findings
The Enhancement Progression Calculator (`/sync/avatar/detail`) provides a character's invested talent levels.
- **Hu Tao C3 Base-Talent Verification**: Our test on a C3 Hu Tao returned `normal = 10, skill = 10, burst = 10` via the calculator sync. This proves that the calculator API returns **base/invested talent levels**, completely ignoring constellation-inflated display values (+3 to skill/burst). This means no constellation subtraction logic is required.

## 3. Raw `promote_level` Discovery (Character Ascension)
The exact character ascension is **available explicitly** from HoYoLAB.
By calling the `sync/avatar/list` endpoint manually (or routing through the internal `_get_calculator_items` to preserve the raw JSON), the response includes a `promote_level` for every character on the account. This integer exactly maps to the character's ascension phase (0–6).
*Note: This field is silently dropped by Pydantic models in the `genshin.py` library (version 1.7.29), which is why we must intercept the raw transport data.*

## 4. Weapon `promote_level` Discovery (Weapon Ascension)
The Detailed Battle Chronicle API (`/character/detail`) returns an explicit `weapon.promote_level` field. This is the authoritative source for weapon ascension (0–6).

## 5. Traveler Behavior
The Traveler (id = 10000005) currently returns specific element talents (e.g., Cryo) based on their active resonance. The calculator detail successfully returns the Traveler's active element talents (e.g., `normal = 1, skill = 1, burst = 5`). For Phase A, the Traveler is returned as-is (unmapped). Mapping to "Traveler Cryo" or other variants is reserved for Phase B.

## 6. Why `max_level` is NOT Ascension
The `max_level` field (e.g., 90) indicates the character's current hard cap based on their ascension, but it does NOT uniquely identify the ascension at boundaries. For instance, an A5 character (Level 80) and an A6 character (Level 80) both return valid, but `max_level` alone is ambiguous without the explicit `promote_level`.

## 7. Why Inference Was Rejected
While it is possible to infer ascension for non-boundary levels, and disambiguate boundary levels using canonical talent caps (e.g., A5 cap = 8, A6 cap = 10), this approach is fundamentally fragile and unsafe:
- Characters with under-invested talents remain permanently ambiguous.
- It requires maintaining static databases of talent caps and levels.
- The discovery of the explicit `promote_level` field makes inference entirely obsolete.

## 8. Source Authority Table
When syncing a character, we merge data from three distinct HoYoLAB endpoints. The following table dictates the authoritative source for each field to prevent mixing conflicting values.

| Field | Authoritative Source | Notes |
| :--- | :--- | :--- |
| **Identity / Element** | Basic Battle Chronicle | Canonical ID and element. |
| **Level** | Basic Battle Chronicle | Most up-to-date combat level. |
| **Constellation / Friendship** | Basic Battle Chronicle | |
| **Equipped Weapon** | Basic Battle Chronicle | Provides Weapon ID, Level, Refinement. |
| **Weapon Ascension** | Detailed Battle Chronicle | Exact `weapon.promote_level` (0-6). |
| **Character Ascension** | Raw Calculator Sync | Exact `promote_level` (0-6). |
| **Talents** | Raw Calculator Sync | Base/invested levels (via `skill_list`). |

*Note: If two sources disagree on a shared field (e.g., Level), the Basic Battle Chronicle is treated as the primary source for basic stats. We report conflicts rather than guessing.*

## 9. Rate-Limit Strategy
**Request Strategy**:
- The basic BC and raw calculator sync can each be fetched in a single request for the entire roster.
- The Detailed Battle Chronicle accepts an array of `character_ids`. We batch the 99 characters into chunks of 20 to respect payload limits and avoid timeouts, requesting them sequentially.
- This keeps the total external requests per sync extremely low (~6-7 requests for a full 99-character roster).
- We do not run sync automatically on page load; it should be user-triggered.

## 10. Out of Scope
Artifacts and Combat Stats are explicitly out of scope and excluded from this pipeline to maintain strict privacy and data boundaries.
