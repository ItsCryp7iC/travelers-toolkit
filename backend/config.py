import os
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet
from fastapi import HTTPException

# Load dotenv relative to this file
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
if ENVIRONMENT not in ("development", "production", "test"):
    raise ValueError(f"Invalid ENVIRONMENT: '{ENVIRONMENT}'. Must be 'development', 'production', or 'test'.")

IS_PRODUCTION = (ENVIRONMENT == "production")

# CORS Origins
frontend_origins_str = os.getenv("FRONTEND_ORIGINS", "").strip()
if not frontend_origins_str and not IS_PRODUCTION:
    frontend_origins_str = "http://localhost:5173"

if not frontend_origins_str:
    raise ValueError("FRONTEND_ORIGINS must be set when ENVIRONMENT is production.")

FRONTEND_ORIGINS = []
for origin in frontend_origins_str.split(","):
    origin = origin.strip()
    if not origin:
        continue
    if origin == "*":
        raise ValueError("Wildcard CORS origins are not allowed with credentials.")

    parsed = urllib.parse.urlparse(origin)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"Invalid scheme in origin '{origin}'. Must be http or https.")
    if not parsed.netloc:
        raise ValueError(f"Missing hostname in origin '{origin}'.")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError(f"Userinfo (username/password) is not allowed in origin '{origin}'.")
    try:
        if parsed.port:
            pass # Validates that port is parseable as int in range
    except ValueError:
        raise ValueError(f"Invalid port in origin '{origin}'.")
    if parsed.path and parsed.path != "/":
        raise ValueError(f"Path is not allowed in origin '{origin}'.")
    if parsed.query or parsed.fragment:
        raise ValueError(f"Query or fragment not allowed in origin '{origin}'.")

    normalized = f"{parsed.scheme}://{parsed.netloc}"
    if normalized not in FRONTEND_ORIGINS:
        FRONTEND_ORIGINS.append(normalized)

if not FRONTEND_ORIGINS:
    raise ValueError("FRONTEND_ORIGINS must contain at least one valid origin.")

# Cookie Policy
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "lax"
COOKIE_PATH = "/"
SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60  # 30 days
STATE_COOKIE_MAX_AGE = 600

def get_cookie_set_options(max_age=SESSION_COOKIE_MAX_AGE):
    return {
        "max_age": max_age,
        "httponly": True,
        "samesite": COOKIE_SAMESITE,
        "path": COOKIE_PATH,
        "secure": COOKIE_SECURE
    }

def get_cookie_delete_options():
    return {
        "httponly": True,
        "samesite": COOKIE_SAMESITE,
        "path": COOKIE_PATH,
        "secure": COOKIE_SECURE
    }

# HoYoLAB Key
HOYOLAB_SESSION_KEY_STR = os.getenv("HOYOLAB_SESSION_KEY", "").strip()
if not HOYOLAB_SESSION_KEY_STR:
    raise ValueError("HOYOLAB_SESSION_KEY environment variable is missing.")

try:
    HOYOLAB_FERNET = Fernet(HOYOLAB_SESSION_KEY_STR.encode())
except Exception:
    raise ValueError("HOYOLAB_SESSION_KEY is invalid. It must be a valid Fernet key.")

# Google Variables
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "").strip()
GOOGLE_SESSION_KEY_STR = os.getenv("GOOGLE_SESSION_KEY", "").strip()

GOOGLE_REDIRECT_ORIGIN = None
GOOGLE_FERNET = None

if GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET or GOOGLE_REDIRECT_URI or GOOGLE_SESSION_KEY_STR:
    if not all([GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_SESSION_KEY_STR]):
        raise ValueError("Google configuration is incomplete. All or none of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, GOOGLE_SESSION_KEY must be provided.")

    try:
        GOOGLE_FERNET = Fernet(GOOGLE_SESSION_KEY_STR.encode())
    except Exception:
        raise ValueError("GOOGLE_SESSION_KEY is invalid. It must be a valid Fernet key.")

    # Validate Redirect URI
    parsed_redirect = urllib.parse.urlparse(GOOGLE_REDIRECT_URI)
    if parsed_redirect.scheme not in ("http", "https"):
        raise ValueError("GOOGLE_REDIRECT_URI must be an http or https URL.")
    if not parsed_redirect.netloc:
        raise ValueError("GOOGLE_REDIRECT_URI missing hostname.")
    if parsed_redirect.path != "/api/google/auth/callback":
        raise ValueError("GOOGLE_REDIRECT_URI must exactly have path /api/google/auth/callback")
    if parsed_redirect.fragment or parsed_redirect.query:
        raise ValueError("GOOGLE_REDIRECT_URI must not contain a fragment or query.")

    GOOGLE_REDIRECT_ORIGIN = f"{parsed_redirect.scheme}://{parsed_redirect.netloc}"
    if GOOGLE_REDIRECT_ORIGIN not in FRONTEND_ORIGINS:
        raise ValueError(f"GOOGLE_REDIRECT_ORIGIN '{GOOGLE_REDIRECT_ORIGIN}' is not in trusted FRONTEND_ORIGINS.")

def require_google_config():
    if not GOOGLE_FERNET:
        raise HTTPException(status_code=501, detail="Google integration is not configured on this server.")
