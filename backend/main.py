import asyncio
import logging
import json
from fastapi import FastAPI, HTTPException, Response, Request, Cookie
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import genshin
from cryptography.fernet import InvalidToken
from pydantic import BaseModel, Field, ConfigDict
from google_api import router as google_router, GoogleAuthError
from hoyolab_achievements import (
    normalize_achievement_response,
    build_diagnostic,
    AchievementNormalizationError,
)

from config import (
    IS_PRODUCTION,
    FRONTEND_ORIGINS,
    HOYOLAB_FERNET,
    SESSION_COOKIE_MAX_AGE,
    UPSTREAM_TIMEOUT_SECONDS,
    get_cookie_set_options,
    get_cookie_delete_options
)

logger = logging.getLogger("backend.main")

app = FastAPI(
    title="Traveler's Toolkit Backend",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json"
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response

@app.exception_handler(GoogleAuthError)
async def google_auth_exception_handler(request: Request, exc: GoogleAuthError):
    response = JSONResponse(
        status_code=401,
        content={"detail": exc.detail}
    )
    if exc.clear_cookie:
        response.delete_cookie(
            key="tt_google_session",
            **get_cookie_delete_options()
        )
    return response

# Add CORS middleware with explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)

from hoyolab_auth import auth_router
from hoyolab_session import (
    COOKIE_NAME,
    COOKIE_MAX_AGE,
    set_hoyolab_session_cookie,
    validate_hoyolab_credentials,
)

app.include_router(google_router)
app.include_router(auth_router)

class AuthPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ltuid: str = Field(..., min_length=1, max_length=128)
    ltoken: str = Field(..., min_length=1, max_length=512)
    uid: int | None = Field(default=None, ge=100000000, le=9999999999)

class NotesPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: int | None = Field(default=None, ge=100000000, le=9999999999)

class AchievementPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: int | None = Field(default=None, ge=100000000, le=9999999999)

class CalculatorSyncPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: int | None = Field(default=None, ge=100000000, le=9999999999)

COOKIE_NAME = "tt_hoyolab_session"
COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days in seconds

def sanitize_credential_token(raw: str, key_hint: str) -> str:
    """Sanitize pasted credential strings (handling whitespace, key=value format, quotes, semicolons)."""
    if not raw:
        return ""
    val = raw.strip().strip("'\"").strip()
    if "=" in val:
        k, _, v = val.partition("=")
        if key_hint in k.lower():
            val = v.strip().strip("'\"").strip()
    return val.rstrip(";").strip().strip("'\"")

def auth_failure_response(detail: str):
    response = JSONResponse(
        status_code=401,
        content={"detail": detail}
    )
    response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
    return response

def _get_hoyolab_client(request: Request):
    """Decrypt the HoYoLAB session cookie and return (client, error_response).

    Returns:
        (genshin.Client, None) on success.
        (None, JSONResponse) on failure — caller should return the response.
    """
    encrypted_session = request.cookies.get(COOKIE_NAME)
    if not encrypted_session:
        return None, JSONResponse(
            status_code=401,
            content={"detail": "No HoYoLAB session found."}
        )

    try:
        decrypted_data = HOYOLAB_FERNET.decrypt(
            encrypted_session.encode(),
            ttl=SESSION_COOKIE_MAX_AGE
        ).decode()
        session_data = json.loads(decrypted_data)
        ltuid = session_data.get("ltuid")
        ltoken = session_data.get("ltoken")
    except InvalidToken:
        return None, auth_failure_response("Session corrupted, expired, or invalid.")
    except Exception:
        return None, auth_failure_response("Session parsing failed.")

    if not ltuid or not ltoken:
        return None, auth_failure_response("Session missing credentials.")

    cookies = {"ltuid_v2": ltuid, "ltoken_v2": ltoken}
    client = genshin.Client(cookies, game=genshin.Game.GENSHIN)
    return client, None

@app.post("/api/hoyolab/session")
async def connect_hoyolab_session(payload: AuthPayload, response: Response):
    ltuid = sanitize_credential_token(payload.ltuid, "ltuid")
    ltoken = sanitize_credential_token(payload.ltoken, "ltoken")

    if not ltuid or not ltoken:
        raise HTTPException(status_code=400, detail="LTUID or LTOKEN cannot be blank.")

    cookies = {"ltuid_v2": ltuid, "ltoken_v2": ltoken}
    client = genshin.Client(cookies, game=genshin.Game.GENSHIN)

    await validate_hoyolab_credentials(client, payload.uid)
    set_hoyolab_session_cookie(response, ltuid, ltoken)

    return {"connected": True}

@app.get("/api/hoyolab/session")
async def check_hoyolab_session(request: Request, response: Response):
    encrypted_session = request.cookies.get(COOKIE_NAME)
    if not encrypted_session:
        return {"connected": False}

    try:
        decrypted_data = HOYOLAB_FERNET.decrypt(
            encrypted_session.encode(),
            ttl=SESSION_COOKIE_MAX_AGE
        ).decode()
        session_data = json.loads(decrypted_data)
        if not session_data.get("ltuid") or not session_data.get("ltoken"):
            response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
            return {"connected": False}
        return {"connected": True}
    except InvalidToken:
        response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
        return {"connected": False}
    except Exception:
        response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
        return {"connected": False}

@app.delete("/api/hoyolab/session")
async def disconnect_hoyolab_session(response: Response):
    response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
    return {"connected": False}

@app.post("/api/notes")
async def get_real_time_notes(request: Request, response: Response, payload: NotesPayload = None):
    client, err = _get_hoyolab_client(request)
    if err is not None:
        return err

    uid = payload.uid if payload else None

    try:
        notes_coro = client.get_genshin_notes(uid) if uid else client.get_genshin_notes()
        data = await asyncio.wait_for(notes_coro, timeout=UPSTREAM_TIMEOUT_SECONDS)

        # Resin details
        resin_payload = {
            "current": data.current_resin,
            "max": data.max_resin,
            "recovery_time_seconds": data.remaining_resin_recovery_time.total_seconds()
        }

        # Realm currency details
        realm_currency_payload = {
            "current": data.current_realm_currency,
            "max": data.max_realm_currency,
            "recovery_time_seconds": data.remaining_realm_currency_recovery_time.total_seconds()
        }

        return {
            "resin": resin_payload,
            "realm_currency": realm_currency_payload
        }
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Upstream request timed out. Please try again later.")
    except genshin.errors.InvalidCookies:
        return auth_failure_response("Invalid or expired cookies.")
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            return auth_failure_response("Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=502, detail="HoYoLAB service is temporarily unavailable.")
    except Exception as e:
        logger.error("HoYoLAB notes unexpected error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")

@app.post("/api/hoyolab/achievements")
async def get_achievement_summary(request: Request, payload: AchievementPayload = None):
    """Phase B: HoYoLAB achievement summary proof of concept.

    Returns a normalized achievement category summary from HoYoLAB.
    Uses the existing encrypted session cookie — no credentials in the body.

    IMPORTANT: DataNotPublic / privacy errors do NOT clear the session cookie.
    Only genuine auth failures (InvalidCookies) clear the cookie.
    """
    client, err = _get_hoyolab_client(request)
    if err is not None:
        return err

    uid = payload.uid if payload else None

    try:
        achieve_coro = client._request_genshin_record(
            "achievement",
            uid,
            method="POST",
        )
        raw = await asyncio.wait_for(achieve_coro, timeout=UPSTREAM_TIMEOUT_SECONDS)

        normalized = normalize_achievement_response(raw)

        result = normalized

        # Development-only diagnostic: expose schema-level info
        # for inspecting the actual HoYoLAB response shape.
        # NEVER includes credentials or sensitive data.
        if not IS_PRODUCTION:
            diagnostic = build_diagnostic(raw)
            if diagnostic is not None:
                result["diagnostic"] = diagnostic

        return result

    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Upstream request timed out. Please try again later.")
    except genshin.errors.InvalidCookies:
        return auth_failure_response("Invalid or expired cookies.")
    except genshin.errors.DataNotPublic:
        # Privacy setting — do NOT clear the session cookie
        raise HTTPException(
            status_code=403,
            detail="Achievement summary is unavailable. Check Battle Chronicle visibility settings."
        )
    except genshin.errors.TooManyRequests:
        raise HTTPException(
            status_code=429,
            detail="HoYoLAB is temporarily rate limiting requests. Please try again later."
        )
    except genshin.errors.AccountNotFound:
        raise HTTPException(
            status_code=404,
            detail="No Genshin Impact account found for this HoYoLAB session."
        )
    except AchievementNormalizationError as e:
        raise HTTPException(
            status_code=502,
            detail=f"HoYoLAB achievement response could not be processed: {e}"
        )
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            return auth_failure_response("Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=502, detail="HoYoLAB achievement service is temporarily unavailable.")
    except Exception as e:
        logger.error("HoYoLAB achievement unexpected error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")


from hoyolab_character_sync import build_sync_preview

@app.post("/api/hoyolab/character-sync-preview")
async def character_sync_preview(request: Request, payload: CalculatorSyncPayload = None):
    client, err = _get_hoyolab_client(request)
    if err is not None:
        return err

    uid = payload.uid if payload else None

    try:
        preview = await asyncio.wait_for(build_sync_preview(client, uid), timeout=UPSTREAM_TIMEOUT_SECONDS * 2)
        return {"characters": [p.model_dump() for p in preview]}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Upstream request timed out. Please try again later.")
    except genshin.errors.InvalidCookies:
        return auth_failure_response("Invalid or expired cookies.")
    except genshin.errors.DataNotPublic:
        raise HTTPException(status_code=403, detail="Character data is unavailable.")
    except genshin.errors.TooManyRequests:
        raise HTTPException(status_code=429, detail="HoYoLAB is temporarily rate limiting requests.")
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            return auth_failure_response("Authentication failed.")
        raise HTTPException(status_code=502, detail="HoYoLAB character sync is temporarily unavailable.")
    except Exception as e:
        logger.error("HoYoLAB character sync unexpected error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
