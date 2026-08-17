from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import genshin
import os
from dotenv import load_dotenv
import traceback

load_dotenv()  # Load environment variables from .env file

app = FastAPI(title="Traveler's Toolkit Backend")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pydantic import BaseModel

class AuthPayload(BaseModel):
    ltuid: str
    ltoken: str
    uid: int = None

@app.post("/api/notes")
async def get_real_time_notes(payload: AuthPayload):
    if not payload.ltuid or not payload.ltoken:
        raise HTTPException(status_code=401, detail="LTUID or LTOKEN missing in request.")
        
    cookies = {"ltuid_v2": payload.ltuid, "ltoken_v2": payload.ltoken}
    client = genshin.Client(cookies, game=genshin.Game.GENSHIN)
    
    try:
        if payload.uid:
            data = await client.get_genshin_notes(payload.uid)
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
    except genshin.errors.InvalidCookies as e:
        raise HTTPException(status_code=401, detail="Invalid or expired cookies.")
    except genshin.errors.GenshinException as e:
        if "login" in str(e).lower() or "auth" in str(e).lower() or "cookie" in str(e).lower():
            raise HTTPException(status_code=401, detail="Authentication failed. Please check your cookies.")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
