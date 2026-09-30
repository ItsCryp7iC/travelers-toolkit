"""
Tests for Phase B: HoYoLAB Achievement Proof of Concept.

Tests cover:
- Normalization logic (pure, no mocks needed)
- Endpoint behavior with mocked genshin.Client
- Auth/privacy/error handling
- Cookie invalidation rules (DataNotPublic must NOT clear cookie)
- Diagnostic behavior in development mode
"""

import unittest
import os
import sys
import importlib
import json
from unittest.mock import AsyncMock, patch, MagicMock

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cryptography.fernet import Fernet


def _fresh_import():
    """Get fresh references to hoyolab_achievements to avoid stale class identity
    issues caused by importlib.reload in integration tests."""
    import hoyolab_achievements
    importlib.reload(hoyolab_achievements)
    return hoyolab_achievements



class TestNormalizeCategory(unittest.TestCase):
    """Tests for individual category normalization."""

    def setUp(self):
        mod = _fresh_import()
        self.normalize_category = mod.normalize_category
        self.AchievementNormalizationError = mod.AchievementNormalizationError

    def _make_category(self, **overrides):
        base = {
            "id": 1,
            "name": "Wonders of the World",
            "icon": "https://example.com/icon.png",
            "finish_num": 812,
            "percentage": 0,
            "show_percent": False,
        }
        base.update(overrides)
        return base

    def test_basic_normalization(self):
        result = self.normalize_category(self._make_category())
        self.assertEqual(result["hoyolabId"], "1")
        self.assertEqual(result["name"], "Wonders of the World")
        self.assertEqual(result["icon"], "https://example.com/icon.png")
        self.assertEqual(result["completed"], 812)
        self.assertIsNone(result["percentage"])

    def test_id_numeric_becomes_string(self):
        result = self.normalize_category(self._make_category(id=42))
        self.assertEqual(result["hoyolabId"], "42")

    def test_id_zero_is_valid(self):
        cat = {
            "id": 0,
            "name": "Wonders of the World",
            "icon": "https://example.test/icon.png",
            "finish_num": 944,
            "percentage": 0,
            "show_percent": False
        }
        result = self.normalize_category(cat)
        self.assertEqual(result["hoyolabId"], "0")
        self.assertEqual(result["name"], "Wonders of the World")
        self.assertEqual(result["icon"], "https://example.test/icon.png")
        self.assertEqual(result["completed"], 944)
        self.assertIsNone(result["percentage"])

    def test_id_already_string(self):
        result = self.normalize_category(self._make_category(id="99"))
        self.assertEqual(result["hoyolabId"], "99")

    def test_show_percent_true_preserves_percentage(self):
        result = self.normalize_category(self._make_category(
            show_percent=True, percentage=81.4
        ))
        self.assertEqual(result["percentage"], 81.4)

    def test_show_percent_false_nullifies_percentage(self):
        result = self.normalize_category(self._make_category(
            show_percent=False, percentage=50
        ))
        self.assertIsNone(result["percentage"])

    def test_show_percent_missing_nullifies_percentage(self):
        cat = self._make_category()
        del cat["show_percent"]
        result = self.normalize_category(cat)
        self.assertIsNone(result["percentage"])

    def test_missing_icon_becomes_null(self):
        result = self.normalize_category(self._make_category(icon=""))
        self.assertIsNone(result["icon"])

    def test_absent_icon_becomes_null(self):
        cat = self._make_category()
        del cat["icon"]
        result = self.normalize_category(cat)
        self.assertIsNone(result["icon"])

    def test_missing_id_raises(self):
        cat = self._make_category()
        del cat["id"]
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_category(cat)

    def test_missing_name_raises(self):
        cat = self._make_category()
        del cat["name"]
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_category(cat)

    def test_blank_name_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_category(self._make_category(name="   "))

    def test_invalid_finish_num_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_category(self._make_category(finish_num="not_a_number"))

    def test_non_dict_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_category("not a dict")

    def test_name_stripped(self):
        result = self.normalize_category(self._make_category(name="  Padded Name  "))
        self.assertEqual(result["name"], "Padded Name")

    def test_show_percent_true_but_percentage_non_numeric(self):
        result = self.normalize_category(self._make_category(
            show_percent=True, percentage="invalid"
        ))
        self.assertIsNone(result["percentage"])

    def test_show_percent_true_percentage_zero(self):
        result = self.normalize_category(self._make_category(
            show_percent=True, percentage=0
        ))
        self.assertEqual(result["percentage"], 0)


