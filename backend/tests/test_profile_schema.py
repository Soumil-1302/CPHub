import unittest
from datetime import datetime, timezone

from app.schemas.profile import PublicProfileResponse


class PublicProfileSchemaTests(unittest.TestCase):
    def test_public_profile_accepts_missing_legacy_graduation_year(self) -> None:
        profile = PublicProfileResponse.model_validate({
            "username": "student_one",
            "display_name": "Student One",
            "branch": "General",
            "year_of_passing": None,
            "leetcode_username": None,
            "leetcode_profile_url": None,
            "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
            "updated_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        })

        self.assertIsNone(profile.year_of_passing)


if __name__ == "__main__":
    unittest.main()
