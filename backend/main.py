from fastapi import FastAPI, HTTPException, Response, Request, Cookie
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import genshin
import os
from dotenv import load_dotenv
import traceback
import json
from cryptography.fernet import Fernet
from cryptography.fernet import InvalidToken
from pydantic import BaseModel

load_dotenv()  # Load environment variables from .env file

HOYOLAB_SESSION_KEY = os.getenv("HOYOLAB_SESSION_KEY")
if not HOYOLAB_SESSION_KEY:
    raise ValueError("HOYOLAB_SESSION_KEY environment variable is missing. It must be a valid Fernet key.")

fernet = Fernet(HOYOLAB_SESSION_KEY.encode())

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
is_production = ENVIRONMENT.lower() == "production"

frontend_origins_str = os.getenv("FRONTEND_ORIGINS", "http://localhost:5173")
frontend_origins = [origin.strip() for origin in frontend_origins_str.split(",") if origin.strip()]

app = FastAPI(title="Traveler's Toolkit Backend")

# Add CORS middleware with explicit origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AuthPayload(BaseModel):
    ltuid: str
    ltoken: str
    uid: int = None

class NotesPayload(BaseModel):
    uid: int = None

COOKIE_NAME = "tt_hoyolab_session"
COOKIE_MAX_AGE = 30 * 24 * 60 * 60 # 30 days in seconds

def auth_failure_response(detail: str):
    response = JSONResponse(
        status_code=401,
        content={"detail": detail}
    )
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax", secure=is_production)
    return response

@app.post("/api/hoyolab/session")
async def connect_hoyolab_session(payload: AuthPayload, response: Response):
    if not payload.ltuid or not payload.ltoken:
        raise HTTPException(status_code=400, detail="LTUID or LTOKEN missing in request.")
    
    ltuid = payload.ltuid.strip()
    ltoken = payload.ltoken.strip()
    
    if not ltuid or not ltoken:
        raise HTTPException(status_code=400, detail="LTUID or LTOKEN cannot be blank.")

    cookies = {"ltuid_v2": ltuid, "ltoken_v2": ltoken}
    client = genshin.Client(cookies, game=genshin.Game.GENSHIN)
    
    try:
        # Perform a real authenticated call to prove credentials work
        await client.get_genshin_notes(payload.uid) if payload.uid else await client.get_genshin_notes()
    except genshin.errors.InvalidCookies:
        raise HTTPException(status_code=401, detail="Invalid or expired cookies.")
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            raise HTTPException(status_code=401, detail="Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
        
    # If successful, encrypt the credentials
    session_data = {
        "version": 1,
        "ltuid": ltuid,
        "ltoken": ltoken
    }
    encrypted_session = fernet.encrypt(json.dumps(session_data).encode()).decode()
    
    response.set_cookie(
        key=COOKIE_NAME,
        value=encrypted_session,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        path="/",
        secure=is_production
    )
    
    return {"connected": True}

@app.get("/api/hoyolab/session")
async def check_hoyolab_session(request: Request, response: Response):
    encrypted_session = request.cookies.get(COOKIE_NAME)
    if not encrypted_session:
        return {"connected": False}
        
    try:
        decrypted_data = fernet.decrypt(encrypted_session.encode()).decode()
        session_data = json.loads(decrypted_data)
        if not session_data.get("ltuid") or not session_data.get("ltoken"):
            response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax", secure=is_production)
            return {"connected": False}
        return {"connected": True}
    except InvalidToken:
        response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax", secure=is_production)
        return {"connected": False}
    except Exception:
        response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax", secure=is_production)
        return {"connected": False}

@app.delete("/api/hoyolab/session")
async def disconnect_hoyolab_session(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/", samesite="lax", secure=is_production)
    return {"connected": False}

@app.post("/api/notes")
async def get_real_time_notes(request: Request, response: Response, payload: NotesPayload = None):
    encrypted_session = request.cookies.get(COOKIE_NAME)
    if not encrypted_session:
        raise HTTPException(status_code=401, detail="No HoYoLAB session found.")
        
    try:
        decrypted_data = fernet.decrypt(encrypted_session.encode()).decode()
        session_data = json.loads(decrypted_data)
        ltuid = session_data.get("ltuid")
        ltoken = session_data.get("ltoken")
    except InvalidToken:
        return auth_failure_response("Session corrupted or invalid.")
    except Exception:
        return auth_failure_response("Session parsing failed.")
        
    if not ltuid or not ltoken:
        return auth_failure_response("Session missing credentials.")

    cookies = {"ltuid_v2": ltuid, "ltoken_v2": ltoken}
    client = genshin.Client(cookies, game=genshin.Game.GENSHIN)
    uid = payload.uid if payload else None
    
    try:
        if uid:
            data = await client.get_genshin_notes(uid)
        else:
            data = await client.get_genshin_notes()
            
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
    except genshin.errors.InvalidCookies:
        return auth_failure_response("Invalid or expired cookies.")
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            return auth_failure_response("Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
