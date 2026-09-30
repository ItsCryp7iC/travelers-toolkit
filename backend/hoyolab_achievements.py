"""
HoYoLAB Achievement normalization for Traveler's Toolkit.

Phase B proof-of-concept: normalizes raw HoYoLAB achievement summary
responses into the Traveler's Toolkit backend contract.

This module is intentionally pure (no network, no auth, no genshin.Client)
so it can be unit-tested without mocks or network calls.
"""


class AchievementNormalizationError(Exception):
    """Raised when raw HoYoLAB achievement data is structurally unusable."""
    pass


def normalize_category(raw_category):
    """Normalize a single raw HoYoLAB achievement category entry.

    Args:
        raw_category: A dict-like object from the HoYoLAB category list.

    Returns:
        A normalized category dict matching the Traveler's Toolkit contract.

    Raises:
        AchievementNormalizationError: If required fields are missing or invalid.
    """
    if not isinstance(raw_category, dict):
        raise AchievementNormalizationError(
            f"Category entry is not a dict: {type(raw_category).__name__}"
        )

    # ID: required, serialize to string
    raw_id = raw_category.get("id")
    if raw_id is None:
        raise AchievementNormalizationError("Category missing 'id' field.")
    hoyolab_id = str(raw_id)

    # Name: required string
    name = raw_category.get("name")
    if not isinstance(name, str) or not name.strip():
        raise AchievementNormalizationError(
            f"Category '{hoyolab_id}' has invalid or missing 'name'."
        )

    # Icon: string or null
    icon = raw_category.get("icon")
    if not isinstance(icon, str) or not icon.strip():
        icon = None

    # Completed count: required integer from finish_num
    finish_num = raw_category.get("finish_num")
    if not isinstance(finish_num, int):
        raise AchievementNormalizationError(
            f"Category '{hoyolab_id}' has invalid 'finish_num': {finish_num!r}"
        )

    # Percentage: only when show_percent is explicitly true
    show_percent = raw_category.get("show_percent", False)
    raw_percentage = raw_category.get("percentage")

    if show_percent is True and isinstance(raw_percentage, (int, float)):
        percentage = raw_percentage
    else:
        percentage = None

    return {
        "hoyolabId": hoyolab_id,
        "name": name.strip(),
        "icon": icon,
        "completed": finish_num,
        "percentage": percentage,
    }


def normalize_achievement_response(raw):
    """Normalize a full raw HoYoLAB achievement summary response.

    Args:
        raw: The raw response dict from HoYoLAB (the 'data' field from
             retcode==0 responses, or the full response if the caller
             has already extracted it).

    Returns:
        A normalized dict matching the Traveler's Toolkit backend contract:
        {
            "connected": True,
            "totalCompleted": int,
            "categories": [...]
        }

    Raises:
        AchievementNormalizationError: If the response is structurally unusable.
    """
    if not isinstance(raw, dict):
        raise AchievementNormalizationError(
            f"Expected dict response, got {type(raw).__name__}"
        )

    # achievement_num: required integer
    achievement_num = raw.get("achievement_num")
    if not isinstance(achievement_num, int):
        raise AchievementNormalizationError(
            f"Missing or invalid 'achievement_num': {achievement_num!r}"
        )

    # list: required array of categories
    raw_list = raw.get("list")
    if not isinstance(raw_list, list):
        raise AchievementNormalizationError(
            f"Missing or invalid 'list': expected array, got {type(raw_list).__name__}"
        )

    categories = []
    for entry in raw_list:
        categories.append(normalize_category(entry))

    return {
        "connected": True,
        "totalCompleted": achievement_num,
        "categories": categories,
    }


def build_diagnostic(raw):
    """Build a sanitized diagnostic summary of raw HoYoLAB achievement data.

    This is for development-only inspection of the actual response shape.
    Never includes credentials, cookies, or sensitive headers.

    Args:
        raw: The raw response dict (the 'data' field).

    Returns:
        A dict with schema-level diagnostic information, or None if
        the raw data is not dict-like.
    """
    if not isinstance(raw, dict):
        return None

    diagnostic = {
        "rawDataKeys": sorted(raw.keys()),
    }

    raw_list = raw.get("list")
    if isinstance(raw_list, list):
        diagnostic["categoryCount"] = len(raw_list)
        if raw_list and isinstance(raw_list[0], dict):
            diagnostic["sampleCategoryKeys"] = sorted(raw_list[0].keys())
        else:
            diagnostic["sampleCategoryKeys"] = []
    else:
        diagnostic["categoryCount"] = 0
        diagnostic["sampleCategoryKeys"] = []

    return diagnostic
