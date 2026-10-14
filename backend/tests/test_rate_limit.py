"""
Unit tests for distributed rate limiting module (Stage B3).

Tests:
1. Client IP trust hierarchy: x-vercel-forwarded-for > x-forwarded-for / x-real-ip > request.client.host
2. Anonymous key construction: contains namespace, action, SHA-256 hash, and epoch bucket; NO raw IP or credentials
3. First request succeeds and executes atomic Lua EVAL command
4. Exact limit boundary succeeds
5. Exceeding limit raises HTTP 429 with Retry-After header and safe detail
6. Retry-After calculation is relative integer seconds >= 1, never absolute timestamp
7. Action and global bucket interaction: action consumes, global failure raises 429 and blocks request
8. Separate client IPs have independent keys
9. Separate action types have independent keys
10. TTL is strictly bounded to window duration
11. Provider malformed JSON fails closed with HTTP 503
12. Provider Redis error object fails closed with HTTP 503
13. Provider malformed response shape fails closed with HTTP 503
14. Provider timeout fails closed with HTTP 503
15. Provider network connection error fails closed with HTTP 503
16. Provider HTTP 500 fails closed with HTTP 503
17. Unconfigured provider in dev/test bypasses cleanly
18. Unconfigured provider in production bypasses without blocking, logging warning once
"""

import hashlib
import os
import sys
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import HTTPException, Request

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import config
import rate_limit


def _make_mock_request(
    headers: dict = None,
    client_host: str = "127.0.0.1",
) -> Request:
    header_list = []
    if headers:
        for k, v in headers.items():
            header_list.append((k.lower().encode("latin-1"), v.encode("latin-1")))

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/hoyolab/auth/email-password",
        "headers": header_list,
        "client": (client_host, 12345),
    }
    return Request(scope)


