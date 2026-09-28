import json
import secrets
import httpx
import urllib.parse
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse, HTMLResponse, JSONResponse
from cryptography.fernet import InvalidToken
from pydantic import BaseModel, Field, ConfigDict
import time
from typing import Optional, Any, Literal

from config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REDIRECT_ORIGIN,
    require_google_config,
    get_cookie_set_options,
    get_cookie_delete_options,
    STATE_COOKIE_MAX_AGE,
    GOOGLE_FERNET
)

router = APIRouter()

COOKIE_NAME = "tt_google_session"
STATE_COOKIE_NAME = "tt_google_oauth_state"

class GoogleAuthError(Exception):
    def __init__(self, detail: str, clear_cookie: bool = True):
        self.detail = detail
        self.clear_cookie = clear_cookie

class BackupData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    roster: dict = Field(default_factory=dict)
    trackedWeapons: list = Field(default_factory=list)
    inventory: dict = Field(default_factory=dict)
    serverRegion: str = "Asia"
    showDbBuilder: bool = False

class BackupEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app: Literal["travelers-toolkit"]
    schemaVersion: Literal[1]
    createdAt: str
    data: BackupData

def get_google_fernet():
    require_google_config()
    return GOOGLE_FERNET


async def get_valid_access_token(request: Request, response: Response):
    encrypted_session = request.cookies.get(COOKIE_NAME)
    if not encrypted_session:
        raise GoogleAuthError("No Google session found.", clear_cookie=False)

    fernet = get_google_fernet()
    try:
        session_data = json.loads(fernet.decrypt(encrypted_session.encode()).decode())
    except Exception:
        raise GoogleAuthError("Invalid Google session.", clear_cookie=True)

    access_token = session_data.get("access_token")
    refresh_token = session_data.get("refresh_token")
    expiry = session_data.get("expiry", 0)

    # 60 seconds safety margin
    if time.time() + 60 > expiry:
        if not refresh_token:
            raise GoogleAuthError("Session expired and no refresh token available.", clear_cookie=True)

        # Refresh token
        async with httpx.AsyncClient() as client:
            res = await client.post("https://oauth2.googleapis.com/token", data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            })

            if res.status_code != 200:
                raise GoogleAuthError("Failed to refresh token. Session revoked.", clear_cookie=True)

            token_data = res.json()
            access_token = token_data["access_token"]
            expires_in = token_data["expires_in"]
            expiry = time.time() + expires_in

            session_data["access_token"] = access_token
            session_data["expiry"] = expiry
            if "refresh_token" in token_data:
                session_data["refresh_token"] = token_data["refresh_token"]

            new_encrypted = fernet.encrypt(json.dumps(session_data).encode()).decode()
            response.set_cookie(
                key=COOKIE_NAME,
                value=new_encrypted,
                **get_cookie_set_options()
            )

    return access_token

@router.get("/api/google/auth/start")
async def start_google_auth(response: Response):
    require_google_config()
    state = secrets.token_urlsafe(32)
    response = RedirectResponse(
        url=f"https://accounts.google.com/o/oauth2/v2/auth?client_id={GOOGLE_CLIENT_ID}&redirect_uri={urllib.parse.quote(GOOGLE_REDIRECT_URI)}&response_type=code&scope=https://www.googleapis.com/auth/drive.appdata%20https://www.googleapis.com/auth/userinfo.profile%20https://www.googleapis.com/auth/userinfo.email&access_type=offline&prompt=consent&state={state}"
    )
    response.set_cookie(
        key=STATE_COOKIE_NAME,
        value=state,
        **get_cookie_set_options(max_age=STATE_COOKIE_MAX_AGE)
    )
    return response

