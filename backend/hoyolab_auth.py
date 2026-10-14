"""
HoYoLAB authentication engine for Traveler's Toolkit (Stage B1).

Implements the overseas HoYoLAB mobile app passport state machine:
- POST /api/hoyolab/auth/email-password
- POST /api/hoyolab/auth/geetest
- POST /api/hoyolab/auth/email-verify
- GET  /api/hoyolab/auth/accounts
- POST /api/hoyolab/auth/complete
- DELETE /api/hoyolab/auth/flow

Security invariants:
- Password is held only temporarily in encrypted flow state during multi-step challenges
- Password is removed immediately upon entering the 'authenticated' stage
- The final persistent session (tt_hoyolab_session) contains only {version, ltuid, ltoken}
- Temporary flow state is encrypted using HOYOLAB_FERNET and bound to <= 3500 bytes (measured after encryption)
- No passwords, tokens, or raw upstream errors are logged
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, Literal, Optional, Tuple

from cryptography.fernet import InvalidToken
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, model_validator
import genshin
from genshin.models.auth.cookie import AppLoginResult
from genshin.models.auth.geetest import (
    SessionMMT,
    SessionMMTv4,
    SessionMMTResult,
    SessionMMTv4Result,
)
from genshin.models.auth.verification import ActionTicket

import config
from config import (
    HOYOLAB_FERNET,
    STATE_COOKIE_MAX_AGE,
    UPSTREAM_TIMEOUT_SECONDS,
    get_cookie_delete_options,
    get_cookie_set_options,
)
from hoyolab_session import (
    set_hoyolab_session_cookie,
    validate_hoyolab_credentials,
)

logger = logging.getLogger(__name__)

auth_router = APIRouter(prefix="/api/hoyolab/auth", tags=["HoYoLAB Auth"])

FLOW_COOKIE_NAME = "tt_hoyolab_flow_state"
FLOW_COOKIE_MAX_AGE = STATE_COOKIE_MAX_AGE  # 10 minutes (600 seconds)
MAX_COOKIE_SIZE_BYTES = 3500  # Conservative application guard below RFC 6265 4096B limit


# ============================================================================
# Request Models
# ============================================================================

class EmailPasswordRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=256)


class GeetestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    gt_version: Literal[3, 4]

    # Geetest v3 fields
    geetest_challenge: Optional[str] = Field(default=None, max_length=512)
    geetest_validate: Optional[str] = Field(default=None, max_length=512)
    geetest_seccode: Optional[str] = Field(default=None, max_length=512)

    # Geetest v4 fields
    captcha_id: Optional[str] = Field(default=None, max_length=128)
    lot_number: Optional[str] = Field(default=None, max_length=512)
    pass_token: Optional[str] = Field(default=None, max_length=512)
    gen_time: Optional[str] = Field(default=None, max_length=64)
    captcha_output: Optional[str] = Field(default=None, max_length=1024)

    @model_validator(mode="after")
    def validate_version_fields(self):
        if self.gt_version == 3:
            if not self.geetest_challenge or not self.geetest_validate or not self.geetest_seccode:
                raise ValueError("Geetest v3 requires geetest_challenge, geetest_validate, and geetest_seccode.")
        elif self.gt_version == 4:
            if (
                not self.captcha_id
                or not self.lot_number
                or not self.pass_token
                or not self.gen_time
                or not self.captcha_output
            ):
                raise ValueError("Geetest v4 requires captcha_id, lot_number, pass_token, gen_time, and captcha_output.")
        return self


class EmailVerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class CompleteLoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    uid: int = Field(..., ge=100000000, le=9999999999)


# ============================================================================
# Flow State Encryption & Cookie Management
# ============================================================================

def _encode_flow_state(state: Dict[str, Any]) -> str:
    """Serialize and Fernet-encrypt the temporary login flow state.

    Enforces the application size ceiling on the FINAL encrypted token.
    """
    state["purpose"] = "hoyolab-login-flow"
    state["version"] = 1
    plaintext = json.dumps(state).encode("utf-8")
    encrypted_bytes = HOYOLAB_FERNET.encrypt(plaintext)
    if len(encrypted_bytes) > MAX_COOKIE_SIZE_BYTES:
        logger.error(
            "Authentication flow state size %d bytes exceeds %d ceiling",
            len(encrypted_bytes),
            MAX_COOKIE_SIZE_BYTES,
        )
        raise HTTPException(status_code=500, detail="Authentication flow state size limit exceeded.")
    return encrypted_bytes.decode("utf-8")


def _get_flow_delete_cookie_headers() -> Dict[str, str]:
    """Generate response headers to clear the tt_hoyolab_flow_state cookie."""
    dummy = Response()
    dummy.delete_cookie(key=FLOW_COOKIE_NAME, **get_cookie_delete_options())
    cookie_val = dummy.headers.get("set-cookie")
    return {"Set-Cookie": cookie_val} if cookie_val else {}


def _decode_flow_state(request: Request, response: Optional[Response] = None) -> Optional[Dict[str, Any]]:
    """Decrypt and validate the temporary login flow state cookie.

    Contract:
    - VALID COOKIE: Decrypts and validates purpose and version; returns state payload.
      Never mutates or deletes the flow cookie on successful decode.
    - INVALID / EXPIRED / TAMPERED / CORRUPTED COOKIE: Clears the flow cookie via
      HTTP 401 response headers and raises HTTPException(401).

    Args:
        request: FastAPI Request containing incoming cookies.
        response: Optional FastAPI Response. If provided, cookie deletion is also
            attached on terminal validation failure for defense-in-depth, but successful
            decoding NEVER mutates response cookies.

    Raises:
        HTTPException(401): If the cookie is invalid, expired, tampered with, corrupted, or has wrong schema.
    """
    token = request.cookies.get(FLOW_COOKIE_NAME)
    if not token:
        return None

    delete_headers = _get_flow_delete_cookie_headers()

    try:
        decrypted_bytes = HOYOLAB_FERNET.decrypt(token.encode("utf-8"), ttl=FLOW_COOKIE_MAX_AGE)
        data = json.loads(decrypted_bytes.decode("utf-8"))
    except InvalidToken:
        if response is not None:
            _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication flow expired or invalid.", headers=delete_headers)
    except Exception:
        if response is not None:
            _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication flow corrupted.", headers=delete_headers)

    if not isinstance(data, dict):
        if response is not None:
            _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication flow payload invalid.", headers=delete_headers)

    if data.get("purpose") != "hoyolab-login-flow" or data.get("version") != 1:
        if response is not None:
            _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication flow schema mismatch.", headers=delete_headers)

    return data


def _set_flow_cookie(response: Response, state: Dict[str, Any]) -> None:
    """Set the encrypted tt_hoyolab_flow_state cookie on the response."""
    token = _encode_flow_state(state)
    response.set_cookie(
        key=FLOW_COOKIE_NAME,
        value=token,
        **get_cookie_set_options(max_age=FLOW_COOKIE_MAX_AGE),
    )


def _delete_flow_cookie(response: Response) -> None:
    """Clear the tt_hoyolab_flow_state cookie."""
    response.delete_cookie(key=FLOW_COOKIE_NAME, **get_cookie_delete_options())


# ============================================================================
# Upstream Client Factory & Execution Helpers
# ============================================================================

def _create_auth_client(cookies: Optional[Dict[str, str]] = None) -> genshin.Client:
    """Factory creating an overseas Genshin client, respecting optional proxy configuration."""
    proxy = getattr(config, "HOYOLAB_LOGIN_PROXY", None)
    kwargs: Dict[str, Any] = {
        "region": genshin.Region.OVERSEAS,
        "game": genshin.Game.GENSHIN,
    }
    if proxy:
        kwargs["proxy"] = proxy

    if cookies:
        return genshin.Client(cookies, **kwargs)
    return genshin.Client(**kwargs)


async def _execute_app_login(
    client: genshin.Client,
    account: str,
    password: str,
    device_id: str,
    mmt_result: Optional[Any] = None,
    ticket: Optional[ActionTicket] = None,
) -> Any:
    """Execute _app_login safely with sanitized exception mapping and no secret logging."""
    try:
        coro = client._app_login(
            account=account,
            password=password,
            device_id=device_id,
            device_name="Travelers Toolkit",
            device_model="Desktop",
            mmt_result=mmt_result,
            ticket=ticket,
        )
        return await asyncio.wait_for(coro, timeout=UPSTREAM_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Upstream request timed out. Please try again later.")
    except genshin.errors.InvalidCookies:
        raise HTTPException(status_code=401, detail="Invalid account or password.")
    except genshin.errors.VerificationCodeRateLimited:
        raise HTTPException(
            status_code=429,
            detail="HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.",
        )
    except genshin.errors.GeetestFailed:
        raise HTTPException(
            status_code=400,
            detail="Security verification expired or was rejected. Please start sign-in again.",
        )
    except genshin.errors.GenshinException as e:
        logger.warning("HoYoLAB app login upstream error: %s", type(e).__name__)
        err_msg = str(e).lower()
        if "login" in err_msg or "password" in err_msg or "account" in err_msg or "auth" in err_msg:
            raise HTTPException(status_code=401, detail="Invalid account or password.")
        if "rate" in err_msg or "frequent" in err_msg or "too many" in err_msg:
            raise HTTPException(status_code=429, detail="Too many attempts. Please try again later.")
        raise HTTPException(status_code=502, detail="HoYoLAB authentication service is temporarily unavailable.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("HoYoLAB app login unexpected error: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")


def _classify_login_result(result: Any) -> Tuple[str, Any]:
    """Explicitly classify the result of _app_login without fragile string checks."""
    if isinstance(result, AppLoginResult):
        return "complete", result
    elif isinstance(result, SessionMMTv4):
        return "geetest_v4", result
    elif isinstance(result, SessionMMT):
        return "geetest_v3", result
    elif isinstance(result, ActionTicket):
        return "email_verify", result
    else:
        raise ValueError(f"Unrecognized login result type: {type(result).__name__}")


def _build_safe_geetest_v3_response(data: SessionMMT) -> Dict[str, Any]:
    """Format safe frontend payload for Geetest v3 challenges."""
    return {
        "nextStep": "geetest",
        "gtVersion": 3,
        "mmt": {
            "gt": data.gt,
            "challenge": data.challenge,
            "new_captcha": getattr(data, "new_captcha", 1),
            "success": getattr(data, "success", 1),
            "sessionId": data.session_id,
        },
    }


def _build_safe_geetest_v4_response(data: SessionMMTv4) -> Dict[str, Any]:
    """Format safe frontend payload for Geetest v4 challenges."""
    return {
        "nextStep": "geetest",
        "gtVersion": 4,
        "apiServer": "gcaptcha4.captchami.com",
        "mmt": {
            "captchaId": data.captcha_id,
            "riskType": getattr(data, "risk_type", None),
            "sessionId": data.session_id,
            "new_captcha": getattr(data, "new_captcha", 1),
            "success": getattr(data, "success", 1),
        },
    }


async def _derive_and_normalize_cookies(result: AppLoginResult) -> Dict[str, str]:
    """Extract ltuid_v2 and derive ltoken_v2 using fetch_cookie_with_stoken_v2 if needed."""
    raw_cookies: Dict[str, str] = {}
    if hasattr(result, "model_dump"):
        raw_cookies = result.model_dump()
    elif isinstance(result, dict):
        raw_cookies = dict(result)

    ltuid = raw_cookies.get("ltuid_v2") or raw_cookies.get("account_id_v2")
    ltoken = raw_cookies.get("ltoken_v2")

    if not ltuid:
        raise HTTPException(status_code=502, detail="HoYoLAB login did not return user identifier.")

    if not ltoken:
        # Perform token exchange: stoken + ltmid_v2 -> ltoken_v2
        stoken = raw_cookies.get("stoken")
        if not stoken:
            raise HTTPException(status_code=502, detail="HoYoLAB login did not return session token.")
        try:
            exchanged = await genshin.fetch_cookie_with_stoken_v2(raw_cookies, token_types=[2])
            ltoken = exchanged.get("ltoken_v2")
        except Exception as e:
            logger.error("Token derivation failed: %s", type(e).__name__)
            raise HTTPException(status_code=502, detail="Failed to derive HoYoLAB community token.")

    if not ltoken:
        raise HTTPException(status_code=502, detail="Community token is missing after token exchange.")

    return {
        "ltuid_v2": str(ltuid),
        "ltoken_v2": str(ltoken),
    }


# ============================================================================
# API Endpoints
# ============================================================================

@auth_router.post("/email-password")
async def email_password_login(payload: EmailPasswordRequest, response: Response):
    """Initiate HoYoLAB login using account credentials and return the next required step."""
    logger.info("HoYoLAB login flow initiated")
    device_id = genshin.Client.generate_app_device_id()
    client = _create_auth_client()

    result = await _execute_app_login(
        client=client,
        account=payload.account,
        password=payload.password,
        device_id=device_id,
    )
    branch, data = _classify_login_result(result)

    if branch == "complete":
        cookies = await _derive_and_normalize_cookies(data)
        # Transition to authenticated stage: PASSWORD IS REMOVED
        flow_state = {
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": device_id,
            "cookies": cookies,
        }
        _set_flow_cookie(response, flow_state)
        return {"nextStep": "complete"}

    elif branch == "geetest_v3":
        flow_state = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": device_id,
            "account": payload.account,
            "password": payload.password,
            "gt_version": 3,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, flow_state)
        return _build_safe_geetest_v3_response(data)

    elif branch == "geetest_v4":
        flow_state = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": device_id,
            "account": payload.account,
            "password": payload.password,
            "gt_version": 4,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, flow_state)
        return _build_safe_geetest_v4_response(data)

    elif branch == "email_verify":
        # Dispatch verification code to user's registered email
        try:
            dispatch_res = await client._send_verification_email(data)
        except genshin.errors.VerificationCodeRateLimited:
            raise HTTPException(
                status_code=429,
                detail="HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.",
            )
        except genshin.errors.GeetestFailed:
            _delete_flow_cookie(response)
            raise HTTPException(
                status_code=400,
                detail="Security verification expired or was rejected. Please start sign-in again.",
            )
        except Exception as e:
            logger.warning("Verification email dispatch failed: %s", type(e).__name__)
            raise HTTPException(status_code=502, detail="Failed to dispatch verification email.")

        if isinstance(dispatch_res, SessionMMT):
            # Upstream requested captcha before dispatching verification email
            flow_state = {
                "stage": "challenge",
                "challenge_context": "send_email",
                "created_at": int(time.time()),
                "device_id": device_id,
                "account": payload.account,
                "password": payload.password,
                "gt_version": 3,
                "session_id": dispatch_res.session_id,
                "action_ticket": data.model_dump(),
            }
            _set_flow_cookie(response, flow_state)
            return _build_safe_geetest_v3_response(dispatch_res)

        ticket_dict = data.model_dump()
        flow_state = {
            "stage": "email_verify",
            "created_at": int(time.time()),
            "device_id": device_id,
            "account": payload.account,
            "password": payload.password,
            "action_ticket": ticket_dict,
        }
        _set_flow_cookie(response, flow_state)
        return {"nextStep": "emailVerify"}


@auth_router.post("/geetest")
async def submit_geetest_solution(payload: GeetestRequest, request: Request, response: Response):
    """Submit Geetest captcha solution tokens and retry app login or email dispatch."""
    flow = _decode_flow_state(request, response)
    if not flow:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="No active authentication flow.")

    if flow.get("stage") != "challenge":
        raise HTTPException(status_code=400, detail="Invalid flow stage for captcha submission.")

    session_id = flow.get("session_id")
    if not session_id:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Challenge session missing.")

    challenge_context = flow.get("challenge_context", "app_login")
    if challenge_context not in ("app_login", "send_email"):
        _delete_flow_cookie(response)
        raise HTTPException(status_code=400, detail="Invalid challenge context.")

    if payload.gt_version == 3:
        mmt_result = SessionMMTResult(
            session_id=session_id,
            geetest_challenge=payload.geetest_challenge,
            geetest_validate=payload.geetest_validate,
            geetest_seccode=payload.geetest_seccode,
        )
    else:
        mmt_result = SessionMMTv4Result(
            session_id=session_id,
            captcha_id=payload.captcha_id,
            lot_number=payload.lot_number,
            pass_token=payload.pass_token,
            gen_time=payload.gen_time,
            captcha_output=payload.captcha_output,
        )

    client = _create_auth_client()

    if challenge_context == "send_email":
        ticket_raw = flow.get("action_ticket")
        if not ticket_raw:
            _delete_flow_cookie(response)
            raise HTTPException(status_code=400, detail="Action ticket missing for email challenge continuation.")

        # The initial _send_verification_email() operation returned the Geetest challenge.
        # Once that Geetest challenge is successfully solved, the flow proceeds directly to verification-code entry.
        # Re-dispatching the email-send operation after solving the challenge caused a real HoYoLAB response:
        # VerificationCodeRateLimited.
        new_flow = {
            "stage": "email_verify",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "action_ticket": ticket_raw,
        }
        _set_flow_cookie(response, new_flow)
        return {"nextStep": "emailVerify"}

    # challenge_context == "app_login"
    result = await _execute_app_login(
        client=client,
        account=flow["account"],
        password=flow["password"],
        device_id=flow["device_id"],
        mmt_result=mmt_result,
    )
    branch, data = _classify_login_result(result)

    if branch == "complete":
        cookies = await _derive_and_normalize_cookies(data)
        # Transition to authenticated stage: PASSWORD IS REMOVED
        new_flow = {
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "cookies": cookies,
        }
        _set_flow_cookie(response, new_flow)
        return {"nextStep": "complete"}

    elif branch == "email_verify":
        try:
            dispatch_res = await client._send_verification_email(data)
        except genshin.errors.VerificationCodeRateLimited:
            raise HTTPException(
                status_code=429,
                detail="HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.",
            )
        except genshin.errors.GeetestFailed:
            _delete_flow_cookie(response)
            raise HTTPException(
                status_code=400,
                detail="Security verification expired or was rejected. Please start sign-in again.",
            )
        except Exception as e:
            logger.warning("Verification email dispatch failed: %s", type(e).__name__)
            raise HTTPException(status_code=502, detail="Failed to dispatch verification email.")

        if isinstance(dispatch_res, SessionMMT):
            new_flow = {
                "stage": "challenge",
                "challenge_context": "send_email",
                "created_at": int(time.time()),
                "device_id": flow["device_id"],
                "account": flow["account"],
                "password": flow["password"],
                "gt_version": 3,
                "session_id": dispatch_res.session_id,
                "action_ticket": data.model_dump(),
            }
            _set_flow_cookie(response, new_flow)
            return _build_safe_geetest_v3_response(dispatch_res)

        new_flow = {
            "stage": "email_verify",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "action_ticket": data.model_dump(),
        }
        _set_flow_cookie(response, new_flow)
        return {"nextStep": "emailVerify"}

    elif branch == "geetest_v3":
        new_flow = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "gt_version": 3,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, new_flow)
        return _build_safe_geetest_v3_response(data)

    elif branch == "geetest_v4":
        new_flow = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "gt_version": 4,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, new_flow)
        return _build_safe_geetest_v4_response(data)


@auth_router.post("/email-verify")
async def verify_email_code(payload: EmailVerificationRequest, request: Request, response: Response):
    """Verify 6-digit email code and finalize login."""
    flow = _decode_flow_state(request, response)
    if not flow:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="No active authentication flow.")

    if flow.get("stage") != "email_verify":
        raise HTTPException(status_code=400, detail="Invalid flow stage for email verification.")

    ticket_raw = flow.get("action_ticket")
    if not ticket_raw:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Verification ticket missing.")

    ticket = ActionTicket(**ticket_raw)
    client = _create_auth_client()

    try:
        await client._verify_email(payload.code, ticket)
    except genshin.errors.VerificationCodeRateLimited:
        raise HTTPException(
            status_code=429,
            detail="HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.",
        )
    except genshin.errors.GenshinException as e:
        logger.warning("Email code verification failed: %s", type(e).__name__)
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
    except Exception as e:
        logger.error("Unexpected error during email code verification: %s", type(e).__name__)
        raise HTTPException(status_code=500, detail="Internal server error.")

    # Re-run _app_login with verified ticket
    result = await _execute_app_login(
        client=client,
        account=flow["account"],
        password=flow["password"],
        device_id=flow["device_id"],
        ticket=ticket,
    )
    branch, data = _classify_login_result(result)

    if branch == "complete":
        cookies = await _derive_and_normalize_cookies(data)
        # Transition to authenticated stage: PASSWORD IS REMOVED
        new_flow = {
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "cookies": cookies,
        }
        _set_flow_cookie(response, new_flow)
        return {"nextStep": "complete"}

    elif branch == "geetest_v3":
        new_flow = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "gt_version": 3,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, new_flow)
        return _build_safe_geetest_v3_response(data)

    elif branch == "geetest_v4":
        new_flow = {
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": flow["device_id"],
            "account": flow["account"],
            "password": flow["password"],
            "gt_version": 4,
            "session_id": data.session_id,
        }
        _set_flow_cookie(response, new_flow)
        return _build_safe_geetest_v4_response(data)

    else:
        raise HTTPException(status_code=502, detail="Unexpected state after verification.")


@auth_router.get("/accounts")
async def get_discovered_accounts(request: Request, response: Response):
    """Retrieve discovered Genshin Impact accounts for the authenticated login flow."""
    flow = _decode_flow_state(request, response)
    if not flow:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="No active authentication flow.")

    if flow.get("stage") != "authenticated":
        raise HTTPException(status_code=400, detail="Authentication flow is not completed.")

    cookies = flow.get("cookies")
    if not cookies or "ltuid_v2" not in cookies or "ltoken_v2" not in cookies:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Session credentials missing in flow state.")

    client = _create_auth_client(cookies=cookies)
    try:
        raw_accounts = await client.get_game_accounts()
    except genshin.errors.InvalidCookies:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication session expired or invalid.")
    except Exception as e:
        logger.error("Failed to discover game accounts: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Failed to retrieve game accounts from HoYoLAB.")

    genshin_accounts = [
        acc for acc in raw_accounts
        if acc.game == genshin.Game.GENSHIN and getattr(acc, "game_biz", "hk4e_global") == "hk4e_global"
    ]

    return {
        "accounts": [
            {
                "uid": acc.uid,
                "nickname": acc.nickname,
                "server": acc.server,
                "serverName": acc.server_name,
                "level": acc.level,
            }
            for acc in genshin_accounts
        ]
    }


@auth_router.post("/complete")
async def complete_login(payload: CompleteLoginRequest, request: Request, response: Response):
    """Select the active Genshin account, persist the tt_hoyolab_session, and destroy flow state."""
    flow = _decode_flow_state(request, response)
    if not flow:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="No active authentication flow.")

    if flow.get("stage") != "authenticated":
        raise HTTPException(status_code=400, detail="Authentication flow is not completed.")

    cookies = flow.get("cookies")
    if not cookies or "ltuid_v2" not in cookies or "ltoken_v2" not in cookies:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Session credentials missing in flow state.")

    client = _create_auth_client(cookies=cookies)
    try:
        raw_accounts = await client.get_game_accounts()
    except genshin.errors.InvalidCookies:
        _delete_flow_cookie(response)
        raise HTTPException(status_code=401, detail="Authentication session expired or invalid.")
    except Exception as e:
        logger.error("Failed to verify account during complete: %s", type(e).__name__)
        raise HTTPException(status_code=502, detail="Failed to verify game accounts.")

    genshin_accounts = [
        acc for acc in raw_accounts
        if acc.game == genshin.Game.GENSHIN and getattr(acc, "game_biz", "hk4e_global") == "hk4e_global"
    ]
    matched = next((acc for acc in genshin_accounts if acc.uid == payload.uid), None)

    if not matched:
        raise HTTPException(status_code=400, detail="Selected UID is not associated with this HoYoLAB account.")

    # Validate credentials against upstream service using Toolkit standard validation
    await validate_hoyolab_credentials(client, payload.uid)

    # Set existing persistent tt_hoyolab_session cookie
    set_hoyolab_session_cookie(response, cookies["ltuid_v2"], cookies["ltoken_v2"])

    # Destroy temporary flow state cookie
    _delete_flow_cookie(response)

    logger.info("HoYoLAB login flow completed successfully")

    return {
        "success": True,
        "account": {
            "uid": matched.uid,
            "nickname": matched.nickname,
            "server": matched.server,
            "serverName": matched.server_name,
            "level": matched.level,
        },
    }


@auth_router.delete("/flow")
async def cancel_login_flow(response: Response):
    """Explicitly cancel and destroy any active authentication flow state."""
    _delete_flow_cookie(response)
    return {"active": False}