class TestRateLimiter(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.original_env = dict(os.environ)
        config.UPSTASH_REDIS_REST_URL = "https://mock-redis.upstash.io"
        config.UPSTASH_REDIS_REST_TOKEN = "mock_secret_token"
        config.IS_PRODUCTION = False
        rate_limit._warned_unconfigured_production = False

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.original_env)

    # 1. Client IP trust hierarchy
    def test_client_ip_trust_hierarchy(self):
        # Case A: x-vercel-forwarded-for takes precedence (and parses first IP)
        req_vercel = _make_mock_request(
            headers={
                "x-vercel-forwarded-for": "203.0.113.195, 198.51.100.1",
                "x-real-ip": "198.51.100.2",
            },
            client_host="192.168.1.1",
        )
        self.assertEqual(rate_limit.get_trusted_client_ip(req_vercel), "203.0.113.195")

        # Case B: x-forwarded-for / x-real-ip used if x-vercel-forwarded-for is missing
        req_forwarded = _make_mock_request(
            headers={"x-forwarded-for": "198.51.100.5, 10.0.0.1"},
            client_host="192.168.1.1",
        )
        self.assertEqual(rate_limit.get_trusted_client_ip(req_forwarded), "198.51.100.5")

        req_real = _make_mock_request(
            headers={"x-real-ip": "198.51.100.2"},
            client_host="192.168.1.1",
        )
        self.assertEqual(rate_limit.get_trusted_client_ip(req_real), "198.51.100.2")

        # Case C: socket host used if no proxy headers
        req_socket = _make_mock_request(client_host="10.0.0.5")
        self.assertEqual(rate_limit.get_trusted_client_ip(req_socket), "10.0.0.5")

    # 2. Key construction anonymization and structure
    def test_key_construction_includes_bucket_and_no_sensitive_data(self):
        client_ip = "203.0.113.50"
        secret_password = "SecretPassword!#123"
        secret_email = "user@example.com"
        fixed_now = 1700000000.0  # epoch timestamp
        window_seconds = 900
        expected_bucket = int(fixed_now // window_seconds)

        key, remaining = rate_limit.build_rate_limit_key("email_password", client_ip, window_seconds, now=fixed_now)

        self.assertNotIn(client_ip, key)
        self.assertNotIn(secret_password, key)
        self.assertNotIn(secret_email, key)
        self.assertNotIn("@", key)

        expected_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        self.assertEqual(key, f"rate:hoyolab:email_password:{expected_hash}:{expected_bucket}")
        self.assertGreater(remaining, 0)
        self.assertLessEqual(remaining, window_seconds)

    # 3. First request succeeds and invokes atomic Lua script
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_first_request_succeeds_and_invokes_atomic_lua_eval(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": [1, 899]  # Lua script returns [count, ttl]
        }
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        await rate_limit.check_rate_limit(req, "email_password")

        # Verify command sent to Upstash was EVAL with the atomic Lua script
        self.assertEqual(mock_post.call_count, 2)  # email_password + auth_global
        first_call_args = mock_post.call_args_list[0]
        json_body = first_call_args[1]["json"]
        self.assertEqual(json_body[0], "EVAL")
        self.assertEqual(json_body[1], rate_limit.LUA_RATE_LIMIT_SCRIPT)
        self.assertEqual(json_body[2], 1)  # 1 key argument

    # 4. Exact limit boundary succeeds
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_exact_limit_boundary_succeeds(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": [5, 800]  # count == 5 for limit 5
        }
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        # Exact boundary: count == limit (5 == 5) does NOT exceed limit
        await rate_limit.check_rate_limit(req, "email_password")

    # 5. Exceeding limit raises HTTP 429 with Retry-After header and safe detail
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_exceeding_limit_raises_429(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "result": [6, 742]  # count == 6 exceeds limit 5
        }
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")

        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.detail, "Too many sign-in attempts. Please wait before trying again.")
        self.assertEqual(cm.exception.headers.get("Retry-After"), "742")

    # 6. Retry-After calculation validity
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_retry_after_calculation_validity(self, mock_post):
        # Case A: TTL is 1 second
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"result": [10, 1]}
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.headers.get("Retry-After"), "1")

        # Case B: TTL is <= 0 or missing (falls back to remaining seconds >= 1)
        mock_resp.json.return_value = {"result": [10, 0]}
        with self.assertRaises(HTTPException) as cm2:
            await rate_limit.check_rate_limit(req, "email_password")
        retry_after = int(cm2.exception.headers.get("Retry-After"))
        self.assertGreaterEqual(retry_after, 1)
        self.assertLessEqual(retry_after, 900)

    # 7. Action and global bucket interaction: action passes, global fails
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_action_and_global_bucket_interaction(self, mock_post):
        resp_action_ok = MagicMock()
        resp_action_ok.status_code = 200
        resp_action_ok.json.return_value = {"result": [2, 850]}  # Action count: 2 (limit 5) -> OK

        resp_global_exceeded = MagicMock()
        resp_global_exceeded.status_code = 200
        resp_global_exceeded.json.return_value = {"result": [21, 600]}  # Global count: 21 (limit 20) -> Exceeded

        mock_post.side_effect = [resp_action_ok, resp_global_exceeded]

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")

        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.headers.get("Retry-After"), "600")

    # 8. Separate client IPs generate independent keys
    def test_separate_client_ips_have_independent_keys(self):
        fixed_now = 1700000000.0
        key1, _ = rate_limit.build_rate_limit_key("email_password", "203.0.113.1", 900, now=fixed_now)
        key2, _ = rate_limit.build_rate_limit_key("email_password", "203.0.113.2", 900, now=fixed_now)
        self.assertNotEqual(key1, key2)

    # 9. Separate actions generate independent keys
    def test_separate_actions_have_independent_keys(self):
        fixed_now = 1700000000.0
        key1, _ = rate_limit.build_rate_limit_key("email_password", "203.0.113.1", 900, now=fixed_now)
        key2, _ = rate_limit.build_rate_limit_key("geetest", "203.0.113.1", 900, now=fixed_now)
        self.assertNotEqual(key1, key2)

    # 10. TTL bounded to window
    def test_ttl_bounded_to_window(self):
        # At start of bucket: remaining is window_seconds
        _, remaining_start = rate_limit.build_rate_limit_key("email_password", "127.0.0.1", 900, now=900.0)
        self.assertEqual(remaining_start, 900)

        # Midway through bucket: remaining is 450
        _, remaining_mid = rate_limit.build_rate_limit_key("email_password", "127.0.0.1", 900, now=1350.0)
        self.assertEqual(remaining_mid, 450)

        # 1 second before end: remaining is 1
        _, remaining_end = rate_limit.build_rate_limit_key("email_password", "127.0.0.1", 900, now=1799.0)
        self.assertEqual(remaining_end, 1)

    # 11. Provider malformed JSON fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_malformed_json_fails_closed_503(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.side_effect = ValueError("Invalid JSON")
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 12. Provider Redis error object fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_redis_error_fails_closed_503(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"error": "ERR syntax error in script"}
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 13. Provider malformed response shape fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_malformed_shape_fails_closed_503(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"result": "not_a_list"}
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 14. Provider timeout fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_timeout_fails_closed_503(self, mock_post):
        import httpx
        mock_post.side_effect = httpx.TimeoutException("Read timed out")

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 15. Provider network error fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_network_error_fails_closed_503(self, mock_post):
        import httpx
        mock_post.side_effect = httpx.ConnectError("Connection refused")

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 16. Provider HTTP 500 fails closed with HTTP 503
    @patch("httpx.AsyncClient.post", new_callable=AsyncMock)
    async def test_provider_http_500_fails_closed_503(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "Internal Upstash error"
        mock_post.return_value = mock_resp

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertRaises(HTTPException) as cm:
            await rate_limit.check_rate_limit(req, "email_password")
        self.assertEqual(cm.exception.status_code, 503)

    # 17. Unconfigured provider in development/test bypasses cleanly
    async def test_unconfigured_provider_in_dev_test_bypasses(self):
        config.UPSTASH_REDIS_REST_URL = None
        config.UPSTASH_REDIS_REST_TOKEN = None
        config.IS_PRODUCTION = False

        req = _make_mock_request(client_host="192.0.2.1")
        # Should cleanly return without error
        await rate_limit.check_rate_limit(req, "email_password")

    # 18. Unconfigured provider in production bypasses without crashing, logs warning once
    async def test_unconfigured_provider_in_production_bypasses_with_warning(self):
        config.UPSTASH_REDIS_REST_URL = None
        config.UPSTASH_REDIS_REST_TOKEN = None
        config.IS_PRODUCTION = True

        req = _make_mock_request(client_host="192.0.2.1")
        with self.assertLogs("backend.rate_limit", level="WARNING") as cm:
            await rate_limit.check_rate_limit(req, "email_password")
            # Call a second time to ensure warning is not spammed
            await rate_limit.check_rate_limit(req, "email_password")

        self.assertEqual(len(cm.output), 1)
        self.assertIn("Distributed rate limiting provider is not configured", cm.output[0])


if __name__ == "__main__":
    unittest.main()