@router.get("/api/google/auth/callback")
async def google_auth_callback(request: Request, response: Response, code: str = None, state: str = None, error: str = None):
    expected_state = request.cookies.get(STATE_COOKIE_NAME)

    html_response = HTMLResponse(
        content=f'<script>window.opener.postMessage({{type: "google_auth", success: false}}, {json.dumps(GOOGLE_REDIRECT_ORIGIN)}); window.close();</script>'
    )
    html_response.delete_cookie(key=STATE_COOKIE_NAME, **get_cookie_delete_options())

    if error or not code or not state or not expected_state or not secrets.compare_digest(state, expected_state):
        return html_response

    async with httpx.AsyncClient() as client:
        res = await client.post("https://oauth2.googleapis.com/token", data={
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": GOOGLE_REDIRECT_URI
        })

        if res.status_code != 200:
            return html_response

        token_data = res.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")

        if not refresh_token:
            return html_response

        session_data = {
            "version": 1,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": time.time() + expires_in
        }

        fernet = get_google_fernet()
        encrypted_session = fernet.encrypt(json.dumps(session_data).encode()).decode()

        success_response = HTMLResponse(
            content=f'<script>window.opener.postMessage({{type: "google_auth", success: true}}, {json.dumps(GOOGLE_REDIRECT_ORIGIN)}); window.close();</script>'
        )
        success_response.delete_cookie(key=STATE_COOKIE_NAME, **get_cookie_delete_options())
        success_response.set_cookie(
            key=COOKIE_NAME,
            value=encrypted_session,
            **get_cookie_set_options()
        )
        return success_response
@router.get("/api/google/session")
async def check_google_session(request: Request, response: Response):
    try:
        access_token = await get_valid_access_token(request, response)
        async with httpx.AsyncClient() as client:
            user_res = await client.get(
                "https://www.googleapis.com/oauth2/v1/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            if user_res.status_code == 200:
                user_info = user_res.json()
                return {
                    "connected": True,
                    "user": {
                        "name": user_info.get("name"),
                        "email": user_info.get("email"),
                        "picture": user_info.get("picture")
                    }
                }
            elif user_res.status_code == 401:
                response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
                return {"connected": False, "user": None}
            else:
                return {"connected": False, "user": None}
    except GoogleAuthError as exc:
        if exc.clear_cookie:
            response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
        return {"connected": False, "user": None}

@router.delete("/api/google/session")
async def disconnect_google_session(response: Response):
    response.delete_cookie(key=COOKIE_NAME, **get_cookie_delete_options())
    return {"connected": False}

@router.post("/api/google/backups/manual")
async def create_manual_backup(request: Request, response: Response, payload: BackupEnvelope):
    access_token = await get_valid_access_token(request, response)

    metadata = {
        "name": f"travelers-toolkit-backup-{int(time.time() * 1000)}.json",
        "parents": ["appDataFolder"]
    }

    async with httpx.AsyncClient() as client:
        # Upload
        form = {
            "metadata": (None, json.dumps(metadata), "application/json"),
            "file": (None, payload.model_dump_json(), "application/json")
        }
        upload_res = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            headers={"Authorization": f"Bearer {access_token}"},
            files=form
        )
        if upload_res.status_code != 200:
            if upload_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=upload_res.status_code, detail="Upload failed")

        # Enforce 5 manual backups
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name contains 'travelers-toolkit-backup' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id, name, createdTime)",
                "orderBy": "createdTime desc"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code == 200:
            files = search_res.json().get("files", [])
            import re
            manual_files = [f for f in files if re.match(r"^travelers-toolkit-backup-\d+\.json$", f.get("name", ""))]
            if len(manual_files) > 5:
                for f in manual_files[5:]:
                    await client.delete(
                        f"https://www.googleapis.com/drive/v3/files/{f['id']}",
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
    return {"success": True}

@router.put("/api/google/backups/auto")
async def create_auto_backup(request: Request, response: Response, payload: BackupEnvelope):
    access_token = await get_valid_access_token(request, response)

    async with httpx.AsyncClient() as client:
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name = 'travelers-toolkit-auto-backup.json' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id)"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code == 401:
            raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)

        files = search_res.json().get("files", [])

        metadata = {
            "name": "travelers-toolkit-auto-backup.json"
        }
        form = {
            "metadata": (None, json.dumps(metadata), "application/json"),
            "file": (None, payload.model_dump_json(), "application/json")
        }

        if files:
            file_id = files[0]["id"]
            upload_res = await client.patch(
                f"https://www.googleapis.com/upload/drive/v3/files/{file_id}?uploadType=multipart",
                headers={"Authorization": f"Bearer {access_token}"},
                files=form
            )
        else:
            metadata["parents"] = ["appDataFolder"]
            form["metadata"] = (None, json.dumps(metadata), "application/json")
            upload_res = await client.post(
                "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                headers={"Authorization": f"Bearer {access_token}"},
                files=form
            )

        if upload_res.status_code not in (200, 201):
            if upload_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=upload_res.status_code, detail="Upload failed")

    return {"success": True}