class TestNormalizeAchievementResponse(unittest.TestCase):
    """Tests for full response normalization."""

    def setUp(self):
        mod = _fresh_import()
        self.normalize_achievement_response = mod.normalize_achievement_response
        self.AchievementNormalizationError = mod.AchievementNormalizationError

    def _make_response(self, **overrides):
        base = {
            "achievement_num": 1430,
            "list": [
                {
                    "id": 1,
                    "name": "Wonders of the World",
                    "icon": "https://example.com/icon.png",
                    "finish_num": 812,
                    "percentage": 0,
                    "show_percent": False,
                }
            ]
        }
        base.update(overrides)
        return base

    def test_success_normalization(self):
        result = self.normalize_achievement_response(self._make_response())
        self.assertTrue(result["connected"])
        self.assertEqual(result["totalCompleted"], 1430)
        self.assertEqual(len(result["categories"]), 1)
        self.assertEqual(result["categories"][0]["hoyolabId"], "1")
        self.assertEqual(result["categories"][0]["completed"], 812)

    def test_empty_category_list(self):
        result = self.normalize_achievement_response(self._make_response(**{"list": []}))
        self.assertTrue(result["connected"])
        self.assertEqual(result["totalCompleted"], 1430)
        self.assertEqual(result["categories"], [])

    def test_multiple_categories(self):
        raw = self._make_response()
        raw["list"].append({
            "id": 2,
            "name": "Mortal Travails",
            "icon": "https://example.com/icon2.png",
            "finish_num": 6,
            "percentage": 100,
            "show_percent": True,
        })
        result = self.normalize_achievement_response(raw)
        self.assertEqual(len(result["categories"]), 2)
        self.assertEqual(result["categories"][1]["percentage"], 100)

    def test_non_dict_response_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response("not a dict")

    def test_missing_achievement_num_raises(self):
        raw = self._make_response()
        del raw["achievement_num"]
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response(raw)

    def test_invalid_achievement_num_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response(self._make_response(achievement_num="bad"))

    def test_missing_list_raises(self):
        raw = self._make_response()
        del raw["list"]
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response(raw)

    def test_list_not_array_raises(self):
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response(self._make_response(**{"list": "not_list"}))

    def test_malformed_category_in_list_raises(self):
        raw = self._make_response()
        raw["list"].append("bad_entry")
        with self.assertRaises(self.AchievementNormalizationError):
            self.normalize_achievement_response(raw)


class TestBuildDiagnostic(unittest.TestCase):
    """Tests for development diagnostic builder."""

    def setUp(self):
        mod = _fresh_import()
        self.build_diagnostic = mod.build_diagnostic

    def test_basic_diagnostic(self):
        raw = {
            "achievement_num": 1430,
            "list": [
                {
                    "id": 1,
                    "name": "Test",
                    "icon": "url",
                    "finish_num": 10,
                    "percentage": 0,
                    "show_percent": False,
                }
            ]
        }
        diag = self.build_diagnostic(raw)
        self.assertIn("rawDataKeys", diag)
        self.assertIn("categoryCount", diag)
        self.assertIn("sampleCategoryKeys", diag)
        self.assertEqual(diag["categoryCount"], 1)
        self.assertIn("finish_num", diag["sampleCategoryKeys"])

    def test_non_dict_returns_none(self):
        self.assertIsNone(self.build_diagnostic("not a dict"))

    def test_empty_list(self):
        diag = self.build_diagnostic({"achievement_num": 0, "list": []})
        self.assertEqual(diag["categoryCount"], 0)
        self.assertEqual(diag["sampleCategoryKeys"], [])

    def test_missing_list(self):
        diag = self.build_diagnostic({"achievement_num": 0})
        self.assertEqual(diag["categoryCount"], 0)


# --- Endpoint integration tests ---

