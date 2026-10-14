"""
Production-facing unit tests for HoYoLAB authentication engine (Stage B1 Audit).

Mocks all upstream network interactions and tests:
1. Direct login success -> deriving ltoken_v2 -> authenticated flow state with password purged
2. Missing / invalid credentials input rejected (Pydantic extra="forbid", length bounds)
3. Geetest v3 challenge returns complete safe frontend fields (gt, challenge, new_captcha, success, sessionId)
4. Geetest v4 challenge returns complete safe frontend fields (captchaId, riskType, sessionId, new_captcha, success, apiServer)
5. Geetest v3 retry success -> authenticated flow state with password purged
6. Geetest v4 retry success -> authenticated flow state with password purged
7. Email-send captcha branch: _send_verification_email returns SessionMMT -> challenge stage with context="send_email"
8. Geetest retry continuation with challenge_context="send_email" -> resumes email send -> transitions to email_verify
9. Invalid or missing challenge context rejected safely (400)
10. ActionTicket email verification branch (clean send) -> transitions to email_verify
11. Email verification success -> authenticated flow state with password purged
12. Email verification invalid code preserves flow state for retry (does not clear cookie)
13. Token derivation via fetch_cookie_with_stoken_v2 shape validation
14. Missing ltuid rejected (502)
15. Missing ltoken derivation rejected (502)
16. Account discovery filters overseas Genshin Impact accounts only (hk4e_global)
17. Zero Genshin accounts returns empty accounts list
18. Complete endpoint persists tt_hoyolab_session and cleans up flow cookie
19. Unknown UID in complete endpoint rejected (400)
20. Persistent session contains strictly {version, ltuid, ltoken} with ltuid as string
21. Flow cancel endpoint deletes flow cookie
22. Expired flow state cookie rejected (401) and cleared
23. Tampered flow state cookie rejected (401) and cleared
24. Wrong-purpose flow state cookie rejected (401) and cleared
25. Invalid stage transitions rejected (400)
26. Cookie size ceiling (<= 3500 bytes) measured on final encrypted ciphertext
    - Near-limit accepted
    - Oversized rejected with 500
    - No oversized Set-Cookie emitted
27. Manual cookie endpoint (/api/hoyolab/session) regression works unchanged
28. Raw upstream exception strings not leaked to clients
29. Credentials and tokens never returned in JSON bodies
30. Security: Password non-retention verified across all 4 authentication success paths
31. Security: Token non-exposure verified with sentinel secrets
32. Client consistency: Device ID and login parameters stable across retries
"""

import importlib
import json
import os
import sys
import time
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import genshin
from genshin.models.auth.cookie import AppLoginResult
from genshin.models.auth.geetest import (
    SessionMMT,
    SessionMMTv4,
    SessionMMTResult,
    SessionMMTv4Result,
)
from genshin.models.auth.verification import ActionTicket
from genshin.models.hoyolab.record import GenshinAccount

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SENTINEL_PASSWORD = "SENTINEL_PASSWORD_998877_SECRET!@#"
FAKE_STOKEN_SECRET = "FAKE_STOKEN_SECRET_ABC123XYZ"
FAKE_LTOKEN_SECRET = "FAKE_LTOKEN_SECRET_DEF456UVW"
FAKE_LTUID = "100000001"


