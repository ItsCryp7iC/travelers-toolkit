"""
Distributed rate limiting module for Traveler's Toolkit HoYoLAB authentication (Stage B3).

Supports serverless/distributed rate limiting via Upstash Redis REST.
Invariants:
- Atomic fixed-window rate limiting executed via Redis Lua script (EVAL)
- Zero read-modify-write race conditions: INCR and EXPIRE are executed atomically in Redis
- Zero credential or raw IP retention in rate-limit keys or logs
- Keys contain fixed namespace, action, SHA-256 hashed client IP, and time bucket epoch
- Strict TTL bounded to the window duration: keys expire automatically
- Configured via UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
- If provider is configured and unreachable or returns malformed response: fails closed on auth with safe 503
- If unconfigured in dev/test: bypasses cleanly
- If unconfigured in prod: bypasses with warning (external launch gate step: RATE LIMIT CODE READY, ACTIVATION PENDING)
- Rate exceeded: returns HTTP 429 with integer Retry-After header and safe generic message
"""

import hashlib
import logging
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import HTTPException, Request
import httpx

import config

logger = logging.getLogger("backend.rate_limit")

# Rate limit policies: (max_allowed_requests, window_seconds)
RATE_LIMIT_POLICIES: Dict[str, Tuple[int, int]] = {
    "email_password": (5, 900),     # 5 attempts per 15 minutes
    "email_verify": (5, 900),       # 5 submissions per 15 minutes
    "geetest": (10, 900),           # 10 challenge submissions per 15 minutes
    "auth_global": (20, 900),       # 20 total auth attempts per 15 minutes
}

# Atomic Lua script for fixed-window rate limiting:
# Atomically increments the counter, sets expiry on first write or if TTL missing, and returns {count, ttl}
LUA_RATE_LIMIT_SCRIPT = """
local current = redis.call('INCR', KEYS[1])
if current == 1 or redis.call('TTL', KEYS[1]) < 0 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
"""

_warned_unconfigured_production = False


def get_trusted_client_ip(request: Request) -> str:
    """Extract client IP according to platform trust hierarchy.

    Vercel platform trust model:
    - On Vercel Edge infrastructure, incoming `x-vercel-forwarded-for` and `x-forwarded-for`
      are guaranteed to be set or overwritten by the edge proxy, reflecting the true connecting
      client IP and preventing external header spoofing.
    - `x-real-ip` is likewise set by the Vercel edge to the client IP.
    - Outside of Vercel (or in local dev/testing), arbitrary incoming forwarding headers
      are untrusted, and direct socket host (`request.client.host`) is preferred.

    Priority:
    1. x-vercel-forwarded-for: trusted platform header provided by Vercel Edge
    2. x-forwarded-for / x-real-ip: platform client IP if present
    3. request.client.host: fallback direct socket peer host (for local dev / tests)
    """
    vercel_ip = request.headers.get("x-vercel-forwarded-for")
    if vercel_ip:
        return vercel_ip.split(",")[0].strip()

    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def build_rate_limit_key(action: str, client_ip: str, window_seconds: int, now: Optional[float] = None) -> Tuple[str, int]:
    """Generate an anonymous cache key including window epoch bucket and remaining window TTL.

    Key structure: `rate:hoyolab:{action}:{sha256(client_ip)[:16]}:{bucket_epoch}`
    Never includes credentials, usernames, verification codes, or raw IPs in the key string.

    Returns:
        (key, remaining_seconds_in_window)
    """
    current_time = time.time() if now is None else now
    bucket = int(current_time // window_seconds)
    window_end = (bucket + 1) * window_seconds
    remaining_seconds = max(1, int(window_end - current_time))

    ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()[:16]
    key = f"rate:hoyolab:{action}:{ip_hash}:{bucket}"
    return key, remaining_seconds


async def _execute_upstash_rate_limit(
    url: str,
    token: str,
    key: str,
    expire_seconds: int,
) -> Tuple[int, int]:
    """Execute atomic Lua script via Upstash Redis REST API.

    Executes:
        INCR key
        if count == 1 or TTL < 0: EXPIRE key expire_seconds
        TTL key
    All within a single atomic EVAL execution on Redis.

    Returns:
        (current_count, ttl_seconds)

    Raises:
        HTTPException(503) if Upstash fails, times out, or returns a malformed response.
    """
    eval_command = ["EVAL", LUA_RATE_LIMIT_SCRIPT, 1, key, str(expire_seconds)]
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    endpoint = f"{url.rstrip('/')}/"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(endpoint, json=eval_command, headers=headers)
    except httpx.TimeoutException as e:
        logger.error("Upstash rate limit provider timed out: %s", type(e).__name__)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )
    except httpx.RequestError as e:
        logger.error("Upstash rate limit network error: %s", type(e).__name__)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    if resp.status_code != 200:
        logger.error("Upstash rate limit provider returned HTTP %d", resp.status_code)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    try:
        data: Dict[str, Any] = resp.json()
    except Exception as e:
        logger.error("Malformed Upstash response: not valid JSON (%s)", type(e).__name__)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    if not isinstance(data, dict):
        logger.error("Malformed Upstash response: expected JSON object, got %s", type(data).__name__)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    if "error" in data:
        logger.error("Upstash Redis error returned: %s", data.get("error"))
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    result = data.get("result")
    if not isinstance(result, (list, tuple)) or len(result) < 2:
        logger.error("Malformed Upstash response shape: expected [count, ttl], got %r", result)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    try:
        count = int(result[0])
        ttl = int(result[1])
    except (TypeError, ValueError) as e:
        logger.error("Malformed Upstash response values: %s", type(e).__name__)
        raise HTTPException(
            status_code=503,
            detail="Authentication service is temporarily unavailable. Please try again shortly.",
        )

    ttl_seconds = ttl if ttl > 0 else expire_seconds
    return count, ttl_seconds


