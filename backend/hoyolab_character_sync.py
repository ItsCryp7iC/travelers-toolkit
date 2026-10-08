import asyncio
import logging
from typing import Optional, Any
from pydantic import BaseModel, Field
import genshin

logger = logging.getLogger(__name__)

class CharacterTalents(BaseModel):
    normal: int
    skill: int
    burst: int

class SyncWeapon(BaseModel):
    id: int
    name: str
    level: int
    ascension: Optional[int]
    refinement: int

class SyncedCharacter(BaseModel):
    id: int
    name: str
    element: str
    level: int
    ascension: Optional[int]
    constellation: int
    friendship: int
    talents: Optional[CharacterTalents]
    weapon: Optional[SyncWeapon]

def normalize_ascension(promote_level: Any) -> Optional[int]:
    """
    Validates and normalizes exact promote_level to an integer 0..6.
    Missing or invalid values return None according to safe policy (never guess).
    """
    try:
        if promote_level is None:
            return None
        val = int(promote_level)
        if 0 <= val <= 6:
            return val
        return None
    except (ValueError, TypeError):
        return None

async def get_raw_calculator_characters(client: genshin.Client, uid: Optional[int] = None) -> list[dict]:
    """
    Fetches the raw calculator characters endpoint without passing through Pydantic
    models that drop the `promote_level` field.
    """
    raw_list = await client._get_calculator_items(
        slug="avatar",
        filters=dict(element_attr_ids=[], weapon_cat_ids=[]),
        is_all=True,  # Include traveler
        sync=True,
        uid=uid
    )
    return raw_list

async def get_batched_detailed_characters(client: genshin.Client, uid: Optional[int], character_ids: list[int], chunk_size: int = 20) -> list[genshin.models.genshin.chronicle.characters.GenshinDetailCharacter]:
    """
    Fetches detailed characters in safe batches to avoid request timeout or payload limits.
    """
    results = []
    for i in range(0, len(character_ids), chunk_size):
        chunk = character_ids[i:i+chunk_size]
        try:
            details_wrapper = await client.get_genshin_detailed_characters(uid, characters=chunk)
            results.extend(details_wrapper.characters)
        except Exception as e:
            logger.error(f"Failed to fetch details for chunk {chunk}: {e}")
            # If 429 or auth error, we'd raise it up, but for partial errors we might just continue or fail safely
            raise
    return results

async def build_sync_preview(client: genshin.Client, uid: Optional[int] = None) -> list[SyncedCharacter]:
    """
    Builds the consolidated read-only sync preview matching the design specs, merging:
    - Basic battle chronicle (identity, basic stats)
    - Detailed battle chronicle (weapon exact ascension)
    - Calculator sync raw list (character exact ascension and talents)
    """
    # 1. Fetch Basic Characters
    basic_chars = await client.get_genshin_characters(uid)
    basic_dict = {c.id: c for c in basic_chars}

    # 2. Fetch Raw Calculator Sync (contains exact promote_level and skill_list for everyone in ONE call)
    calc_raw = await get_raw_calculator_characters(client, uid)
    calc_dict = {c.get("id"): c for c in calc_raw}

    # 3. Fetch Detailed BC for exact weapon ascension
    char_ids = list(basic_dict.keys())
    # We use a batch size of 20 to balance payload limits and concurrency
    details = await get_batched_detailed_characters(client, uid, char_ids, chunk_size=20)
    details_dict = {d.id: d for d in details}

    result = []

    for char_id, basic in basic_dict.items():
        calc_data = calc_dict.get(char_id, {})
        detail_data = details_dict.get(char_id)

        # Exact character ascension
        char_ascension = normalize_ascension(calc_data.get("promote_level"))

        # Talents
        skills = calc_data.get("skill_list", [])
        talents = None
        if len(skills) >= 3:
            # We assume first 3 are combat talents (normal, skill, burst).
            # Traveler has more but first 3 correspond to the active element.
            talents = CharacterTalents(
                normal=skills[0].get("level_current", 1),
                skill=skills[1].get("level_current", 1),
                burst=skills[2].get("level_current", 1),
            )

        # Exact weapon ascension
        weapon_ascension = None
        if detail_data and detail_data.weapon:
            # The DetailCharacterWeapon model exposes ascension natively
            weapon_ascension = normalize_ascension(getattr(detail_data.weapon, "ascension", None))

        weapon = None
        if basic.weapon:
            weapon = SyncWeapon(
                id=basic.weapon.id,
                name=basic.weapon.name,
                level=basic.weapon.level,
                ascension=weapon_ascension,
                refinement=basic.weapon.refinement
            )

        result.append(
            SyncedCharacter(
                id=basic.id,
                name=basic.name,
                element=basic.element,
                level=basic.level,
                ascension=char_ascension,
                constellation=basic.constellation,
                friendship=basic.friendship,
                talents=talents,
                weapon=weapon
            )
        )

    return result