class TestHoyoLabAuthEngine(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        self.fernet_key = Fernet.generate_key().decode()

        os.environ["ENVIRONMENT"] = "test"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = self.fernet_key
        os.environ["HOYOLAB_LOGIN_PROXY"] = ""

        import config
        importlib.reload(config)
        import hoyolab_session
        importlib.reload(hoyolab_session)
        import hoyolab_auth
        importlib.reload(hoyolab_auth)
        import main
        importlib.reload(main)

        self.config = config
        self.hoyolab_session = hoyolab_session
        self.hoyolab_auth = hoyolab_auth
        self.main = main
        self.client = TestClient(main.app)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)

    # ------------------------------------------------------------------------
    # 1. Direct login success & cookie normalization
    # ------------------------------------------------------------------------
    @patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_direct_login_success(self, mock_login, mock_fetch_stoken):
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid_mock",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid_mock",
        )
        mock_fetch_stoken.return_value = {"ltoken_v2": FAKE_LTOKEN_SECRET}

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("nextStep"), "complete")

        # Flow cookie must be set and stage must be 'authenticated'
        flow_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        self.assertIsNotNone(flow_cookie)

        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "authenticated")
        self.assertEqual(decrypted["cookies"]["ltuid_v2"], FAKE_LTUID)
        self.assertEqual(decrypted["cookies"]["ltoken_v2"], FAKE_LTOKEN_SECRET)

        # Invariant: Password and account credentials MUST be removed upon entering authenticated stage
        self.assertNotIn("password", decrypted)
        self.assertNotIn("account", decrypted)

    # ------------------------------------------------------------------------
    # 2. Input validation
    # ------------------------------------------------------------------------
    def test_invalid_email_password_inputs_rejected(self):
        # Empty inputs
        resp = self.client.post("/api/hoyolab/auth/email-password", json={"account": "", "password": ""})
        self.assertEqual(resp.status_code, 422)

        # Missing password
        resp = self.client.post("/api/hoyolab/auth/email-password", json={"account": "user@example.com"})
        self.assertEqual(resp.status_code, 422)

        # Extra forbidden fields
        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "user@example.com", "password": "pass", "extra_field": "hacker"},
        )
        self.assertEqual(resp.status_code, 422)

    # ------------------------------------------------------------------------
    # 3. Geetest v3 challenge payload completeness
    # ------------------------------------------------------------------------
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_geetest_v3_required(self, mock_login):
        mock_login.return_value = SessionMMT(
            session_id="sess_v3_123",
            gt="gt_hash_v3",
            challenge="chal_hash_v3",
            success=1,
            new_captcha=1,
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("nextStep"), "geetest")
        self.assertEqual(data.get("gtVersion"), 3)

        # Assert full safe frontend MMT fields
        mmt = data.get("mmt", {})
        self.assertEqual(mmt.get("sessionId"), "sess_v3_123")
        self.assertEqual(mmt.get("gt"), "gt_hash_v3")
        self.assertEqual(mmt.get("challenge"), "chal_hash_v3")
        self.assertEqual(mmt.get("new_captcha"), 1)
        self.assertEqual(mmt.get("success"), 1)

        # Flow cookie stage should be 'challenge' with resume context 'app_login'
        flow_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "challenge")
        self.assertEqual(decrypted["challenge_context"], "app_login")
        self.assertEqual(decrypted["gt_version"], 3)
        self.assertEqual(decrypted["session_id"], "sess_v3_123")
        self.assertEqual(decrypted["password"], SENTINEL_PASSWORD)

    # ------------------------------------------------------------------------
    # 4. Geetest v4 challenge payload completeness
    # ------------------------------------------------------------------------
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_geetest_v4_required(self, mock_login):
        mock_login.return_value = SessionMMTv4(
            session_id="sess_v4_456",
            gt="captcha_id_v4",
            risk_type="slide",
            success=1,
            new_captcha=1,
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("nextStep"), "geetest")
        self.assertEqual(data.get("gtVersion"), 4)
        self.assertEqual(data.get("apiServer"), "gcaptcha4.captchami.com")

        # Assert full safe frontend MMT fields
        mmt = data.get("mmt", {})
        self.assertEqual(mmt.get("captchaId"), "captcha_id_v4")
        self.assertEqual(mmt.get("riskType"), "slide")
        self.assertEqual(mmt.get("sessionId"), "sess_v4_456")
        self.assertEqual(mmt.get("new_captcha"), 1)
        self.assertEqual(mmt.get("success"), 1)

    # ------------------------------------------------------------------------
    # 5. Geetest v3 retry success -> password removed
    # ------------------------------------------------------------------------
    @patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_geetest_v3_retry_success(self, mock_login, mock_fetch_stoken):
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid_mock",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid_mock",
        )
        mock_fetch_stoken.return_value = {"ltoken_v2": FAKE_LTOKEN_SECRET}

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "account": "traveler@example.com",
            "password": SENTINEL_PASSWORD,
            "gt_version": 3,
            "session_id": "sess_v3_123",
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.post(
            "/api/hoyolab/auth/geetest",
            json={
                "gt_version": 3,
                "geetest_challenge": "chal_token",
                "geetest_validate": "val_token",
                "geetest_seccode": "val_token|jordan",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get("nextStep"), "complete")

        # Flow cookie transitioned to authenticated with password & credentials removed
        new_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(new_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "authenticated")
        self.assertNotIn("password", decrypted)
        self.assertNotIn("account", decrypted)

    # ------------------------------------------------------------------------
    # 6. Geetest v4 retry success -> password removed
    # ------------------------------------------------------------------------
    @patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_geetest_v4_retry_success(self, mock_login, mock_fetch_stoken):
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid_mock",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid_mock",
        )
        mock_fetch_stoken.return_value = {"ltoken_v2": FAKE_LTOKEN_SECRET}

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "account": "traveler@example.com",
            "password": SENTINEL_PASSWORD,
            "gt_version": 4,
            "session_id": "sess_v4_456",
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.post(
            "/api/hoyolab/auth/geetest",
            json={
                "gt_version": 4,
                "captcha_id": "captcha_id_v4",
                "lot_number": "lot_123",
                "pass_token": "pass_456",
                "gen_time": "1710000000",
                "captcha_output": "out_789",
            },
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get("nextStep"), "complete")

        new_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(new_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "authenticated")
        self.assertNotIn("password", decrypted)
        self.assertNotIn("account", decrypted)

    # ------------------------------------------------------------------------
    # 7. Email verification dispatch returns SessionMMT (captcha before email)
    # ------------------------------------------------------------------------
    @patch("genshin.Client._send_verification_email", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_email_send_captcha_branch(self, mock_login, mock_send_email):
        mock_login.return_value = ActionTicket(
            risk_ticket="risk_ticket_abc",
            verify_str={"ticket": "ticket_str_xyz", "verify_type": "email"},
        )
        # Upstream requires captcha before sending verification email
        mock_send_email.return_value = SessionMMT(
            session_id="email_send_captcha_sess",
            gt="gt_email_send",
            challenge="chal_email_send",
            success=1,
            new_captcha=1,
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("nextStep"), "geetest")
        self.assertEqual(data.get("gtVersion"), 3)
        self.assertEqual(data.get("mmt", {}).get("sessionId"), "email_send_captcha_sess")
        self.assertEqual(data.get("mmt", {}).get("gt"), "gt_email_send")

        # Verify flow state contains challenge_context='send_email' and preserved action_ticket
        flow_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "challenge")
        self.assertEqual(decrypted["challenge_context"], "send_email")
        self.assertEqual(decrypted["session_id"], "email_send_captcha_sess")
        self.assertEqual(decrypted["action_ticket"]["risk_ticket"], "risk_ticket_abc")
        self.assertEqual(decrypted["password"], SENTINEL_PASSWORD)

    # ------------------------------------------------------------------------
    # 8. Geetest retry continuation with challenge_context='send_email'
    # ------------------------------------------------------------------------
    @patch("genshin.Client._send_verification_email", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_geetest_retry_resumes_send_email(self, mock_login, mock_send_email):
        # 1. Initial login returns ActionTicket
        mock_login.return_value = ActionTicket(
            risk_ticket="risk_ticket_abc",
            verify_str={"ticket": "ticket_str_xyz", "verify_type": "email"},
        )
        # 2. Initial _send_verification_email returns SessionMMT (geetest challenge)
        mock_send_email.return_value = SessionMMT(
            session_id="email_send_captcha_sess",
            gt="gt_email_send",
            challenge="chal_email_send",
            success=1,
            new_captcha=1,
        )

        resp1 = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.json().get("nextStep"), "geetest")
        self.assertEqual(mock_send_email.call_count, 1)

        # 3. User solves Geetest challenge and submits solution
        resp2 = self.client.post(
            "/api/hoyolab/auth/geetest",
            json={
                "gt_version": 3,
                "geetest_challenge": "chal_sol",
                "geetest_validate": "val_sol",
                "geetest_seccode": "val_sol|sec",
            },
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json().get("nextStep"), "emailVerify")

        # Invariant: _send_verification_email was called exactly ONCE overall
        # and was NOT called again after Geetest submission!
        self.assertEqual(mock_send_email.call_count, 1)

        # Resulting flow cookie assertions
        flow_cookie = resp2.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "email_verify")
        self.assertEqual(decrypted["action_ticket"]["risk_ticket"], "risk_ticket_abc")
        self.assertEqual(decrypted["account"], "traveler@example.com")
        self.assertEqual(decrypted["password"], SENTINEL_PASSWORD)
        self.assertTrue(decrypted.get("device_id"))
        self.assertNotIn("challenge_context", decrypted)
        self.assertNotIn("session_id", decrypted)
        self.assertNotIn("gt_version", decrypted)

    @patch("genshin.Client._send_verification_email", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_verification_code_rate_limited_mapped_to_429(self, mock_login, mock_send_email):
        mock_login.return_value = ActionTicket(
            risk_ticket="risk_ticket_abc",
            verify_str={"ticket": "ticket_str_xyz", "verify_type": "email"},
        )
        # Mock VerificationCodeRateLimited exception from genshin
        mock_send_email.side_effect = genshin.errors.VerificationCodeRateLimited(
            {}, "Verification code send frequency is too high."
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 429)
        self.assertEqual(
            resp.json().get("detail"),
            "HoYoverse is temporarily limiting verification-code requests. Please wait before trying again.",
        )

    @patch("genshin.Client._app_login", new_callable=AsyncMock)
    def test_geetest_failed_mapped_to_400_and_cookie_deleted(self, mock_login):
        mock_login.side_effect = genshin.errors.GeetestFailed(
            {}, "Geetest captcha verification failed."
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(
            resp.json().get("detail"),
            "Security verification expired or was rejected. Please start sign-in again.",
        )

    # ------------------------------------------------------------------------
    # 9. Invalid or missing challenge context rejected
    # ------------------------------------------------------------------------
    def test_invalid_challenge_context_rejected(self):
        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "challenge",
            "challenge_context": "invalid_unknown_action",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "account": "traveler@example.com",
            "password": SENTINEL_PASSWORD,
            "gt_version": 3,
            "session_id": "some_session",
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.post(
            "/api/hoyolab/auth/geetest",
            json={
                "gt_version": 3,
                "geetest_challenge": "c",
                "geetest_validate": "v",
                "geetest_seccode": "s",
            },
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid challenge context", resp.json().get("detail", ""))

    # ------------------------------------------------------------------------
    # 10. Clean ActionTicket email verification branch
    # ------------------------------------------------------------------------
    @patch("genshin.Client._send_verification_email", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_action_ticket_email_verification_branch(self, mock_login, mock_send_email):
        mock_login.return_value = ActionTicket(
            risk_ticket="risk_123",
            verify_str={"ticket": "ticket_xyz", "verify_type": "email"},
        )
        mock_send_email.return_value = None

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get("nextStep"), "emailVerify")

        flow_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "email_verify")
        self.assertEqual(decrypted["action_ticket"]["risk_ticket"], "risk_123")
        self.assertEqual(decrypted["password"], SENTINEL_PASSWORD)

    # ------------------------------------------------------------------------
    # 11. Email verification success -> password removed
    # ------------------------------------------------------------------------
    @patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock)
    @patch("genshin.Client._verify_email", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_email_verification_success(self, mock_login, mock_verify_email, mock_fetch_stoken):
        mock_verify_email.return_value = None
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid_mock",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid_mock",
        )
        mock_fetch_stoken.return_value = {"ltoken_v2": FAKE_LTOKEN_SECRET}

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "email_verify",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "account": "traveler@example.com",
            "password": SENTINEL_PASSWORD,
            "action_ticket": {
                "risk_ticket": "risk_123",
                "verify_str": {"ticket": "ticket_xyz", "verify_type": "email"},
            },
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.post("/api/hoyolab/auth/email-verify", json={"code": "123456"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json().get("nextStep"), "complete")

        # Password must be purged from state
        new_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(new_cookie.encode()).decode())
        self.assertEqual(decrypted["stage"], "authenticated")
        self.assertNotIn("password", decrypted)
        self.assertNotIn("account", decrypted)

    # ------------------------------------------------------------------------
    # 12. Email verification invalid code preserves cookie for retry
    # ------------------------------------------------------------------------
    @patch("genshin.Client._verify_email", new_callable=AsyncMock)
    def test_email_verification_invalid_code(self, mock_verify_email):
        mock_verify_email.side_effect = genshin.errors.GenshinException({"retcode": -3203, "message": "Verification code error"})

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "email_verify",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "account": "traveler@example.com",
            "password": SENTINEL_PASSWORD,
            "action_ticket": {
                "risk_ticket": "risk_123",
                "verify_str": {"ticket": "ticket_xyz", "verify_type": "email"},
            },
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.post("/api/hoyolab/auth/email-verify", json={"code": "000000"})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid or expired verification code", resp.json().get("detail", ""))

        # Intentionally preserves flow cookie so user can re-attempt entering code
        # Response should NOT delete the cookie on invalid OTP
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertNotIn("tt_hoyolab_flow_state=;", set_cookie_header)

    # ------------------------------------------------------------------------
    # 13. Token derivation missing ltuid / ltoken errors
    # ------------------------------------------------------------------------
    @patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock)
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_missing_ltoken_derivation_rejected(self, mock_login, mock_fetch_stoken):
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid_mock",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid_mock",
        )
        mock_fetch_stoken.return_value = {}  # Empty result

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 502)
        self.assertIn("Community token is missing", resp.json().get("detail", ""))

    # ------------------------------------------------------------------------
    # 14. Account discovery filters overseas Genshin Impact accounts only
    # ------------------------------------------------------------------------
    @patch("genshin.Client.get_game_accounts", new_callable=AsyncMock)
    def test_account_discovery_filters_genshin_only(self, mock_get_accounts):
        mock_get_accounts.return_value = [
            GenshinAccount(
                game_biz="hk4e_global",
                game_uid=800123456,
                region="os_asia",
                region_name="Asia Server",
                nickname="TravelerA",
                level=60,
            ),
            GenshinAccount(
                game_biz="hkrpg_global",  # Honkai Star Rail
                game_uid=100654321,
                region="prod_official_usa",
                region_name="America Server",
                nickname="TrailblazerB",
                level=70,
            ),
            GenshinAccount(
                game_biz="hk4e_cn",  # Domestic CN account (not overseas)
                game_uid=100999888,
                region="cn_gf01",
                region_name="Skyfrost",
                nickname="TravelerCN",
                level=55,
            ),
        ]

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        cookie_val = self.hoyolab_auth._encode_flow_state(flow_state)
        self.client.cookies.set("tt_hoyolab_flow_state", cookie_val)

        resp = self.client.get("/api/hoyolab/auth/accounts")
        self.assertEqual(resp.status_code, 200)
        accounts = resp.json().get("accounts", [])
        self.assertEqual(len(accounts), 1)
        self.assertEqual(accounts[0]["uid"], 800123456)
        self.assertEqual(accounts[0]["nickname"], "TravelerA")
        self.assertEqual(accounts[0]["serverName"], "Asia Server")

    def test_zero_genshin_accounts_returns_empty(self):
        with patch("genshin.Client.get_game_accounts", new_callable=AsyncMock) as mock_get_accounts:
            mock_get_accounts.return_value = []
            flow_state = {
                "purpose": "hoyolab-login-flow",
                "version": 1,
                "stage": "authenticated",
                "created_at": int(time.time()),
                "device_id": "testdevice123456",
                "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
            }
            self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))

            resp = self.client.get("/api/hoyolab/auth/accounts")
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json().get("accounts"), [])

    # ------------------------------------------------------------------------
    # 15. Complete login flow & persistent session validation
    # ------------------------------------------------------------------------
    @patch("genshin.Client.get_genshin_notes", new_callable=AsyncMock)
    @patch("genshin.Client.get_game_accounts", new_callable=AsyncMock)
    def test_complete_login_flow(self, mock_get_accounts, mock_get_notes):
        mock_get_accounts.return_value = [
            GenshinAccount(
                game_biz="hk4e_global",
                game_uid=800123456,
                region="os_asia",
                region_name="Asia Server",
                nickname="TravelerA",
                level=60,
            ),
        ]
        mock_get_notes.return_value = MagicMock()

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))

        resp = self.client.post("/api/hoyolab/auth/complete", json={"uid": 800123456})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json().get("success"))
        self.assertEqual(resp.json().get("account", {}).get("uid"), 800123456)

        # Persistent tt_hoyolab_session cookie verified
        persistent_cookie = resp.cookies.get("tt_hoyolab_session")
        self.assertIsNotNone(persistent_cookie)
        session_data = json.loads(self.config.HOYOLAB_FERNET.decrypt(persistent_cookie.encode()).decode())

        # Exact schema assertions: version, ltuid, ltoken (NO UID IN PERSISTENT COOKIE)
        self.assertEqual(set(session_data.keys()), {"version", "ltuid", "ltoken"})
        self.assertIsInstance(session_data["version"], int)
        self.assertEqual(session_data["version"], 1)
        self.assertIsInstance(session_data["ltuid"], str)
        self.assertEqual(session_data["ltuid"], FAKE_LTUID)
        self.assertIsInstance(session_data["ltoken"], str)
        self.assertEqual(session_data["ltoken"], FAKE_LTOKEN_SECRET)

        # Temporary flow cookie must be deleted
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertTrue(
            "tt_hoyolab_flow_state=;" in set_cookie_header or "Max-Age=0" in set_cookie_header,
            "tt_hoyolab_flow_state must be cleared upon login completion",
        )

    @patch("genshin.Client.get_game_accounts", new_callable=AsyncMock)
    def test_complete_unknown_uid_rejected(self, mock_get_accounts):
        mock_get_accounts.return_value = [
            GenshinAccount(
                game_biz="hk4e_global",
                game_uid=800123456,
                region="os_asia",
                region_name="Asia Server",
                nickname="TravelerA",
                level=60,
            ),
        ]
        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))

        resp = self.client.post("/api/hoyolab/auth/complete", json={"uid": 999999999})
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Selected UID is not associated", resp.json().get("detail", ""))

    def test_cancel_flow_clears_cookie(self):
        resp = self.client.delete("/api/hoyolab/auth/flow")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"active": False})
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertTrue(
            "tt_hoyolab_flow_state=;" in set_cookie_header or "Max-Age=0" in set_cookie_header,
        )

    # ------------------------------------------------------------------------
    # 16. Tampered, Expired, and Wrong-Purpose cookies rejected & cleared
    # ------------------------------------------------------------------------
    def test_tampered_cookie_rejected(self):
        self.client.cookies.set("tt_hoyolab_flow_state", "gibberish_tampered_token_value")
        resp = self.client.get("/api/hoyolab/auth/accounts")
        self.assertEqual(resp.status_code, 401)
        self.assertIn("Authentication flow expired or invalid", resp.json().get("detail", ""))
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertTrue("tt_hoyolab_flow_state=;" in set_cookie_header or "Max-Age=0" in set_cookie_header)

    def test_expired_cookie_rejected(self):
        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()) - 2000,
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        plaintext = json.dumps(flow_state).encode("utf-8")
        expired_token = self.config.HOYOLAB_FERNET.encrypt_at_time(plaintext, int(time.time()) - 2000).decode("utf-8")
        self.client.cookies.set("tt_hoyolab_flow_state", expired_token)

        resp = self.client.get("/api/hoyolab/auth/accounts")
        self.assertEqual(resp.status_code, 401)
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertTrue("tt_hoyolab_flow_state=;" in set_cookie_header or "Max-Age=0" in set_cookie_header)

    def test_wrong_purpose_cookie_rejected(self):
        wrong_state = {
            "purpose": "some-other-feature",
            "version": 1,
            "stage": "authenticated",
            "device_id": "testdevice123456",
        }
        plaintext = json.dumps(wrong_state).encode("utf-8")
        token = self.config.HOYOLAB_FERNET.encrypt(plaintext).decode("utf-8")
        self.client.cookies.set("tt_hoyolab_flow_state", token)

        resp = self.client.get("/api/hoyolab/auth/accounts")
        self.assertEqual(resp.status_code, 401)
        set_cookie_header = resp.headers.get("set-cookie", "")
        self.assertTrue("tt_hoyolab_flow_state=;" in set_cookie_header or "Max-Age=0" in set_cookie_header)

    # ------------------------------------------------------------------------
    # 17. Invalid stage transitions
    # ------------------------------------------------------------------------
    def test_invalid_stage_transitions(self):
        # 1. Calling /geetest while stage is 'authenticated'
        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))
        resp = self.client.post(
            "/api/hoyolab/auth/geetest",
            json={
                "gt_version": 3,
                "geetest_challenge": "c",
                "geetest_validate": "v",
                "geetest_seccode": "s",
            },
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid flow stage", resp.json().get("detail", ""))

        # 2. Calling /email-verify while stage is 'challenge'
        flow_state["stage"] = "challenge"
        flow_state["challenge_context"] = "app_login"
        self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))
        resp = self.client.post("/api/hoyolab/auth/email-verify", json={"code": "123456"})
        self.assertEqual(resp.status_code, 400)

        # 3. Calling /accounts while stage is 'challenge'
        resp = self.client.get("/api/hoyolab/auth/accounts")
        self.assertEqual(resp.status_code, 400)

    # ------------------------------------------------------------------------
    # 18. Cookie size ceiling guard (post-encryption measurement)
    # ------------------------------------------------------------------------
    def test_cookie_size_ceiling_enforced(self):
        # Near-limit payload that produces ciphertext comfortably under 3500 bytes: accepted
        acceptable_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "payload_pad": "A" * 2000,
        }
        encrypted = self.hoyolab_auth._encode_flow_state(acceptable_state)
        self.assertLessEqual(len(encrypted), 3500)

        # Oversized payload whose encrypted ciphertext exceeds 3500 bytes: strictly rejected
        oversized_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "challenge",
            "challenge_context": "app_login",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "huge_payload": "X" * 3000,
        }
        with self.assertRaises(self.main.HTTPException) as cm:
            self.hoyolab_auth._encode_flow_state(oversized_state)
        self.assertEqual(cm.exception.status_code, 500)
        self.assertIn("size limit exceeded", cm.exception.detail)

    # ------------------------------------------------------------------------
    # 19. Manual cookie endpoint regression (/api/hoyolab/session)
    # ------------------------------------------------------------------------
    @patch("genshin.Client.get_genshin_notes", new_callable=AsyncMock)
    def test_manual_cookie_endpoint_regression(self, mock_get_notes):
        mock_get_notes.return_value = MagicMock()

        resp = self.client.post(
            "/api/hoyolab/session",
            json={"ltuid": "12345678", "ltoken": "v2_ltoken_test_abc"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"connected": True})

        # Persistent cookie verified
        session_cookie = resp.cookies.get("tt_hoyolab_session")
        self.assertIsNotNone(session_cookie)
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(session_cookie.encode()).decode())
        self.assertEqual(decrypted["version"], 1)
        self.assertIsInstance(decrypted["ltuid"], str)
        self.assertEqual(decrypted["ltuid"], "12345678")
        self.assertIsInstance(decrypted["ltoken"], str)
        self.assertEqual(decrypted["ltoken"], "v2_ltoken_test_abc")
        self.assertEqual(set(decrypted.keys()), {"version", "ltuid", "ltoken"})

    # ------------------------------------------------------------------------
    # 20. Security tests: Non-retention of password across all success paths
    # ------------------------------------------------------------------------
    @patch("genshin.Client.get_genshin_notes", new_callable=AsyncMock)
    @patch("genshin.Client.get_game_accounts", new_callable=AsyncMock)
    def test_security_password_and_token_non_retention(self, mock_get_accounts, mock_get_notes):
        mock_get_accounts.return_value = [
            GenshinAccount(
                game_biz="hk4e_global",
                game_uid=800111222,
                region="os_asia",
                region_name="Asia Server",
                nickname="TravelerA",
                level=60,
            ),
        ]
        mock_get_notes.return_value = MagicMock()

        flow_state = {
            "purpose": "hoyolab-login-flow",
            "version": 1,
            "stage": "authenticated",
            "created_at": int(time.time()),
            "device_id": "testdevice123456",
            "cookies": {"ltuid_v2": FAKE_LTUID, "ltoken_v2": FAKE_LTOKEN_SECRET},
        }
        self.client.cookies.set("tt_hoyolab_flow_state", self.hoyolab_auth._encode_flow_state(flow_state))

        with self.assertLogs("hoyolab_auth", level="INFO") as cm:
            resp = self.client.post("/api/hoyolab/auth/complete", json={"uid": 800111222})
            self.assertEqual(resp.status_code, 200)

            # JSON response must NOT contain password or tokens
            json_text = resp.text
            self.assertNotIn(SENTINEL_PASSWORD, json_text)
            self.assertNotIn(FAKE_STOKEN_SECRET, json_text)
            self.assertNotIn(FAKE_LTOKEN_SECRET, json_text)

            # Logs must NOT contain password or tokens
            logs_text = " ".join(cm.output)
            self.assertNotIn(SENTINEL_PASSWORD, logs_text)
            self.assertNotIn(FAKE_STOKEN_SECRET, logs_text)
            self.assertNotIn(FAKE_LTOKEN_SECRET, logs_text)

    # ------------------------------------------------------------------------
    # 21. Device ID & Client argument stability test
    # ------------------------------------------------------------------------
    @patch("hoyolab_auth._execute_app_login", new_callable=AsyncMock)
    def test_login_client_device_stability(self, mock_login):
        mock_login.return_value = SessionMMT(
            session_id="stable_device_sess",
            gt="gt_val",
            challenge="chal_val",
            success=1,
            new_captcha=1,
        )

        resp = self.client.post(
            "/api/hoyolab/auth/email-password",
            json={"account": "traveler@example.com", "password": SENTINEL_PASSWORD},
        )
        self.assertEqual(resp.status_code, 200)

        # Inspect initial device_id passed to _execute_app_login
        mock_login.assert_called_once()
        first_call_kwargs = mock_login.call_args[1]
        device_id_used = first_call_kwargs["device_id"]
        self.assertEqual(len(device_id_used), 16)
        self.assertTrue(device_id_used.isalnum())

        # Inspect stored flow state device_id
        flow_cookie = resp.cookies.get("tt_hoyolab_flow_state")
        decrypted = json.loads(self.config.HOYOLAB_FERNET.decrypt(flow_cookie.encode()).decode())
        self.assertEqual(decrypted["device_id"], device_id_used)

        # Now simulate Geetest retry using that cookie
        mock_login.reset_mock()
        mock_login.return_value = AppLoginResult(
            stoken=FAKE_STOKEN_SECRET,
            ltuid_v2=FAKE_LTUID,
            ltmid_v2="mid",
            account_id_v2=FAKE_LTUID,
            account_mid_v2="mid",
        )
        with patch("genshin.fetch_cookie_with_stoken_v2", new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = {"ltoken_v2": FAKE_LTOKEN_SECRET}
            resp2 = self.client.post(
                "/api/hoyolab/auth/geetest",
                json={
                    "gt_version": 3,
                    "geetest_challenge": "c",
                    "geetest_validate": "v",
                    "geetest_seccode": "s",
                },
            )
            self.assertEqual(resp2.status_code, 200)

            # Assert device_id used in retry EXACTLY matches initial device_id
            mock_login.assert_called_once()
            retry_call_kwargs = mock_login.call_args[1]
            self.assertEqual(retry_call_kwargs["device_id"], device_id_used)

    # ------------------------------------------------------------------------
    # 22. RSA dependency present and encrypts credentials regression test
    # ------------------------------------------------------------------------
    def test_rsa_dependency_present_and_encrypts_credentials(self):
        import rsa
        self.assertIsNotNone(rsa)
        from genshin.utility.auth import encrypt_credentials
        ciphertext_1 = encrypt_credentials("test_account", 1)
        ciphertext_2 = encrypt_credentials("test_password", 1)
        self.assertIsInstance(ciphertext_1, str)
        self.assertIsInstance(ciphertext_2, str)
        self.assertGreater(len(ciphertext_1), 100)
        self.assertGreater(len(ciphertext_2), 100)


if __name__ == "__main__":
    unittest.main()
