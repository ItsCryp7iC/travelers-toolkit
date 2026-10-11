import unittest
import os
import sys
import importlib
import json
import time
from unittest.mock import AsyncMock, patch, MagicMock
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import genshin

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestSecurityHardening(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        self.fernet_key = Fernet.generate_key().decode()
        self.google_key = Fernet.generate_key().decode()

        os.environ["ENVIRONMENT"] = "test"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = self.fernet_key
        os.environ["GOOGLE_CLIENT_ID"] = "test-id"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test-secret"
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/api/google/auth/callback"
        os.environ["GOOGLE_SESSION_KEY"] = self.google_key

        import config
        importlib.reload(config)
        import google_api
        importlib.reload(google_api)
        import main
        importlib.reload(main)

        self.config = config
        self.main = main
        self.fernet = Fernet(self.fernet_key.encode())
        self.google_fernet = Fernet(self.google_key.encode())
        self.client = TestClient(main.app)

    def tearDown(self):
        import config
        config.GOOGLE_FERNET = None
        os.environ.clear()
        os.environ.update(self.original_env)

    def _make_valid_session_cookie(self, ltuid="12345678", ltoken="valid_token_xyz"):
        data = {"version": 1, "ltuid": ltuid, "ltoken": ltoken}
        return self.fernet.encrypt(json.dumps(data).encode()).decode()

    def _make_valid_google_session_cookie(self, access_token="mock_tok", refresh_token="mock_ref", expiry=None):
        data = {
            "version": 1,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expiry": expiry or (time.time() + 3600)
        }
        return self.google_fernet.encrypt(json.dumps(data).encode()).decode()

    def _make_canonical_backup_payload(self, **data_overrides):
        data = {
            "roster": {"Hu Tao": {"level": 90, "constellation": 1}},
            "trackedWeapons": [{"id": "w1", "name": "Staff of Homa"}],
            "inventory": {"m1": 100},
            "serverRegion": "America",
            "showDbBuilder": True,
            "displayTimeZone": "America/New_York",
            "achievementProgress": {"80001": {"completed": True, "completedAt": None}},
        }
        data.update(data_overrides)
        return {
            "app": "travelers-toolkit",
            "schemaVersion": 1,
            "createdAt": "2026-10-11T20:00:00.000Z",
            "data": data,
        }

    # 1. Security Headers
    def test_security_headers_present_on_api(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("x-content-type-options"), "nosniff")
        self.assertIn("no-store", res.headers.get("cache-control", ""))

    # 2. Input Validation: UID bounds
    def test_invalid_uid_bounds_rejected(self):
        # Negative UID
        res = self.client.post("/api/notes", json={"uid": -1})
        self.assertEqual(res.status_code, 422)

        # UID too small (less than 9 digits)
        res = self.client.post("/api/notes", json={"uid": 12345})
        self.assertEqual(res.status_code, 422)

        # UID too large (more than 10 digits)
        res = self.client.post("/api/notes", json={"uid": 100000000000})
        self.assertEqual(res.status_code, 422)

    # 3. Input Validation: Extra fields forbidden
    def test_forbidden_extra_fields_rejected(self):
        res = self.client.post("/api/hoyolab/session", json={
            "ltuid": "12345",
            "ltoken": "test",
            "injected_field": "exploit"
        })
        self.assertEqual(res.status_code, 422)

    # 4. Credential Sanitizer
    def test_credential_sanitizer(self):
        from main import sanitize_credential_token
        # Standard pasted with key_v2
        self.assertEqual(sanitize_credential_token("ltuid_v2=12345678;", "ltuid"), "12345678")
        self.assertEqual(sanitize_credential_token("  ltoken_v2=\"token_secret_123\"; ", "ltoken"), "token_secret_123")
        # Standard raw token
        self.assertEqual(sanitize_credential_token("raw_token_value", "ltoken"), "raw_token_value")
        # Empty string
        self.assertEqual(sanitize_credential_token("", "ltuid"), "")

    # 5. Session Tampering
    def test_tampered_cookie_returns_401_and_clears_cookie(self):
        # Case A: Random garbage
        self.client.cookies.set("tt_hoyolab_session", "random_garbage_not_fernet")
        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["detail"], "Session corrupted, expired, or invalid.")
        set_cookie = res.headers.get("set-cookie", "")
        self.assertTrue("tt_hoyolab_session=;" in set_cookie or "Max-Age=0" in set_cookie)

        # Case B: Truncated valid token
        valid_tok = self._make_valid_session_cookie()
        truncated = valid_tok[:len(valid_tok) // 2]
        self.client.cookies.set("tt_hoyolab_session", truncated)
        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 401)

        # Case C: Wrong key
        other_key = Fernet.generate_key()
        other_fernet = Fernet(other_key)
        wrong_key_tok = other_fernet.encrypt(b'{"version": 1, "ltuid": "1", "ltoken": "2"}').decode()
        self.client.cookies.set("tt_hoyolab_session", wrong_key_tok)
        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 401)

    # 6. Session TTL Expiration
    def test_expired_session_cookie_ttl_rejected(self):
        valid_tok = self._make_valid_session_cookie()
        self.client.cookies.set("tt_hoyolab_session", valid_tok)

        # Advance time by 31 days (beyond 30-day SESSION_COOKIE_MAX_AGE)
        future_time = time.time() + (31 * 24 * 60 * 60)
        with patch("time.time", return_value=future_time):
            res = self.client.post("/api/notes", json={})
            self.assertEqual(res.status_code, 401)
            self.assertEqual(res.json()["detail"], "Session corrupted, expired, or invalid.")
            set_cookie = res.headers.get("set-cookie", "")
            self.assertTrue("tt_hoyolab_session=;" in set_cookie or "Max-Age=0" in set_cookie)

    # 7. Upstream Timeout Mapping
    @patch("genshin.Client.get_genshin_notes", new_callable=AsyncMock)
    def test_upstream_timeout_mapped_to_504(self, mock_notes):
        mock_notes.side_effect = TimeoutError("Network timeout")
        self.client.cookies.set("tt_hoyolab_session", self._make_valid_session_cookie())

        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 504)
        self.assertIn("timed out", res.json()["detail"].lower())

    # 8. Error Sanitization: Raw exception text must never leak
    @patch("genshin.Client.get_genshin_notes", new_callable=AsyncMock)
    def test_raw_exception_text_never_leaked(self, mock_notes):
        mock_notes.side_effect = genshin.errors.GenshinException({
            "retcode": -1,
            "message": "CRITICAL_INTERNAL_URL: https://internal-api.hoyoverse.com/secret-endpoint?token=supersecret123"
        })
        self.client.cookies.set("tt_hoyolab_session", self._make_valid_session_cookie())

        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 502)
        # Verify sensitive internal url and token are NOT in response detail
        self.assertNotIn("internal-api.hoyoverse.com", res.text)
        self.assertNotIn("supersecret123", res.text)
        self.assertEqual(res.json()["detail"], "HoYoLAB service is temporarily unavailable.")

    # 9. Robust Logout
    def test_robust_logout_with_tampered_cookie(self):
        self.client.cookies.set("tt_hoyolab_session", "corrupted_cookie_content")
        res = self.client.delete("/api/hoyolab/session")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"connected": False})
        set_cookie = res.headers.get("set-cookie", "")
        self.assertTrue("tt_hoyolab_session=;" in set_cookie or "Max-Age=0" in set_cookie)

    # 10. Google Drive File ID Quoting
    @patch("google_api.get_valid_access_token", new_callable=AsyncMock)
    @patch("google_api.get_google_http_client")
    def test_google_file_id_url_quoting(self, mock_client_factory, mock_token):
        mock_token.return_value = "fake_access_token"
        mock_http_client = AsyncMock()

        # Mock listing files
        list_response = AsyncMock()
        list_response.status_code = 200
        from unittest.mock import MagicMock
        list_response.json = MagicMock(return_value={
            "files": [{"id": "file:special_id", "name": "travelers-toolkit-backup-12345.json"}]
        })

        # Mock downloading file
        download_response = AsyncMock()
        download_response.status_code = 200
        download_response.content = b'{"success": true}'

        mock_http_client.get.side_effect = [list_response, download_response]
        mock_client_factory.return_value.__aenter__.return_value = mock_http_client

        res = self.client.get("/api/google/backups/file:special_id")
        self.assertEqual(res.status_code, 200)

        # Ensure download call quoted the file_id
        second_call_url = mock_http_client.get.call_args_list[1][0][0]
        self.assertIn("file%3Aspecial_id", second_call_url)

    # 11. Missing HoYoLAB Cookie returns 401 (not 500)
    def test_missing_hoyolab_cookie_returns_401(self):
        res = self.client.post("/api/notes", json={})
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["detail"], "No HoYoLAB session found.")

    # 12. Missing Google Cookie returns 401 (not 500)
    def test_missing_google_cookie_returns_401(self):
        backup_payload = self._make_canonical_backup_payload()
        res = self.client.post("/api/google/backups/manual", json=backup_payload)
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["detail"], "No Google session found.")

    # 13. Malformed Google Cookie returns 401 and clears cookie
    def test_malformed_google_cookie_returns_401_and_clears(self):
        self.client.cookies.set("tt_google_session", "malformed_token_not_fernet")
        backup_payload = self._make_canonical_backup_payload()
        res = self.client.post("/api/google/backups/manual", json=backup_payload)
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["detail"], "Invalid Google session.")
        set_cookie = res.headers.get("set-cookie", "")
        self.assertTrue("tt_google_session=;" in set_cookie or "Max-Age=0" in set_cookie)

    # 14. Expired Google Fernet Token TTL returns 401 and clears cookie
    def test_expired_google_cookie_ttl_returns_401_and_clears(self):
        valid_tok = self._make_valid_google_session_cookie()
        self.client.cookies.set("tt_google_session", valid_tok)

        # Fast forward time 31 days (past 30-day SESSION_COOKIE_MAX_AGE)
        future_time = time.time() + (31 * 24 * 60 * 60)
        with patch("time.time", return_value=future_time):
            backup_payload = self._make_canonical_backup_payload()
            res = self.client.post("/api/google/backups/manual", json=backup_payload)
            self.assertEqual(res.status_code, 401)
            self.assertEqual(res.json()["detail"], "Invalid Google session.")
            set_cookie = res.headers.get("set-cookie", "")
            self.assertTrue("tt_google_session=;" in set_cookie or "Max-Age=0" in set_cookie)

    # 15. Robust Google Logout clears cookie even if corrupted
    def test_robust_google_logout_with_tampered_cookie(self):
        self.client.cookies.set("tt_google_session", "corrupted_garbage")
        res = self.client.delete("/api/google/session")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"connected": False})
        set_cookie = res.headers.get("set-cookie", "")
        self.assertTrue("tt_google_session=;" in set_cookie or "Max-Age=0" in set_cookie)

    # 16. Manual POST Backup succeeds and preserves canonical schema v1 fields
    @patch("google_api.get_valid_access_token", new_callable=AsyncMock)
    @patch("google_api.get_google_http_client")
    def test_manual_backup_success_and_preserves_fields(self, mock_client_factory, mock_token):
        mock_token.return_value = "fake_access_token"
        mock_http_client = AsyncMock()

        upload_response = AsyncMock()
        upload_response.status_code = 200

        search_response = AsyncMock()
        search_response.status_code = 200
        search_response.json = MagicMock(return_value={"files": []})

        mock_http_client.post.return_value = upload_response
        mock_http_client.get.return_value = search_response
        mock_client_factory.return_value.__aenter__.return_value = mock_http_client

        payload = self._make_canonical_backup_payload()
        res = self.client.post("/api/google/backups/manual", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"success": True})

        # Verify uploaded content preserves displayTimeZone, achievementProgress, and full schema
        mock_http_client.post.assert_called_once()
        call_kwargs = mock_http_client.post.call_args[1]
        uploaded_form = call_kwargs["files"]
        uploaded_json_str = uploaded_form["file"][1]
        uploaded_data = json.loads(uploaded_json_str)

        self.assertEqual(uploaded_data["app"], "travelers-toolkit")
        self.assertEqual(uploaded_data["schemaVersion"], 1)
        self.assertEqual(uploaded_data["data"]["displayTimeZone"], "America/New_York")
        self.assertEqual(uploaded_data["data"]["achievementProgress"], {"80001": {"completed": True, "completedAt": None}})
        self.assertEqual(uploaded_data["data"]["roster"], {"Hu Tao": {"level": 90, "constellation": 1}})
        self.assertEqual(uploaded_data["data"]["trackedWeapons"], [{"id": "w1", "name": "Staff of Homa"}])
        self.assertEqual(uploaded_data["data"]["inventory"], {"m1": 100})
        self.assertEqual(uploaded_data["data"]["serverRegion"], "America")
        self.assertTrue(uploaded_data["data"]["showDbBuilder"])

    # 17. Auto PUT Backup succeeds and preserves canonical schema v1 fields
    @patch("google_api.get_valid_access_token", new_callable=AsyncMock)
    @patch("google_api.get_google_http_client")
    def test_auto_backup_success_and_preserves_fields(self, mock_client_factory, mock_token):
        mock_token.return_value = "fake_access_token"
        mock_http_client = AsyncMock()

        search_response = AsyncMock()
        search_response.status_code = 200
        search_response.json = MagicMock(return_value={"files": []})

        upload_response = AsyncMock()
        upload_response.status_code = 200

        mock_http_client.get.return_value = search_response
        mock_http_client.post.return_value = upload_response
        mock_client_factory.return_value.__aenter__.return_value = mock_http_client

        payload = self._make_canonical_backup_payload()
        res = self.client.put("/api/google/backups/auto", json=payload)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"success": True})

        # Verify uploaded content preserves displayTimeZone, achievementProgress, and full schema
        mock_http_client.post.assert_called_once()
        call_kwargs = mock_http_client.post.call_args[1]
        uploaded_form = call_kwargs["files"]
        uploaded_json_str = uploaded_form["file"][1]
        uploaded_data = json.loads(uploaded_json_str)

        self.assertEqual(uploaded_data["app"], "travelers-toolkit")
        self.assertEqual(uploaded_data["schemaVersion"], 1)
        self.assertEqual(uploaded_data["data"]["displayTimeZone"], "America/New_York")
        self.assertEqual(uploaded_data["data"]["achievementProgress"], {"80001": {"completed": True, "completedAt": None}})

    # 18. Truly unknown BackupData field rejected when extra='forbid'
    def test_unknown_backup_data_field_rejected(self):
        valid_tok = self._make_valid_google_session_cookie()
        self.client.cookies.set("tt_google_session", valid_tok)

        payload = self._make_canonical_backup_payload(forbiddenField="disallowed")
        res = self.client.post("/api/google/backups/manual", json=payload)
        self.assertEqual(res.status_code, 422)
        errors = res.json().get("detail", [])
        self.assertTrue(any("forbiddenField" in str(err.get("loc", [])) for err in errors))

    # 19. Truly unknown BackupEnvelope field rejected when extra='forbid'
    def test_unknown_backup_envelope_field_rejected(self):
        valid_tok = self._make_valid_google_session_cookie()
        self.client.cookies.set("tt_google_session", valid_tok)

        payload = self._make_canonical_backup_payload()
        payload["forbiddenEnvelopeField"] = "disallowed"
        res = self.client.post("/api/google/backups/manual", json=payload)
        self.assertEqual(res.status_code, 422)
        errors = res.json().get("detail", [])
        self.assertTrue(any("forbiddenEnvelopeField" in str(err.get("loc", [])) for err in errors))

    # 20. Model round-trip preserves all supported schema-v1 fields
    def test_model_round_trip_preserves_all_supported_fields(self):
        from google_api import BackupEnvelope
        payload = self._make_canonical_backup_payload()
        envelope = BackupEnvelope.model_validate(payload)
        dumped = json.loads(envelope.model_dump_json())

        self.assertEqual(dumped["app"], "travelers-toolkit")
        self.assertEqual(dumped["schemaVersion"], 1)
        self.assertEqual(dumped["data"]["roster"], {"Hu Tao": {"level": 90, "constellation": 1}})
        self.assertEqual(dumped["data"]["trackedWeapons"], [{"id": "w1", "name": "Staff of Homa"}])
        self.assertEqual(dumped["data"]["inventory"], {"m1": 100})
        self.assertEqual(dumped["data"]["serverRegion"], "America")
        self.assertTrue(dumped["data"]["showDbBuilder"])
        self.assertEqual(dumped["data"]["displayTimeZone"], "America/New_York")
        self.assertEqual(dumped["data"]["achievementProgress"], {"80001": {"completed": True, "completedAt": None}})

if __name__ == '__main__':
    unittest.main()
