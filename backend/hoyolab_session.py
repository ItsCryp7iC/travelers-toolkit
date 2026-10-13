"""
HoYoLAB persistent session utilities for Traveler's Toolkit.

Provides centralized helpers for:
- validating HoYoLAB credentials against upstream services
- creating and encrypting the persistent tt_hoyolab_session cookie
- setting persistent session cookies consistently across manual and automated login routes
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import HTTPException, Response
import genshin

from config import (
    HOYOLAB_FERNET,
    SESSION_COOKIE_MAX_AGE,
    UPSTREAM_TIMEOUT_SECONDS,
    get_cookie_set_options,
)

logger = logging.getLogger(__name__)

COOKIE_NAME = "tt_hoyolab_session"
COOKIE_MAX_AGE = SESSION_COOKIE_MAX_AGE


async def validate_hoyolab_credentials(client: genshin.Client, uid: Optional[int] = None) -> None:
    """Validate credentials by performing an authenticated upstream call.

    Raises:
        HTTPException: On timeout (504), invalid cookies (401), or upstream failure (400/500).
    """
    try:
        notes_coro = client.get_genshin_notes(uid) if uid else client.get_genshin_notes()
        await asyncio.wait_for(notes_coro, timeout=UPSTREAM_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Upstream request timed out. Please try again later.")
    except genshin.errors.InvalidCookies:
        raise HTTPException(status_code=401, detail="Invalid or expired cookies.")
    except genshin.errors.GenshinException as e:
        err_msg = str(e).lower()
        if "login" in err_msg or "auth" in err_msg or "cookie" in err_msg:
            raise HTTPException(status_code=401, detail="Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=400, detail="Authentication failed with upstream HoYoLAB service.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("HoYoLAB authentication unexpected error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")


def create_hoyolab_session_token(ltuid: str, ltoken: str) -> str:
    """Serialize and Fernet-encrypt persistent session data matching existing contract."""
    session_data = {
        "version": 1,
        "ltuid": str(ltuid),
        "ltoken": str(ltoken),
    }
    return HOYOLAB_FERNET.encrypt(json.dumps(session_data).encode("utf-8")).decode("utf-8")


def set_hoyolab_session_cookie(response: Response, ltuid: str, ltoken: str) -> None:
    """Set the standard encrypted tt_hoyolab_session cookie on the response."""
    encrypted_token = create_hoyolab_session_token(ltuid, ltoken)
    response.set_cookie(
        key=COOKIE_NAME,
        value=encrypted_token,
        **get_cookie_set_options(max_age=COOKIE_MAX_AGE),
    )