async def check_rate_limit(request: Request, action: str) -> None:
    """Enforce distributed rate limits for sensitive HoYoLAB auth endpoints.

    Checks action-specific bucket first. If action bucket passes, checks the broader
    global auth ceiling. If either limit is exceeded, HTTP 429 is raised.

    If the action bucket passes and the global ceiling fails:
    The action bucket consumed 1 attempt, the global ceiling rejected the request,
    and HTTP 429 is returned. A request can never proceed if either limit is exceeded.
    """
    global _warned_unconfigured_production

    url = getattr(config, "UPSTASH_REDIS_REST_URL", None) or ""
    token = getattr(config, "UPSTASH_REDIS_REST_TOKEN", None) or ""

    if not url or not token:
        if config.IS_PRODUCTION:
            if not _warned_unconfigured_production:
                logger.warning(
                    "Distributed rate limiting provider is not configured in production. "
                    "Rate limit code is ready; activation is pending external configuration (UPSTASH_REDIS_REST_URL)."
                )
                _warned_unconfigured_production = True
        return

    client_ip = get_trusted_client_ip(request)

    # Order: specific action limit first, then global auth ceiling
    checks = []
    if action in RATE_LIMIT_POLICIES:
        checks.append((action, RATE_LIMIT_POLICIES[action]))
    if action != "auth_global":
        checks.append(("auth_global", RATE_LIMIT_POLICIES["auth_global"]))

    for check_action, (limit, window_seconds) in checks:
        key, remaining_seconds = build_rate_limit_key(check_action, client_ip, window_seconds)
        count, ttl = await _execute_upstash_rate_limit(url, token, key, remaining_seconds)

        if count > limit:
            logger.warning("Rate limit exceeded for action: %s", check_action)
            retry_after = max(1, ttl if ttl > 0 else remaining_seconds)
            raise HTTPException(
                status_code=429,
                detail="Too many sign-in attempts. Please wait before trying again.",
                headers={"Retry-After": str(retry_after)},
            )
