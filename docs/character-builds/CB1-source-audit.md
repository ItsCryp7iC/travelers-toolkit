# CB1: Source Audit & Recommendation Contract

**Repository:** `travelers-toolkit`  
**Upstream Source:** `https://github.com/Genshin-Impact-Helper-Team/genshin-builds`  
**Milestone:** CB1 — Architecture Only  
**Audit Date:** November 14, 2026  
**Auditor:** Antigravity (DeepMind)  

---

## 1. Verified Source Revision & Provenance

The upstream repository was audited locally from a bounded shallow checkout (`--depth 1`) in a secure workspace sandbox.

### 1.1 Local Source Checkout & Verification Procedure

During the audit setup, a tool execution to shallow-clone the repository returned `fatal: destination path already exists and is not an empty directory` because an initial checkout of `https://github.com/Genshin-Impact-Helper-Team/genshin-builds` had already been prepared in the persistent scratch sandbox directory (`C:\Users\Cryptic\.gemini\antigravity\brain\83029ac3-ae6f-49dd-bc83-f3de1dee8eb1\scratch\genshin-builds`).

The working tree was verified directly using local Git commands:
1. `git log -1 --stat`: Confirmed commit SHA, commit date, author, and changed file paths.
2. `git status`: Confirmed a clean working tree on branch `main` with zero local modifications.
3. Local Node.js scripts executed inside the sandbox to inspect content files, schemas, and translations without issuing HTTP requests.

No automated mass-REST queries were executed against GitHub's API, and no upstream changes, issues, or pull requests were submitted.

| Attribute | Audited Source Ground Truth |
| :--- | :--- |
| **Upstream Repository** | `https://github.com/Genshin-Impact-Helper-Team/genshin-builds` |
| **Target Branch** | `main` |
| **Audited Commit SHA** | `be542cba19de28f31e4a352f8711ffaff9d2c838` |
| **Commit Date** | `Sat Nov 14 15:45:01 2026 +0100` |
| **Commit Author** | `Akhala <lolipoploplo@gmail.com>` |
| **Commit Subject** | `content/update-wip` |
| **Working Tree State** | Clean, verified locally |

---

## 2. Source Tree Structure & Content Organization

Upstream organizes editorial recommendations strictly on the filesystem under `src/content/`:

```text
src/content/<element>/<rarity>/<character>/
src/content/<element>/<rarity>/<character>/<role>/
```

### 2.1 File Contract Overview

Each character directory and role subdirectory contains standardized JSON recommendation files:

| File Name | Placement | Purpose | Schema Reference |
| :--- | :--- | :--- | :--- |
| `metadata.json` | Character root | Character weapon type, initial release version, and last updated version. | `schemas/metadata.schema.json` |
| `weapons.json` | Role folder *(or Character root fallback)* | Ranked weapon groups, equivalent alternatives, refinement requirements, conditional weapons, and section notes. | `schemas/weapons.schema.json` |
| `artifacts-sets.json` | Role folder *(or Character root fallback)* | Ranked artifact sets, 2-piece/4-piece combinations, `choose: true` sets, `choices` pools, conditional sets, and notes. | `schemas/artifacts-sets.schema.json` |
| `artifacts-mainstats.json` | Role folder *(or Character root fallback)* | Recommended main stats for Sands, Goblet, and Circlet slots, including alternative options and notes. | `schemas/artifacts-mainstats.schema.json` |
| `artifacts-substats.json` | Role folder *(or Character root fallback)* | Substat priority ordering, equivalent substat groups, and stat-specific notes. | `schemas/artifacts-substats.schema.json` |
| `talents.json` | Role folder *(or Character root fallback)* | Talent leveling priority, equality groupings, approximate priorities (`approx: true`), and notes. | `schemas/talents.schema.json` |
| `build-notes.json` | Role folder | Role display name, `best` flag, editorial Markdown notes, gameplay tips, and calculation credits. | `schemas/build-notes.schema.json` |

### 2.2 Shared Static Databases & Localization

In addition to character content folders, the upstream project maintains shared datasets and localization tables:

