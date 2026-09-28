import unittest
import os
import sys
import importlib

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

class TestConfig(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)

    def tearDown(self):
        import config
        config.GOOGLE_FERNET = getattr(self, 'original_fernet', None)
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_frontend_origins_parsing(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173, https://example.com"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        import config
        importlib.reload(config)
        self.assertEqual(config.FRONTEND_ORIGINS, ["http://localhost:5173", "https://example.com"])

    def test_frontend_origins_trailing_slash_normalized(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173/"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        import config
        importlib.reload(config)
        self.assertEqual(config.FRONTEND_ORIGINS, ["http://localhost:5173"])

    def test_production_missing_origins(self):
        os.environ["ENVIRONMENT"] = "production"
        os.environ["FRONTEND_ORIGINS"] = ""
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        with self.assertRaises(ValueError) as context:
            import config
            importlib.reload(config)
        self.assertEqual(str(context.exception), "FRONTEND_ORIGINS must be set when ENVIRONMENT is production.")

    def test_wildcard_origin_rejected(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "*"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        with self.assertRaises(ValueError) as context:
            import config
            importlib.reload(config)
        self.assertTrue("Wildcard CORS origins are not allowed" in str(context.exception))

    def test_userinfo_rejected(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        os.environ["FRONTEND_ORIGINS"] = "https://user@example.com"
        with self.assertRaises(ValueError) as context:
            import config
            importlib.reload(config)
        self.assertTrue("Userinfo (username/password) is not allowed" in str(context.exception))

        os.environ["FRONTEND_ORIGINS"] = "https://user:pass@example.com"
        with self.assertRaises(ValueError) as context:
            importlib.reload(config)
        self.assertTrue("Userinfo (username/password) is not allowed" in str(context.exception))

    def test_invalid_port_rejected(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:9999999"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        with self.assertRaises(ValueError) as context:
            import config
            importlib.reload(config)
        self.assertTrue("Invalid port" in str(context.exception))

    def test_invalid_scheme(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "ftp://localhost"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        with self.assertRaises(ValueError):
            import config
            importlib.reload(config)

    def test_google_redirect_uri_validation(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()
        os.environ["GOOGLE_CLIENT_ID"] = "test"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test"
        os.environ["GOOGLE_SESSION_KEY"] = Fernet.generate_key().decode()

        # Test valid
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/api/google/auth/callback"
        import config
        importlib.reload(config)
        self.assertEqual(config.GOOGLE_REDIRECT_ORIGIN, "http://localhost:5173")

        # Test invalid path
        os.environ["GOOGLE_REDIRECT_URI"] = "http://localhost:5173/auth"
        with self.assertRaises(ValueError) as context:
            importlib.reload(config)
        self.assertTrue("must exactly have path /api/google/auth/callback" in str(context.exception))

        # Test invalid origin
        os.environ["GOOGLE_REDIRECT_URI"] = "https://evil.com/api/google/auth/callback"
        with self.assertRaises(ValueError):
            importlib.reload(config)

    def test_cookie_policy_development(self):
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()
        import config
        importlib.reload(config)

        opts = config.get_cookie_set_options()
        self.assertEqual(opts["secure"], False)
        self.assertEqual(opts["samesite"], "lax")
        self.assertEqual(opts["httponly"], True)

    def test_cookie_policy_production(self):
        os.environ["ENVIRONMENT"] = "production"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()
        import config
        importlib.reload(config)

        opts = config.get_cookie_set_options()
        self.assertEqual(opts["secure"], True)
        self.assertEqual(opts["samesite"], "lax")
        self.assertEqual(opts["httponly"], True)

class TestAppEndpoints(unittest.TestCase):
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

        import google_api
        importlib.reload(google_api)
        import main
        importlib.reload(main)
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

    def test_cors_preflight_allowed(self):
        response = self.client.options(
            "/api/hoyolab/session",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type"
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertTrue("content-type" in response.headers.get("access-control-allow-headers", "").lower())

    def test_cors_preflight_rejected(self):
        response = self.client.options(
            "/api/hoyolab/session",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type"
            }
        )
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("access-control-allow-origin", response.headers)

    def test_disconnect_hoyolab_session(self):
        response = self.client.delete("/api/hoyolab/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})

        # Verify Set-Cookie header deletes the cookie
        set_cookie = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie)
        self.assertTrue("tt_hoyolab_session=;" in set_cookie or "tt_hoyolab_session=\"\";" in set_cookie)
        self.assertTrue("Max-Age=0" in set_cookie or "expires=" in set_cookie.lower())

    def test_disconnect_google_session(self):
        response = self.client.delete("/api/google/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})

        set_cookie = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie)
        self.assertTrue("tt_google_session=;" in set_cookie or "tt_google_session=\"\";" in set_cookie)
        self.assertTrue("Max-Age=0" in set_cookie or "expires=" in set_cookie.lower())

    def test_corrupted_hoyolab_cookie(self):
        self.client.cookies.set("tt_hoyolab_session", "invalid_fernet_token")
        response = self.client.get("/api/hoyolab/session")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"connected": False})

        set_cookie = response.headers.get("set-cookie")
        self.assertIsNotNone(set_cookie)
        self.assertTrue("tt_hoyolab_session=;" in set_cookie or "tt_hoyolab_session=\"\";" in set_cookie)
        self.assertTrue("Max-Age=0" in set_cookie or "expires=" in set_cookie.lower())

class TestAppEndpointsNoGoogle(unittest.TestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        os.environ["ENVIRONMENT"] = "development"
        os.environ["FRONTEND_ORIGINS"] = "http://localhost:5173"
        os.environ["HOYOLAB_SESSION_KEY"] = Fernet.generate_key().decode()

        # Clear Google configs
        for k in ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI", "GOOGLE_SESSION_KEY"]:
            if k in os.environ:
                del os.environ[k]

        import config
        self.original_fernet = config.GOOGLE_FERNET
        config.GOOGLE_FERNET = None
        import main
        self.client = TestClient(main.app)

    def tearDown(self):
        import config
        config.GOOGLE_FERNET = getattr(self, 'original_fernet', None)
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_google_endpoints_501(self):
        endpoints = [
            ("GET", "/api/google/auth/start"),
            ("POST", "/api/google/backups/manual"),
            ("PUT", "/api/google/backups/auto"),
            ("GET", "/api/google/backups"),
            ("GET", "/api/google/backups/recovery"),
            ("GET", "/api/google/backups/auto/status"),
            ("GET", "/api/google/backups/123"),
        ]
        for method, path in endpoints:
            kwargs = {}
            if method in ["POST", "PUT"]:
                kwargs["json"] = {
                    "app": "travelers-toolkit",
                    "schemaVersion": 1,
                    "createdAt": "2023-01-01T00:00:00Z",
                    "data": {
                        "roster": {},
                        "trackedWeapons": [],
                        "inventory": {},
                        "serverRegion": "Asia",
                        "showDbBuilder": False
                    }
                }
            self.client.cookies.set("tt_google_session", "dummy_token")
            response = self.client.request(method, path, **kwargs)
            if response.status_code == 404:
                print([getattr(r, 'path', getattr(r, 'prefix', 'unknown')) for r in self.client.app.routes])
            self.assertEqual(response.status_code, 501, f"Failed on {method} {path}")

if __name__ == '__main__':
    unittest.main()