class TestAchievementEndpoint(unittest.TestCase):
    """Tests for POST /api/hoyolab/achievements endpoint."""

    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        self.fernet_key = Fernet.generate_key().decode()
        os.environ["HOYOLAB_SESSION_KEY"] = self.fernet_key
        os.environ["GOOGLE_CLIENT_ID"] = "test"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test"
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/api/google/auth/callback"
        os.environ["GOOGLE_SESSION_KEY"] = Fernet.generate_key().decode()

        import config
        importlib.reload(config)
        import google_api
        importlib.reload(google_api)
        import hoyolab_achievements
        importlib.reload(hoyolab_achievements)
        import main
        importlib.reload(main)

        from fastapi.testclient import TestClient
        self.client = TestClient(main.app)
        self.fernet = Fernet(self.fernet_key.encode())

    def tearDown(self):
        import config
        config.GOOGLE_FERNET = getattr(self, 'original_fernet', None)
        os.environ.clear()
        os.environ.update(self.original_env)

    def _set_valid_session(self):
        session_data = {"version": 1, "ltuid": "12345", "ltoken": "test_token"}
        encrypted = self.fernet.encrypt(json.dumps(session_data).encode()).decode()
        self.client.cookies.set("tt_hoyolab_session", encrypted)

    def _make_raw_response(self):
        return {
            "achievement_num": 1430,
            "list": [
                {
                    "id": 1,
                    "name": "Wonders of the World",
                    "icon": "https://example.com/icon.png",
                    "finish_num": 812,
                    "percentage": 0,
                    "show_percent": False,
                },
                {
                    "id": 2,
                    "name": "Mortal Travails: Series I",
                    "icon": "https://example.com/icon2.png",
                    "finish_num": 6,
                    "percentage": 100,
                    "show_percent": True,
                },
            ]
        }

    # A. No session cookie → 401
    def test_no_session_returns_401(self):
        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 401)
        self.assertIn("No HoYoLAB session found", response.json()["detail"])

    # B. Corrupt encrypted session → 401 + cookie cleared
    def test_corrupt_session_returns_401(self):
        self.client.cookies.set("tt_hoyolab_session", "totally_invalid_fernet")
        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 401)

        set_cookie = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie)
        self.assertTrue(
            "tt_hoyolab_session=;" in set_cookie
            or 'tt_hoyolab_session=""' in set_cookie
        )

    # C. Normalization success
    @patch("main.genshin.Client")
    def test_success_normalization(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["connected"])
        self.assertEqual(body["totalCompleted"], 1430)
        self.assertEqual(len(body["categories"]), 2)
        self.assertEqual(body["categories"][0]["hoyolabId"], "1")
        self.assertEqual(body["categories"][0]["completed"], 812)
        self.assertEqual(body["categories"][0]["name"], "Wonders of the World")

    # D. show_percent true preserves percentage
    @patch("main.genshin.Client")
    def test_show_percent_true(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        body = response.json()
        # Category 2 has show_percent=True, percentage=100
        self.assertEqual(body["categories"][1]["percentage"], 100)

    # E. show_percent false → percentage null
    @patch("main.genshin.Client")
    def test_show_percent_false(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        body = response.json()
        # Category 1 has show_percent=False
        self.assertIsNone(body["categories"][0]["percentage"])

    # F. Missing icon → null
    @patch("main.genshin.Client")
    def test_missing_icon_becomes_null(self, MockClient):
        self._set_valid_session()
        raw = self._make_raw_response()
        raw["list"][0]["icon"] = ""
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(return_value=raw)
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        body = response.json()
        self.assertIsNone(body["categories"][0]["icon"])

    # G. Category id numeric → returned as string
    @patch("main.genshin.Client")
    def test_category_id_as_string(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        body = response.json()
        for cat in body["categories"]:
            self.assertIsInstance(cat["hoyolabId"], str)

    # H. Empty category list → valid response
    @patch("main.genshin.Client")
    def test_empty_categories(self, MockClient):
        self._set_valid_session()
        raw = {"achievement_num": 0, "list": []}
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(return_value=raw)
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["categories"], [])
        self.assertEqual(body["totalCompleted"], 0)

    # I. Malformed/absent data → safe error
    @patch("main.genshin.Client")
    def test_malformed_data_returns_502(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value={"unexpected": "shape"}
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 502)
        self.assertIn("could not be processed", response.json()["detail"])

    # J. InvalidCookies upstream → 401 + cookie cleared
    @patch("main.genshin.Client")
    def test_invalid_cookies_clears_session(self, MockClient):
        self._set_valid_session()
        import genshin
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            side_effect=genshin.errors.InvalidCookies({}, msg="expired")
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 401)

        set_cookie = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie)
        self.assertTrue(
            "tt_hoyolab_session=;" in set_cookie
            or 'tt_hoyolab_session=""' in set_cookie
        )

    # K. DataNotPublic → 403, does NOT clear auth cookie
    @patch("main.genshin.Client")
    def test_data_not_public_does_not_clear_cookie(self, MockClient):
        self._set_valid_session()
        import genshin
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            side_effect=genshin.errors.DataNotPublic({}, msg="not public")
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 403)
        self.assertIn("Battle Chronicle", response.json()["detail"])

        # Cookie must NOT be cleared
        set_cookie = response.headers.get("set-cookie", "")
        self.assertFalse(
            "tt_hoyolab_session=;" in set_cookie
            or "Max-Age=0" in set_cookie,
            "DataNotPublic must NOT clear the session cookie"
        )

    # TooManyRequests → 429, does NOT clear cookie
    @patch("main.genshin.Client")
    def test_rate_limit_does_not_clear_cookie(self, MockClient):
        self._set_valid_session()
        import genshin
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            side_effect=genshin.errors.TooManyRequests({}, msg="ratelimit")
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 429)
        self.assertIn("rate limiting", response.json()["detail"])

        set_cookie = response.headers.get("set-cookie", "")
        self.assertFalse(
            "tt_hoyolab_session=;" in set_cookie
            or "Max-Age=0" in set_cookie,
            "TooManyRequests must NOT clear the session cookie"
        )

    # AccountNotFound → 404
    @patch("main.genshin.Client")
    def test_account_not_found(self, MockClient):
        self._set_valid_session()
        import genshin
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            side_effect=genshin.errors.AccountNotFound({}, msg="no account")
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 404)

    # Development diagnostic included
    @patch("main.genshin.Client")
    def test_diagnostic_included_in_development(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        response = self.client.post("/api/hoyolab/achievements", json={})
        body = response.json()
        self.assertIn("diagnostic", body)
        self.assertIn("rawDataKeys", body["diagnostic"])
        self.assertIn("categoryCount", body["diagnostic"])

    # Production diagnostic excluded
    @patch("main.genshin.Client")
    def test_diagnostic_excluded_in_production(self, MockClient):
        self._set_valid_session()
        mock_instance = MagicMock()
        mock_instance._request_genshin_record = AsyncMock(
            return_value=self._make_raw_response()
        )
        MockClient.return_value = mock_instance

        import main
        original_is_prod = main.IS_PRODUCTION
        main.IS_PRODUCTION = True
        try:
            response = self.client.post("/api/hoyolab/achievements", json={})
            body = response.json()
            self.assertNotIn("diagnostic", body)
        finally:
            main.IS_PRODUCTION = original_is_prod

    # Session with missing credentials → 401 + cookie cleared
    def test_session_missing_credentials_returns_401(self):
        session_data = {"version": 1, "ltuid": "", "ltoken": ""}
        encrypted = self.fernet.encrypt(json.dumps(session_data).encode()).decode()
        self.client.cookies.set("tt_hoyolab_session", encrypted)

        response = self.client.post("/api/hoyolab/achievements", json={})
        self.assertEqual(response.status_code, 401)
        self.assertIn("missing credentials", response.json()["detail"])


class TestExistingEndpointsRegression(unittest.TestCase):
    """Verify that existing endpoints still work after Phase B changes."""

    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()
        os.environ["GOOGLE_CLIENT_ID"] = "test"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test"
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/api/google/auth/callback"
        os.environ["GOOGLE_SESSION_KEY"] = Fernet.generate_key().decode()

        import config
        importlib.reload(config)
        import google_api
        importlib.reload(google_api)
        import hoyolab_achievements
        importlib.reload(hoyolab_achievements)
        import main
        importlib.reload(main)

        from fastapi.testclient import TestClient
        self.client = TestClient(main.app)

    def tearDown(self):
        import config
        config.GOOGLE_FERNET = getattr(self, 'original_fernet', None)
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_hoyolab_session_get(self):
        response = self.client.get("/api/hoyolab/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})

    def test_notes_no_session(self):
        response = self.client.post("/api/notes", json={})
        self.assertEqual(response.status_code, 401)

    def test_disconnect_hoyolab(self):
        response = self.client.delete("/api/hoyolab/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})


if __name__ == "__main__":
    unittest.main()
