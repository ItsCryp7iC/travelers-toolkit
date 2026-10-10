import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import genshin

# Mock the _get_hoyolab_client to return a fake client
with patch("main._get_hoyolab_client") as mock_get_client:
    from main import app, auth_failure_response, get_cookie_delete_options

from backend.hoyolab_character_sync import normalize_ascension

class MockWeapon:
    def __init__(self, id=11414, name="Amenoma Kageuchi", level=90, refinement=5, ascension=6):
        self.id = id
        self.name = name
        self.level = level
        self.refinement = refinement
        self.ascension = ascension

class MockCharacter:
    def __init__(self, id=10000002, name="Kamisato Ayaka", element="Cryo", rarity=5, level=90, constellation=0, friendship=10, weapon=None):
        self.id = id
        self.name = name
        self.element = element
        self.rarity = rarity
        self.level = level
        self.constellation = constellation
        self.friendship = friendship
        self.weapon = weapon or MockWeapon()
        # Simulated stats that we should ignore
        self.hp = 20000
        self.atk = 2000
        self.artifacts = ["Gladiator", "Blizzard Strayer"]

class MockDetailCharacter:
    def __init__(self, id=10000002, weapon=None):
        self.id = id
        self.weapon = weapon or MockWeapon()

class MockGenshinDetailCharacters:
    def __init__(self, characters):
        self.characters = characters