@router.get("/api/google/backups")
async def list_manual_backups(request: Request, response: Response):
    access_token = await get_valid_access_token(request, response)

    async with httpx.AsyncClient() as client:
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name contains 'travelers-toolkit-backup' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id, name, createdTime)",
                "orderBy": "createdTime desc"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code != 200:
            if search_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=search_res.status_code, detail="List failed")

        files = search_res.json().get("files", [])
        import re
        manual_files = [f for f in files if re.match(r"^travelers-toolkit-backup-\d+\.json$", f.get("name", ""))]
        return manual_files

@router.get("/api/google/backups/recovery")
async def get_recovery_backup(request: Request, response: Response):
    access_token = await get_valid_access_token(request, response)

    async with httpx.AsyncClient() as client:
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name contains 'travelers-toolkit-' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id, name, createdTime, modifiedTime)"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code != 200:
            if search_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=search_res.status_code, detail="Failed to list backups")

        files = search_res.json().get("files", [])

        import re
        from datetime import datetime

        newest_file = None
        newest_time = None

        for f in files:
            name = f.get("name", "")
            is_manual = bool(re.match(r"^travelers-toolkit-backup-\d+\.json$", name))
            is_auto = name == "travelers-toolkit-auto-backup.json"

            if not is_manual and not is_auto:
                continue

            time_str = f.get("createdTime") if is_manual else f.get("modifiedTime")
            if not time_str:
                continue

            try:
                dt = datetime.fromisoformat(time_str.replace('Z', '+00:00'))
                ts = dt.timestamp()
            except Exception:
                continue

            if newest_time is None or ts > newest_time:
                newest_time = ts
                newest_file = f

        if not newest_file:
            raise HTTPException(status_code=404, detail="No recovery backups found")

        download_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{newest_file['id']}?alt=media",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if download_res.status_code != 200:
            if download_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=download_res.status_code, detail="Download failed")

        return Response(content=download_res.content, media_type="application/json")

@router.get("/api/google/backups/auto/status")
async def get_auto_backup_status(request: Request, response: Response):
    access_token = await get_valid_access_token(request, response)

    async with httpx.AsyncClient() as client:
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name = 'travelers-toolkit-auto-backup.json' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id, modifiedTime)"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code != 200:
            if search_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=search_res.status_code, detail="Failed to list backups")

        files = search_res.json().get("files", [])
        if files:
            return {
                "exists": True,
                "modifiedTime": files[0].get("modifiedTime")
            }
        else:
            return {
                "exists": False,
                "modifiedTime": None
            }

@router.get("/api/google/backups/{file_id}")
async def download_backup(request: Request, response: Response, file_id: str):
    access_token = await get_valid_access_token(request, response)
    async with httpx.AsyncClient() as client:
        search_res = await client.get(
            "https://www.googleapis.com/drive/v3/files",
            params={
                "q": "name contains 'travelers-toolkit-backup' and 'appDataFolder' in parents",
                "spaces": "appDataFolder",
                "fields": "files(id, name)"
            },
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if search_res.status_code != 200:
            if search_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=search_res.status_code, detail="Failed to list backups")
        files = search_res.json().get("files", [])
        import re
        matched_file = None
        for f in files:
            if f.get("id") == file_id and re.match(r"^travelers-toolkit-backup-\d+\.json$", f.get("name", "")):
                matched_file = f
                break
        if not matched_file:
            raise HTTPException(status_code=403, detail="File is not a valid manual backup")
        download_res = await client.get(
            f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if download_res.status_code != 200:
            if download_res.status_code == 401:
                raise GoogleAuthError("Google Drive unauthorized", clear_cookie=True)
            raise HTTPException(status_code=download_res.status_code, detail="Download failed")
        return Response(content=download_res.content, media_type="application/json")
