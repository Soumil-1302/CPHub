import unittest
from copy import deepcopy
from types import SimpleNamespace
from uuid import UUID

from app.schemas.settings import UserSettingsUpdateRequest
from app.services.settings_service import update_my_settings

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")


class FakeQuery:
    def __init__(self, client: "FakeClient", table: str) -> None:
        self.client = client
        self.table = table
        self.filters: dict[str, str] = {}
        self.values: dict[str, object] | None = None
        self.columns = ""
        self.operation = "read"

    def select(self, columns: str) -> "FakeQuery":
        self.columns = columns
        return self

    def eq(self, column: str, value: str) -> "FakeQuery":
        self.filters[column] = value
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def update(self, values: dict[str, object]) -> "FakeQuery":
        self.values = values
        self.operation = "update"
        return self

    def insert(self, values: dict[str, object]) -> "FakeQuery":
        self.values = values
        self.operation = "insert"
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.client.tables[self.table]
        row = next(
            (
                item
                for item in rows
                if all(str(item.get(key)) == value for key, value in self.filters.items())
            ),
            None,
        )
        if self.operation == "insert":
            assert self.values is not None
            row = deepcopy(self.values)
            rows.append(row)
        elif self.operation == "update" and row is not None:
            assert self.values is not None
            row.update(deepcopy(self.values))

        if row is None:
            return SimpleNamespace(data=None)
        selected = self.columns.split(",") if self.columns else row.keys()
        return SimpleNamespace(data={key: row[key] for key in selected if key in row})


class FakeClient:
    def __init__(
        self,
        *,
        profile: dict[str, object],
        preferences: list[dict[str, object]] | None = None,
    ) -> None:
        self.tables = {
            "profiles": [profile],
            "user_preferences": preferences or [],
        }

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


class SettingsServiceTests(unittest.TestCase):
    def test_partial_preference_update_preserves_the_other_preference_group(self) -> None:
        client = FakeClient(
            profile={"id": str(USER_ID), "is_public": True},
            preferences=[{
                "user_id": str(USER_ID),
                "notification_preferences": {"sync_reminders": True},
                "dashboard_preferences": {"compact": True},
            }],
        )

        result = update_my_settings(
            client,
            USER_ID,
            UserSettingsUpdateRequest(
                notification_preferences={"sync_reminders": False},
            ),
        )

        saved = client.tables["user_preferences"][0]
        self.assertEqual(
            saved["notification_preferences"],
            {"sync_reminders": False},
        )
        self.assertEqual(saved["dashboard_preferences"], {"compact": True})
        self.assertEqual(result.dashboard_preferences, {"compact": True})

    def test_first_preference_write_initializes_unmodified_group(self) -> None:
        client = FakeClient(profile={"id": str(USER_ID), "is_public": True})

        update_my_settings(
            client,
            USER_ID,
            UserSettingsUpdateRequest(
                dashboard_preferences={"compact": True},
            ),
        )

        self.assertEqual(
            client.tables["user_preferences"],
            [{
                "user_id": str(USER_ID),
                "notification_preferences": {},
                "dashboard_preferences": {"compact": True},
            }],
        )


if __name__ == "__main__":
    unittest.main()