class TestHoyolabCharacterSync(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.mock_genshin_client = MagicMock()

        # Setup the mock _get_hoyolab_client to return our mock client and no error
        self.patcher = patch("main._get_hoyolab_client", return_value=(self.mock_genshin_client, None))
        self.mock_get_client = self.patcher.start()

        # By default, pretend production is True so diagnostics are hidden
        self.env_patcher = patch("main.IS_PRODUCTION", True)
        self.env_patcher.start()

    def tearDown(self):
        self.patcher.stop()
        self.env_patcher.stop()

    def test_normalize_ascension_valid(self):
        self.assertEqual(normalize_ascension(0), 0)
        self.assertEqual(normalize_ascension(3), 3)
        self.assertEqual(normalize_ascension(6), 6)
        self.assertEqual(normalize_ascension("5"), 5)

    def test_normalize_ascension_missing(self):
        self.assertIsNone(normalize_ascension(None))

    def test_normalize_ascension_invalid(self):
        self.assertIsNone(normalize_ascension("invalid"))
        self.assertIsNone(normalize_ascension([]))

    def test_normalize_ascension_out_of_range(self):
        self.assertIsNone(normalize_ascension(-1))
        self.assertIsNone(normalize_ascension(7))
        self.assertIsNone(normalize_ascension(90))

    def test_ayaka_like_skill_list(self):
        char = MockCharacter()
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": 10000002,
                "level_current": 90,
                "promote_level": 6,
                "skill_list": [
                    {"level_current": 10, "group_id": 231}, # normal
                    {"level_current": 10, "group_id": 232}, # skill
                    {"level_current": 1, "group_id": 233},  # alt sprint
                    {"level_current": 10, "group_id": 239}  # burst
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter()])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 10)
        self.assertEqual(c["talents"]["skill"], 10)
        self.assertEqual(c["talents"]["burst"], 10)

    def test_mona_like_skill_list(self):
        char = MockCharacter(id=10000041, name="Mona")
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": 10000041,
                "level_current": 90,
                "skill_list": [
                    {"level_current": 1, "group_id": 4131}, # normal
                    {"level_current": 9, "group_id": 4132}, # skill
                    {"level_current": 1, "group_id": 4133}, # alt sprint
                    {"level_current": 10, "group_id": 4139} # burst
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter(id=10000041)])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 1)
        self.assertEqual(c["talents"]["skill"], 9)
        self.assertEqual(c["talents"]["burst"], 10)

    def test_ordinary_3_skill_character(self):
        char = MockCharacter(id=10000030, name="Zhongli")
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": 10000030,
                "level_current": 90,
                "skill_list": [
                    {"level_current": 9, "group_id": 3031},
                    {"level_current": 9, "group_id": 3032},
                    {"level_current": 9, "group_id": 3039}
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter(id=10000030)])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 9)
        self.assertEqual(c["talents"]["skill"], 9)
        self.assertEqual(c["talents"]["burst"], 9)

    def test_extra_skill_before_burst(self):
        char = MockCharacter()
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": char.id,
                "level_current": 90,
                "skill_list": [
                    {"level_current": 6, "group_id": 231},
                    {"level_current": 6, "group_id": 232},
                    {"level_current": 1, "group_id": 221}, # passive
                    {"level_current": 8, "group_id": 239}
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter()])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 6)
        self.assertEqual(c["talents"]["skill"], 6)
        self.assertEqual(c["talents"]["burst"], 8)

    def test_extra_skill_after_burst(self):
        char = MockCharacter()
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": char.id,
                "level_current": 90,
                "skill_list": [
                    {"level_current": 6, "group_id": 231},
                    {"level_current": 6, "group_id": 232},
                    {"level_current": 8, "group_id": 239},
                    {"level_current": 1, "group_id": 221} # passive
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter()])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 6)
        self.assertEqual(c["talents"]["skill"], 6)
        self.assertEqual(c["talents"]["burst"], 8)

    def test_missing_burst_classification(self):
        char = MockCharacter()
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": char.id,
                "level_current": 90,
                "skill_list": [
                    {"level_current": 6, "group_id": 231},
                    {"level_current": 6, "group_id": 232},
                    {"level_current": 1, "group_id": 233} # alternate sprint instead of burst
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter()])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 6)
        self.assertEqual(c["talents"]["skill"], 6)
        self.assertIsNone(c["talents"]["burst"]) # Burst stays absent

    def test_traveler_response(self):
        char = MockCharacter(id=10000005, name="Traveler")
        async def mock_get_chars(*args, **kwargs): return [char]
        async def mock_get_calc_items(*args, **kwargs):
            return [{
                "id": 10000005,
                "level_current": 90,
                "skill_list": [
                    # Electro active element
                    {"level_current": 1, "group_id": 531},
                    {"level_current": 1, "group_id": 532},
                    {"level_current": 5, "group_id": 539},
                    # Geo inactive element
                    {"level_current": 2, "group_id": 731},
                    {"level_current": 2, "group_id": 732},
                    {"level_current": 2, "group_id": 739}
                ]
            }]
        async def mock_get_details(*args, **kwargs): return MockGenshinDetailCharacters([MockDetailCharacter(id=10000005)])
        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        c = response.json()["characters"][0]
        self.assertEqual(c["talents"]["normal"], 1)
        self.assertEqual(c["talents"]["skill"], 1)
        self.assertEqual(c["talents"]["burst"], 5)

    def test_empty_character_list(self):
        async def mock_get_chars(*args, **kwargs):
            return []

        async def mock_get_calc_items(*args, **kwargs):
            return []

        async def mock_get_details(*args, **kwargs):
            return MockGenshinDetailCharacters([])

        self.mock_genshin_client.get_genshin_characters = mock_get_chars
        self.mock_genshin_client._get_calculator_items = mock_get_calc_items
        self.mock_genshin_client.get_genshin_detailed_characters = mock_get_details

        response = self.client.post("/api/hoyolab/character-sync-preview")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data["characters"]), 0)

    def test_privacy_403(self):
        async def mock_get_chars(*args, **kwargs):
            raise genshin.errors.DataNotPublic(None)
        self.mock_genshin_client.get_genshin_characters = mock_get_chars

        response = self.client.post("/api/hoyolab/character-sync-preview")
        self.assertEqual(response.status_code, 403)
        self.assertIn("unavailable", response.json()["detail"])

    def test_invalid_cookies_401(self):
        async def mock_get_chars(*args, **kwargs):
            raise genshin.errors.InvalidCookies(None)
        self.mock_genshin_client.get_genshin_characters = mock_get_chars

        response = self.client.post("/api/hoyolab/character-sync-preview")
        self.assertEqual(response.status_code, 401)
        self.assertIn("expired", response.json()["detail"])

    def test_rate_limit_429(self):
        async def mock_get_chars(*args, **kwargs):
            raise genshin.errors.TooManyRequests(None)
        self.mock_genshin_client.get_genshin_characters = mock_get_chars

        response = self.client.post("/api/hoyolab/character-sync-preview")
        self.assertEqual(response.status_code, 429)

    def test_malformed_response(self):
        async def mock_get_chars(*args, **kwargs):
            raise genshin.errors.GenshinException({"retcode": -1, "message": "error"})
        self.mock_genshin_client.get_genshin_characters = mock_get_chars

        response = self.client.post("/api/hoyolab/character-sync-preview")
        self.assertEqual(response.status_code, 502)

if __name__ == '__main__':
    unittest.main()