- `src/data/weapons/<weapon-type>.json`: Static catalog of weapons (`sword.json`, `claymore.json`, `polearm.json`, `bow.json`, `catalyst.json`), containing rarity, release version, base stats, substat keys, and passive descriptions.
- `src/data/artifacts/artifact_sets.json`: Static catalog of 63 artifact set definitions containing rarity, release version, set bonus descriptions (`2p`, `4p`), and semantic tags (e.g., `atk-set`, `er-set`, `em-set`). *Note: While upstream defines 63 artifact sets in this dataset, recommendations across the 184 builds reference a specific subset of 48 real artifact sets, alongside 10 generic stat pseudo-sets.*
- `src/data/translation-aliases.json`: Equivalence dictionary resolving colloquial community acronyms and shorthand (e.g., `pjws` → `primordial-jade-winged-spear`, `homa` → `staff-of-homa`, `vv` → `viridescent-venerer`, `noblesse` → `noblesse-oblige`, `MH` → `marechaussee-hunter`).
- `src/i18n/<lang>/*.json`: Localized strings for characters, weapons, artifact sets, stats, elements, abilities, and UI labels across 7 languages (`en`, `fr`, `de`, `es`, `it`, `ru`, `pt`). English (`en`) serves as canonical source and ground-truth fallback.
- `src/assets/character-assets/`: Raster portrait and splash art WebP files. *(These binary assets must be excluded from synchronization to prevent bandwidth waste, as Traveler's Toolkit already hosts its own character/weapon asset pipeline).*

---

## 3. Character and Role Verification Counts

An exhaustive programmatic traversal of the audited commit (`be542cba19de28f31e4a352f8711ffaff9d2c838`) verified the catalog metrics:

| Metric | Verified Count | Notes |
| :--- | :--- | :--- |
| **Total Character Entries** | **129** | Includes 122 standard characters + 7 distinct Traveler elemental alignments. |
| **Total Role Build Folders** | **184** | Across all 129 characters. |
| **Characters with 1 Role** | **83** | Dedicated single-role builds (e.g., Albedo, Wanderer, Chevreuse). |
| **Characters with 2 Roles** | **37** | Dual-role builds (e.g., Furina, Yelan, Clorinde, Kazuha). |
| **Characters with 3 Roles** | **9** | Multi-role builds: Amber, Bennett, Diona, Ganyu, Keqing, Raiden Shogun, Rosaria, Venti, Xiangling. |
| **Characters with >3 Roles** | **0** | Max role depth is 3. |
| **Characters with 0 Roles** | **0** | Every character has at least 1 defined build. |
| **Characters with ≥1 Active Build** | **129** | 100% of characters have at least one usable, active build. |
| **Characters with All Builds WIP** | **0** | No character is completely locked out by WIP status. |
| **Characters with Mixed Active & WIP Roles**| **0** | In audited commit, zero characters have a split active/WIP role status. |
| **Individually Active Role Builds** | **184** | 100% of the 184 individual role builds are active and available. |
| **Individually WIP Role Builds** | **0** | Zero role builds have `last_updated: "WIP"` in this audited revision. |

### 3.1 WIP & Version Review Distribution

While the audited revision contains zero active `WIP` tags in `last_updated`, the upstream FAQ and commit history document that newly introduced characters or overhauled builds are flagged as `"WIP"` during live testing. 

The normalizer must not assume that "zero entirely WIP characters" guarantees "zero WIP role builds." It must evaluate `last_updated` at the build level first (overriding character metadata) to distinguish:
1. **Active Current Build:** Valid recommendations reviewed for current game versions.
2. **Individually WIP Build:** Roles marked with `last_updated: "WIP"`, retained in catalog but flagged with `isWip: true`.
3. **Active Legacy / Outdated Build:** Roles that remain active but were reviewed for an earlier version.
4. **Invalid Build:** Corrupted data failing validation.

#### Version Review Distribution Across All 184 Roles in Audited Commit:
| Game Version in `last_updated` | Number of Roles | Classification |
| :--- | :---: | :--- |
| **7.2** | 51 | Current Version |
| **6.7 / Luna VIII** | 43 | Recent Version |
| **5.8** | 17 | Recent Version |
| **7.0** | 13 | Recent Version |
| **6.1 / Luna II** | 8 | Recent Version |
| **6.2 / Luna III** | 7 | Recent Version |
| **4.8, 5.4, 5.6** | 5 each (15 total) | Stable / Prior Cycle |
| **6.5 / Luna VI** | 4 | Stable / Prior Cycle |
| **5.0, 5.5, 5.7** | 3 each (9 total) | Stable / Prior Cycle |
| **4.1, 4.2, 4.3, 6.0 / Luna I, 6.4 / Luna V, 7.1** | 2 each (12 total) | Stable / Prior Cycle |
| **3.8, 4.0, 4.4, 5.1, 6.6 / Luna VII** | 1 each (5 total) | Legacy Review (Active but older baseline) |
| **WIP** | **0** | None in audited revision |

### 3.2 Breakdown by Element and Rarity

| Element | 4-Star Characters | 5-Star Characters | Total Characters | Total Roles |
| :--- | :---: | :---: | :---: | :---: |
| **Anemo** | 7 | 9 *(incl. Anemo Traveler)* | 16 | 23 |
| **Cryo** | 9 | 11 *(incl. Cryo Traveler)* | 20 | 29 |
| **Dendro** | 4 | 8 *(incl. Dendro Traveler)* | 12 | 16 |
| **Electro** | 7 | 13 *(incl. Electro Traveler)* | 20 | 31 |
| **Geo** | 4 | 10 *(incl. Geo Traveler)* | 14 | 18 |
| **Hydro** | 5 | 13 *(incl. Hydro Traveler)* | 18 | 27 |
| **Pyro** | 11 | 18 *(incl. Pyro Traveler)* | 29 | 40 |
| **Total** | **47** | **82** | **129** | **184** |

### 3.3 Role Best-Build Distribution

Upstream flags recommended builds via `"best": true` in `build-notes.json`:

- **Characters with at least one `best: true` build:** 128 / 129 (99.2%). *(The single exception is a character whose builds are co-equal situational variants without a single dominant recommendation).*
- **Characters with multiple `best: true` builds:** **23** characters!
  - 1 character with 3 best builds: **Rosaria** (`reverse-melt-DPS`, `freeze-sub-DPS`, `physical-support`).
  - 22 characters with 2 best builds: **Venti**, **Xianyun**, **Freminet**, **Kaeya**, **Layla**, **Escoffier**, **Ganyu**, **Lauma**, **Beidou**, **Fischl**, **Lisa**, **Ororon**, **Sethos**, **Clorinde**, **Keqing**, **Xingqiu**, **Columbina**, **Furina**, **Yelan**, **Xiangling**, **Durin**, **Yoimiya**.

> [!IMPORTANT]
> **Architectural Takeaway:** `best` is not a mutually exclusive radio selection per character. A character can have multiple distinct builds marked as top-tier recommendations depending on team archetypes. The Toolkit schema must represent `isBest` as a property of each build rather than a single character-level scalar pointer.

---

## 4. Complex Source Edge Cases & Empirical Findings

### 4.1 Build Discovery & File Inheritance Fallback

Upstream loaders implement an explicit folder-inheritance rule:
```text
1. Check: src/content/<element>/<rarity>/<character>/<role>/<file>.json
2. Fallback: src/content/<element>/<rarity>/<character>/<file>.json
```
If a file is absent in the role directory, the character root file acts as the default for all roles of that character.

**Empirical Fallback Utilization in Audited Commit:**
- `weapons.json`: **2** characters (**Ororon**, **Sethos**), representing **4 role builds** that inherit weapons from character root.
- `artifacts-sets.json`: **10** characters (**Lan Yan**, **Xianyun**, **Escoffier**, **Lauma**, **Beidou**, **Ororon**, **Xingqiu**, **Furina**, **Yelan**, **Xiangling**), representing **19 role builds** that inherit artifact sets from character root.
- `artifacts-mainstats.json`: **9** characters (**Xianyun**, **Beidou**, **Sethos**, **Xingqiu**, **Columbina**, **Furina**, **Yelan**, **Xiangling**, **Durin**), representing **18 role builds** that inherit main stats from character root.
- `artifacts-substats.json`: **15** characters, representing **29 role builds** that inherit substat priorities from character root.
- `talents.json`: **19** characters, representing **37 role builds** that inherit talent priorities from character root.
- `build-notes.json`: **0** characters / **0 role builds** *(100% of the 184 role builds provide their own dedicated `build-notes.json`)*.

**Example: Xianyun (`src/content/anemo/5/xianyun/`)**
- Roles: `support/` and `dps/`.
- `dps/` overrides `weapons.json`, `talents.json`, and `artifacts-sets.json`.
- `support/` omits `artifacts-sets.json`, `artifacts-mainstats.json`, and `artifacts-substats.json`, inheriting them directly from the character root directory.

### 4.2 Weapon Recommendations

- **Total Weapon References:** 2,155 entries across all builds.
- **Max Rank Depth:** Up to 14 ranked positions in a single build.
- **Equivalence Groups:** Up to 10 equivalent weapons sharing a single numbered rank (rendered with `≈`).
  - Example: `items: ["aqua-simulacra", "the-first-great-magic", "polar-star", ...]` in Ganyu Melt DPS.
- **Refinement Syntax:**
  - Integer literal: `refinement: 5` (269 occurrences) or `refinement: 1`.
  - String range / minimum: `refinement: "3+"` (2 occurrences), `refinement: "4+"` (2 occurrences), `refinement: "3-5"` (2 occurrences).
- **Conditional Weapons:** 13 conditional weapon recommendations listed under `conditional: [...]` (e.g., `aquila-favonia` or `freedom-sworn` conditional on specific team compositions).
- **Notes on Weapons:** 717 item-specific notes (`items[].note`) and 33 section-level overview notes (`notes[]`).

### 4.3 Artifact Recommendations

- **Max Rank Depth:** Up to 9 ranked positions.
- **Rank Groups:** Up to 4 alternative set options per numbered rank (rendered with `≈`).
- **`choose: true` Semantic Groups (97 occurrences):**
  - Indicates that the player should select any **two** 2-piece bonuses from the provided set options.
  - Example (`src/content/hydro/5/furina/off-field-DPS/artifacts-sets.json`):
    ```json
    {
      "choose": true,
      "items": [
        { "name": "golden-troupe", "pieces": 2 },
        { "name": "hp-set", "pieces": 2 },
        { "name": "hydro-set", "pieces": 2 },
        { "name": "er-set", "pieces": 2 }
      ]
    }
    ```
- **`choices` Pools (9 occurrences):**
  - Used for 2p/2p configurations where the player chooses one set from Pool A and one set from Pool B.
  - Example: Choose one from `[Noblesse Oblige (2), Cryo DMG (2)]` **and** choose one from `[ATK +18% (2), EM +80 (2)]`.
- **Fixed Set + `choices` Pool:** A fixed 2-piece set combined with a choose-one pool for the remaining two slots.
- **Conditional Artifacts:** 66 conditional entries under `conditional: [...]` (e.g., Blizzard Strayer 4-pc conditional on maintainable Frozen auras).
- **Item & Section Notes:** 238 artifact item notes and 1 section-level note.

### 4.4 Stat Pseudo-Sets and Tag Taxonomy

Upstream recommendations frequently specify generic stat sets rather than specific named artifact sets. Programmatic analysis revealed **10 distinct pseudo-sets** across 323 recommendations:

| Pseudo-Set ID | English Localized Display Label | Corresponding Set Tag | Matching Upstream 5★/4★ Artifact Sets Count | Example Sets Providing Bonus |
| :--- | :--- | :--- | :---: | :--- |
| `atk-set` | `+18% ATK set` | `atk-set` | 13 | Gladiator's Finale, Shimenawa's Reminiscence, Vermillion Hereafter |
| `em-set` | `+80 EM set` | `em-set` | 6 | Wanderer's Troupe, Gilded Dreams, Flower of Paradise Lost |
| `er-set` | `+20% ER set` | `er-set` | 5 | Emblem of Severed Fate, The Exile, Scholar |
| `healing-set` | `+15% Healing Bonus set` | `healing-set` | 3 | Maiden Beloved, Ocean-Hued Clam, Song of Days Past |
| `hp-set` | `+20% HP set` | `hp-set` | 2 | Tenacity of the Millelith, Vourukasha's Glow |
| `def-set` | `+30% DEF set` | `def-set` | 2 | Husk of Opulent Dreams, Defender's Will |
| `physical-set` | `+25% Physical DMG set` | `physical-set` | 2 | Bloodstained Chivalry, Pale Flame |
| `anemo-set` | `+15% Anemo DMG Bonus set` | `anemo-set` | 2 | Viridescent Venerer, Desert Pavilion Chronicle |
| `cryo-set` | `+15% Cryo DMG Bonus set` | `cryo-set` | 2 | Blizzard Strayer, Finale of the Deep Galleries |
| `hydro-set` | `+15% Hydro DMG Bonus set` | `hydro-set` | 2 | Heart of Depth, Nymph's Dream |

### 4.5 Stats and Talents Details

- **Main Stats:**
  - Sands options: `er`, `atk%`, `em`, `hp%`, `def%`.
  - Goblet options: Elemental DMG (`anemo-dmg`, `cryo-dmg`, `dendro-dmg`, `electro-dmg`, `geo-dmg`, `hydro-dmg`, `pyro-dmg`), `physical-dmg`, `atk%`, `def%`, `hp%`, `em`.
  - Circlet options: `cr`, `cd`, `cr/cd`, `em`, `healing-bonus`, `atk%`, `hp%`, `def%`.
  - Main-stat notes: 63 notes attached to slot recommendations.
- **Substats Priorities:**
  - Single stats vs alternative pools: 26 substat priority tiers contain alternative pools (`items: [...]`).
  - Inline Stat Slashes: Upstream occasionally uses inline stat-slash strings such as `"[[stat:cr/cd]] / [[stat:hp%]]"` or `"[[stat:atk%]] / [[stat:def%]]"`.
  - Substat notes: 148 notes explaining Energy Recharge thresholds and stat soft-caps.
- **Talents Priorities:**
  - Canonical talent IDs: `burst`, `skill`, `na`.
  - Equality groupings (`=`): 21 occurrences where multiple talents share the same priority tier.
  - Approximate priority (`approx: true` → `≈`): 13 occurrences (e.g., `Burst > Skill ≈ Normal Attack`).
  - Talent notes: 26 item-level notes and 19 section-level notes.

### 4.6 Text Formatting, Inline Reference Tokens, & Attribution

- **Inline Tokens (4,800+ total tokens):**
  - Syntaxes: `[[category:id]]`, `[[category:id|Custom Label]]`, and untagged `[[id]]`.
  - Primary categories: `ability` (2,274), `element` (2,051), `character` (1,991), `stat` (484), `weapon` (451), `set` (218), `note` (212).
  - Upstream anomalies: Minor typos exist in upstream text (e.g., `[[abillity:...]]`, `[[elemento:...]]`, and untagged `[[furina]]`). The Toolkit token parser must resolve these gracefully.
- **Rotation Notation Markers (418 occurrences):**
  - Syntax: `{rot:<sequence>}` (e.g., `{rot:E > Q}`, `{rot:4[CA6]}`, `{rot:N2C}`).
  - Used in gameplay notes and tips to express attack rotation sequences.
- **Gameplay Tips (`tips[]`):** 29 dedicated gameplay tips across builds, containing localized titles and Markdown explanations.
- **Calculation Credits:** 99 credits across `artifact` (7), `weapon` (59), and `global` (33), citing TC authors and external math sheets.

---

## 5. Entity Mapping & Coverage Analysis

### 5.1 Character Mapping

| Source Universe | Count | Toolkit Canonical ID Mapping Status | Mapped % |
| :--- | :---: | :--- | :---: |
| **All Upstream Characters** | **129** | **129 Mapped / 0 Missing** | **100.0%** |
| Traveler Elements | 7 | Deterministic mapping: `anemo-traveler` → `TravelerAnemo`, `geo-traveler` → `TravelerGeo`, `electro-traveler` → `TravelerElectro`, `dendro-traveler` → `TravelerDendro`, `hydro-traveler` → `TravelerHydro`, `pyro-traveler` → `TravelerPyro`, `cryo-traveler` → `TravelerCryo`. | 100.0% |
| Non-Traveler Characters | 122 | Slug-to-ID normalized match: 121 direct matches + 1 alias match (`shogun-raiden` → `RaidenShogun` via English i18n lookup). | 100.0% |

### 5.2 Weapon Mapping

| Source Universe | Count | Toolkit Canonical ID Mapping Status | Mapped % |
| :--- | :---: | :--- | :---: |
| **Weapons Referenced in Builds** | **216** | **215 Mapped / 1 Missing** | **99.54%** |
| **Total Weapons in Upstream Catalog** | **253** | **252 Mapped / 1 Missing** | **99.60%** |

#### Unmapped Weapon Anomaly: `exaiphanes-blade`
- **Upstream Details:** 5-star Sword, released in version `7.0`, source: `Exploration`. Exclusive passive tailored for the Traveler resonating with multiple elements.
- **Toolkit Reality:** Traveler's Toolkit's `src/data/weapons.json` is a curated canonical game dataset maintained manually by the project owner. It does not yet contain `Exaiphanes Blade`.
- **Source-Only Weapon Strategy:** 
  The importer preserves this recommendation **without adding synthetic or fictional entries to Toolkit's canonical `src/data/weapons.json`**.
  
  The schema establishes two distinct identity fields:
  - `sourceWeaponId`: Stable upstream identifier (`"exaiphanes-blade"`).
  - `toolkitWeaponId`: Canonical Toolkit ID (`null` when unmapped).
  
  For `exaiphanes-blade` and any future unmapped source weapons:
  1. Retain the exact original ranking position.
  2. Retain refinement requirements (e.g., `refinement: 5`) and item notes.
  3. Resolve a trustworthy display name using upstream English localization (`enWeapons["exaiphanes-blade"]` → `"Exaiphanes Blade"`).
  4. Flag the item explicitly as absent from Toolkit's catalog (`isToolkitItem: false`).
  5. Never hide the recommendation, replace it with an arbitrary substitute, or generate a fictional placeholder ID in the canonical game database.
  6. Never imply anything regarding whether the user owns or does not own the weapon.
  7. When Toolkit's canonical `weapons.json` is later manually updated, the mapper will resolve `toolkitWeaponId` naturally on the next synchronization.

### 5.3 Artifact Catalog Independence & Taxonomy

Upstream defines **63 total artifact sets** in its shared database (`src/data/artifacts/artifact_sets.json`). Editorial build recommendations across the 184 roles reference a subset of **48 distinct real artifact sets**, alongside **10 generic stat pseudo-sets**.

#### Three Distinct Artifact Concepts:
1. **Toolkit Canonical Artifact Catalog (`src/data/artifacts.json`):**
   Traveler's Toolkit maintains its own canonical game datasets manually. A future `src/data/artifacts.json` will serve as the Toolkit-owned catalog of playable artifact sets. It **must never be automatically overwritten, mutated, or expanded by upstream build synchronization**.
2. **Upstream Recommendation References (`sourceSetId`):**
   Build recommendation entries refer to sets by their upstream slugs (e.g., `"viridescent-venerer"`). When present in Toolkit's canonical catalog, they map to `toolkitSetId`. When not yet mapped, they retain `toolkitSetId: null`, `isToolkitItem: false`, their trustworthy localized name, required piece count (2 or 4), and notes.
3. **Generic Pseudo-Set Categories (`atk-set`, `em-set`, etc.):**
   Pseudo-sets represent abstract stat bonus categories (e.g., "+18% ATK set" or "+80 EM set") that can be satisfied by any artifact set providing that 2-piece effect. **Pseudo-sets must never be treated as equipable artifact sets or added to canonical game catalogs.** They are modeled with `isPseudoSet: true` and mapped to their corresponding stat tag (`atk-set`).

---

## 6. Audit Summary & Readiness Verdict

| Category | Finding | Status |
| :--- | :--- | :---: |
| **Source Integrity** | Clean checkout at commit `be542cba19de28f31e4a352f8711ffaff9d2c838` | PASS |
| **Role Verification** | Exactly 129 characters, 184 roles (83 single, 37 dual, 9 triple) | PASS |
| **Character Coverage** | 129 / 129 mapped to Toolkit character IDs | PASS |
| **Weapon Coverage** | 215 / 216 mapped (only 1 future/unreleased weapon unmapped) | PASS |
| **Structural Fidelity** | All edge cases (`choose: true`, `choices`, `approx`, `rot`) fully cataloged | PASS |
| **Architectural Readiness**| Sufficient ground truth established to define the normalized schema | **READY FOR CB2** |
