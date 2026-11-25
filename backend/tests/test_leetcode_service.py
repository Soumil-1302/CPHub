import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from threading import Event
from types import SimpleNamespace
from concurrent.futures import ThreadPoolExecutor
from uuid import UUID

import httpx
from fastapi import HTTPException

from app.services.leetcode_service import (
    LeetCodeProviderError,
    LeetCodeStats,
    fetch_leetcode_stats,
    get_my_leetcode_account,
    get_my_leetcode_activity,
    get_my_leetcode_sync_status,
    get_my_leetcode_topics,
    normalize_leetcode_username,
    refresh_my_leetcode_stats,
    update_my_leetcode_account,
    validate_leetcode_username,
)

USER_ID = UUID("5dd9f397-66e2-40d1-ae8c-930693031416")
NOW = datetime(2026, 11, 23, tzinfo=timezone.utc)


def provider_payload(username: str = "student_handle") -> dict:
    return {
        "data": {
            "matchedUser": {
                "username": username,
                "profile": {
                    "ranking": 1234,
                    "userAvatar": "https://assets.leetcode.com/avatar.png",
                    "realName": "Student",
                    "aboutMe": "CPHub student",
                    "countryName": "India",
                    "school": "Example University",
                    "websites": ["https://example.edu"],
                    "skillTags": ["Python"],
                },
                "submitStats": {
                    "acSubmissionNum": [
                        {"difficulty": "All", "count": 6},
                        {"difficulty": "Easy", "count": 2},
                        {"difficulty": "Medium", "count": 3},
                        {"difficulty": "Hard", "count": 1},
                    ]
                },
                "submissionCalendar": '{"1732300000":2}',
                "tagProblemCounts": {
                    "advanced": [{"tagName": "Graph", "problemsSolved": 2}],
                    "intermediate": [{"tagName": "Array", "problemsSolved": 4}],
                    "fundamental": [],
                },
            },
            "userContestRanking": {"rating": 1480.25, "globalRanking": 4321},
            "recentSubmissionList": [
                {
                    "title": "Two Sum",
                    "titleSlug": "two-sum",
                    "timestamp": "1732300000",
                    "statusDisplay": "Accepted",
                    "lang": "python3",
                }
            ],
        }
    }


class FakeQuery:
    def __init__(self, client: "FakeSupabaseClient", table: str) -> None:
        self.client = client
        self.table_name = table
        self.columns = ""
        self.filters: dict[str, str] = {}
        self.update_values: dict | None = None
        self.row_limit: int | None = None
        self.ordering: tuple[str, bool] | None = None

    def select(self, columns: str) -> "FakeQuery":
        self.columns = columns
        return self

    def update(self, values: dict) -> "FakeQuery":
        self.update_values = values
        return self

    def eq(self, column: str, value: str) -> "FakeQuery":
        self.filters[column] = value
        return self

    def maybe_single(self) -> "FakeQuery":
        return self

    def order(self, column: str, desc: bool = False) -> "FakeQuery":
        self.ordering = (column, desc)
        return self

    def limit(self, value: int) -> "FakeQuery":
        self.row_limit = value
        return self

    def execute(self) -> SimpleNamespace:
        rows = self.client.tables[self.table_name]
        if self.update_values is not None:
            for item in rows:
                if all(str(item.get(key)) == value for key, value in self.filters.items()):
                    item.update(self.update_values)
                    if self.table_name == "profiles" and "leetcode_username" in self.update_values:
                        account = next(
                            (
                                row for row in self.client.tables["leetcode_accounts"]
                                if row["user_id"] == item["id"]
                            ),
                            None,
                        )
                        if account:
                            account["leetcode_username"] = self.update_values["leetcode_username"].lower()
                            account["sync_status"] = "pending"
            row = next(
                (
                    item for item in rows
                    if all(str(item.get(key)) == value for key, value in self.filters.items())
                ),
                None,
            )
            return SimpleNamespace(
                data={key: row[key] for key in self.columns.split(",") if key in row}
                if row
                else None
            )
        if self.ordering:
            column, desc = self.ordering
            rows = sorted(rows, key=lambda row: row.get(column), reverse=desc)
        row = next(
            (
                item
                for item in rows
                if all(str(item.get(key)) == value for key, value in self.filters.items())
            ),
            None,
        )
        if self.row_limit is not None:
            rows = rows[:self.row_limit]
            row = next(
                (
                    item
                    for item in rows
                    if all(str(item.get(key)) == value for key, value in self.filters.items())
                ),
                None,
            )
        if self.table_name in {"user_activity", "topic_stats"} or self.row_limit is not None:
            return SimpleNamespace(
                data=[
                    {key: item[key] for key in self.columns.split(",") if key in item}
                    for item in rows
                    if all(str(item.get(key)) == value for key, value in self.filters.items())
                ]
            )
        return SimpleNamespace(
            data={key: deepcopy(row[key]) for key in self.columns.split(",") if key in row}
            if row
            else None
        )


class FakeRpc:
    def __init__(self, client: "FakeSupabaseClient", name: str, params: dict) -> None:
        self.client = client
        self.name = name
        self.params = params

    def execute(self) -> SimpleNamespace:
        self.client.rpc_calls.append((self.name, deepcopy(self.params)))
        if self.name == "claim_leetcode_fetch":
            claimed = self.client.claimed
            if claimed:
                self.client.claimed = False
                self.client.claim_reason = "in_progress"
            return SimpleNamespace(
                data=[
                    {
                        "claimed": claimed,
                        "retry_after_seconds": 18,
                        "reason": None if claimed else self.client.claim_reason,
                        "attempt_token": "0a9c3270-d28d-424a-a633-c20e78a33a49"
                        if claimed
                        else None,
                    }
                ]
            )
        if self.name == "finish_leetcode_fetch_error":
            return SimpleNamespace(data=True)
        if self.name == "finish_leetcode_fetch_success_v3":
            row = {
                "user_id": self.params["p_user_id"],
                "provider_username": self.params["p_provider_username"],
                "solved_total": self.params["p_solved_total"],
                "easy_solved": self.params["p_easy_solved"],
                "medium_solved": self.params["p_medium_solved"],
                "hard_solved": self.params["p_hard_solved"],
                "submission_calendar": self.params["p_submission_calendar"],
                "contest_rating": self.params["p_contest_rating"],
                "global_ranking": self.params["p_global_ranking"],
                "solved_by_topic": self.params["p_solved_by_topic"],
                "recent_submissions": self.params["p_recent_submissions"],
                "public_profile": self.params["p_public_profile"],
                "fetched_at": NOW.isoformat(),
                "fetch_status": "success",
            }
            self.client.tables["leetcode_stats"] = [row]
            return SimpleNamespace(data=row)
        raise AssertionError(f"Unexpected RPC: {self.name}")


class FakeSupabaseClient:
    def __init__(self) -> None:
        self.tables = {
            "profiles": [{"id": str(USER_ID), "leetcode_username": "student_handle"}],
            "leetcode_stats": [],
            "leetcode_accounts": [{
                "user_id": str(USER_ID),
                "leetcode_username": "student_handle",
                "linked_at": NOW.isoformat(),
                "last_synced_at": None,
                "sync_status": "pending",
            }],
            "user_activity": [],
            "topic_stats": [],
            "leetcode_fetch_state": [],
            "sync_logs": [],
        }
        self.rpc_calls: list[tuple[str, dict]] = []
        self.claimed = True
        self.claim_reason = None

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def rpc(self, name: str, params: dict) -> FakeRpc:
        return FakeRpc(self, name, params)


class LeetCodeProviderTests(unittest.TestCase):
    def test_normalizes_and_validates_username(self) -> None:
        self.assertEqual(normalize_leetcode_username(" Student_Handle "), "student_handle")
        for invalid in ("", "user/name", "x" * 41, None):
            with self.subTest(invalid=invalid), self.assertRaises(LeetCodeProviderError):
                normalize_leetcode_username(invalid)

    def test_fetches_and_validates_supported_statistics(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            if "recentSubmissionList" in request.content.decode():
                self.assertIn("matchedUser", request.content.decode())
            return httpx.Response(200, json=provider_payload())

        stats = fetch_leetcode_stats(
            "student_handle",
            client_factory=lambda **kwargs: httpx.Client(
                transport=httpx.MockTransport(handler),
                **kwargs,
            ),
        )

        self.assertEqual(stats.solved_total, 6)
        self.assertEqual(stats.easy_solved, 2)
        self.assertEqual(stats.contest_rating, 1480.25)
        self.assertEqual(stats.global_ranking, 4321)
        self.assertEqual(stats.recent_submissions[0]["title_slug"], "two-sum")
        self.assertEqual(stats.submission_calendar, {"1732300000": 2})
        self.assertEqual(stats.solved_by_topic, {"Graph": 2, "Array": 4})
        self.assertEqual(stats.public_profile["real_name"], "Student")

    def test_validates_username_without_fetching_all_statistics(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertIn("ValidateUser", request.content.decode())
            self.assertNotIn("submitStats", request.content.decode())
            return httpx.Response(
                200,
                json={"data": {"matchedUser": {"username": "Student_Handle"}}},
            )

        self.assertEqual(
            validate_leetcode_username(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            ),
            "Student_Handle",
        )

    def test_falls_back_to_core_statistics_when_optional_fields_are_unavailable(self) -> None:
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if len(requests) == 1:
                return httpx.Response(200, json={"errors": [{"message": "unknown optional field"}]})
            return httpx.Response(200, json={"data": {"matchedUser": provider_payload()["data"]["matchedUser"]}})

        stats = fetch_leetcode_stats(
            "student_handle",
            client_factory=lambda **kwargs: httpx.Client(
                transport=httpx.MockTransport(handler),
                **kwargs,
            ),
        )

        self.assertEqual(len(requests), 3)
        self.assertIsNone(stats.contest_rating)
        self.assertIsNone(stats.recent_submissions)
        self.assertEqual(stats.solved_total, 6)

    def test_returns_core_statistics_when_optional_profile_query_is_unavailable(self) -> None:
        requests = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if "PublicUserProfile" in request.content.decode():
                return httpx.Response(200, json={"errors": [{"message": "optional query unavailable"}]})
            return httpx.Response(200, json=provider_payload())

        stats = fetch_leetcode_stats(
            "student_handle",
            client_factory=lambda **kwargs: httpx.Client(
                transport=httpx.MockTransport(handler),
                **kwargs,
            ),
        )

        self.assertEqual(stats.solved_total, 6)
        self.assertIsNone(stats.public_profile)
        self.assertIsNone(stats.solved_by_topic)
        self.assertEqual(len(requests), 2)

    def test_maps_missing_profile_to_not_found(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"data": {"matchedUser": None}})

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "profile_not_found")
        self.assertEqual(error.exception.status_code, 404)

    def test_maps_upstream_rate_limit(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(429, headers={"Retry-After": "900"})

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_rate_limited")
        self.assertEqual(error.exception.status_code, 429)
        self.assertEqual(error.exception.retry_after_seconds, 900)

    def test_maps_network_failure_without_exposing_provider_details(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("sensitive transport details")

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_unavailable")
        self.assertNotIn("sensitive", str(error.exception))

    def test_maps_provider_timeout(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            raise httpx.ReadTimeout("transport details")

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "upstream_timeout")
        self.assertEqual(error.exception.status_code, 504)

    def test_rejects_oversized_provider_response(self) -> None:
        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, content=b" " * (256 * 1024 + 1))

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "response_too_large")

    def test_rejects_malformed_provider_data(self) -> None:
        payload = provider_payload()
        payload["data"]["matchedUser"]["submitStats"]["acSubmissionNum"][0]["count"] = -1

        def handler(_request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json=payload)

        with self.assertRaises(LeetCodeProviderError) as error:
            fetch_leetcode_stats(
                "student_handle",
                client_factory=lambda **kwargs: httpx.Client(
                    transport=httpx.MockTransport(handler),
                    **kwargs,
                ),
            )

        self.assertEqual(error.exception.code, "invalid_response")


class LeetCodeRefreshTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = FakeSupabaseClient()

    def test_returns_fresh_cache_without_calling_provider(self) -> None:
        self.client.tables["leetcode_stats"] = [
            {
                "user_id": str(USER_ID),
                "provider_username": "student_handle",
                "solved_total": 6,
                "easy_solved": 2,
                "medium_solved": 3,
                "hard_solved": 1,
                "submission_calendar": {},
                "contest_rating": None,
                "global_ranking": None,
                "solved_by_topic": None,
                "recent_submissions": None,
                "fetched_at": (NOW - timedelta(minutes=10)).isoformat(),
                "fetch_status": "success",
            }
        ]

        def fail_if_called(_username: str) -> LeetCodeStats:
            raise AssertionError("fresh cache should not call the provider")

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail_if_called,
            now=NOW,
        )

        self.assertEqual(response_status, 200)
        self.assertTrue(response.cached)
        self.assertEqual(response.data.solved_total, 6)
        self.assertEqual(self.client.rpc_calls, [])

    def test_successful_refresh_persists_all_supported_stats(self) -> None:
        stats = LeetCodeStats(
            provider_username="student_handle",
            solved_total=6,
            easy_solved=2,
            medium_solved=3,
            hard_solved=1,
            submission_calendar={"1732300000": 2},
            contest_rating=1480.25,
            global_ranking=4321,
            recent_submissions=[],
        )

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=lambda _username: stats,
        )

        self.assertEqual(response_status, 200)
        self.assertFalse(response.cached)
        self.assertEqual(response.data.contest_rating, 1480.25)
        self.assertEqual(response.data.global_ranking, 4321)
        self.assertEqual(self.client.rpc_calls[-1][0], "finish_leetcode_fetch_success_v3")
        self.assertEqual(self.client.rpc_calls[-1][1]["p_user_id"], str(USER_ID))

    def test_empty_activity_calendar_preserves_same_accounts_previous_history(self) -> None:
        prior_calendar = {"1732300000": 2}
        self.client.tables["leetcode_stats"] = [{
            "user_id": str(USER_ID),
            "provider_username": "student_handle",
            "solved_total": 6,
            "easy_solved": 2,
            "medium_solved": 3,
            "hard_solved": 1,
            "submission_calendar": prior_calendar,
            "contest_rating": None,
            "global_ranking": None,
            "solved_by_topic": None,
            "recent_submissions": None,
            "fetched_at": (NOW - timedelta(days=2)).isoformat(),
            "fetch_status": "success",
        }]
        provider_stats = LeetCodeStats(
            provider_username="student_handle",
            solved_total=7,
            easy_solved=2,
            medium_solved=4,
            hard_solved=1,
            submission_calendar={},
            contest_rating=None,
            global_ranking=None,
            recent_submissions=None,
        )

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=lambda _username: provider_stats,
            now=NOW,
        )

        self.assertEqual(response_status, 200)
        self.assertEqual(response.data.submission_calendar, prior_calendar)
        self.assertEqual(
            self.client.rpc_calls[-1][1]["p_submission_calendar"],
            prior_calendar,
        )

    def test_provider_failure_returns_old_stats_without_overwriting_them(self) -> None:
        prior_row = {
            "user_id": str(USER_ID),
            "provider_username": "student_handle",
            "solved_total": 6,
            "easy_solved": 2,
            "medium_solved": 3,
            "hard_solved": 1,
            "submission_calendar": {},
            "contest_rating": 1234.5,
            "global_ranking": 7654,
            "solved_by_topic": None,
            "recent_submissions": None,
            "fetched_at": (NOW - timedelta(days=2)).isoformat(),
            "fetch_status": "success",
        }
        self.client.tables["leetcode_stats"] = [deepcopy(prior_row)]

        def fail(_username: str) -> LeetCodeStats:
            raise LeetCodeProviderError("upstream_timeout", "LeetCode did not respond.", 504)

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail,
            now=NOW,
        )

        self.assertEqual(response_status, 504)
        self.assertFalse(response.success)
        self.assertTrue(response.cached)
        self.assertEqual(response.data.solved_total, 6)
        self.assertEqual(response.data.contest_rating, 1234.5)
        self.assertEqual(self.client.tables["leetcode_stats"][0], prior_row)
        self.assertEqual(self.client.rpc_calls[-1][0], "finish_leetcode_fetch_error")

    def test_fetch_claim_rate_limit_returns_existing_cache(self) -> None:
        self.client.claimed = False
        self.client.claim_reason = "rate_limited"

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            1,
            fetcher=lambda _username: self.fail("rate-limited claims must not fetch"),
        )

        self.assertEqual(response_status, 429)
        self.assertEqual(response.error.retry_after_seconds, 18)
        self.assertIsNone(response.data)

    def test_duplicate_in_progress_refresh_does_not_call_provider(self) -> None:
        self.client.claimed = False
        self.client.claim_reason = "in_progress"

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            1,
            fetcher=lambda _username: self.fail("duplicate refresh must not fetch"),
        )

        self.assertEqual(response_status, 429)
        self.assertEqual(response.error.code, "refresh_in_progress")
        self.assertEqual(response.error.retry_after_seconds, 18)
        self.assertEqual(
            self.client.rpc_calls[-1][1]["p_lease_seconds"],
            90,
        )

    def test_concurrent_refresh_requests_only_fetch_once(self) -> None:
        fetch_started = Event()
        allow_fetch_to_finish = Event()
        provider_stats = LeetCodeStats(
            provider_username="student_handle",
            solved_total=6,
            easy_solved=2,
            medium_solved=3,
            hard_solved=1,
            submission_calendar={},
            contest_rating=None,
            global_ranking=None,
            recent_submissions=None,
        )
        fetch_count = 0

        def fetcher(_username: str) -> LeetCodeStats:
            nonlocal fetch_count
            fetch_count += 1
            fetch_started.set()
            if not allow_fetch_to_finish.wait(timeout=2):
                raise AssertionError("test did not release the active refresh")
            return provider_stats

        with ThreadPoolExecutor(max_workers=1) as executor:
            first = executor.submit(
                refresh_my_leetcode_stats,
                self.client,
                USER_ID,
                3600,
                fetcher=fetcher,
            )
            self.assertTrue(fetch_started.wait(timeout=2))
            second, second_status = refresh_my_leetcode_stats(
                self.client,
                USER_ID,
                3600,
                fetcher=fetcher,
            )
            allow_fetch_to_finish.set()
            first_response, first_status = first.result(timeout=2)

        self.assertEqual(fetch_count, 1)
        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 429)
        self.assertEqual(second.error.code, "refresh_in_progress")
        self.assertEqual(first_response.data.solved_total, 6)

    def test_sync_status_reports_active_claim_and_latest_attempt(self) -> None:
        attempted_at = datetime.now(timezone.utc)
        self.client.tables["leetcode_fetch_state"] = [{
            "leetcode_username": "student_handle",
            "user_id": str(USER_ID),
            "fetch_status": "fetching",
            "last_attempted_at": attempted_at.isoformat(),
            "lease_until": (attempted_at + timedelta(minutes=1)).isoformat(),
            "last_error_code": None,
        }]
        self.client.tables["sync_logs"] = [{
            "user_id": str(USER_ID),
            "status": "success",
            "error_message": None,
            "started_at": (NOW - timedelta(days=1)).isoformat(),
            "completed_at": (NOW - timedelta(days=1)).isoformat(),
        }]

        response = get_my_leetcode_sync_status(self.client, USER_ID)

        self.assertEqual(response.data.username, "student_handle")
        self.assertEqual(response.data.status, "syncing")
        self.assertEqual(response.data.last_attempted_at, attempted_at)
        self.assertIsNone(response.data.error_message)

    def test_sync_status_returns_safe_error_message_and_unlinked_state(self) -> None:
        self.client.tables["leetcode_accounts"][0]["sync_status"] = "error"
        self.client.tables["leetcode_fetch_state"] = [{
            "leetcode_username": "student_handle",
            "user_id": str(USER_ID),
            "fetch_status": "error",
            "last_attempted_at": NOW.isoformat(),
            "last_error_code": "upstream_timeout",
        }]

        response = get_my_leetcode_sync_status(self.client, USER_ID)
        self.assertEqual(response.data.status, "error")
        self.assertEqual(response.data.error_message, "LeetCode did not respond in time.")

        self.client.tables["leetcode_accounts"][0]["sync_status"] = "unlinked"
        unlinked = get_my_leetcode_sync_status(self.client, USER_ID)
        self.assertEqual(unlinked.data.status, "unlinked")
        self.assertIsNone(unlinked.data.username)

    def test_missing_saved_username_is_rejected(self) -> None:
        self.client.tables["profiles"][0]["leetcode_username"] = None

        with self.assertRaises(HTTPException) as error:
            refresh_my_leetcode_stats(self.client, USER_ID, 3600)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail["code"], "leetcode_username_required")

    def test_old_handle_cache_is_not_returned_for_a_new_saved_username(self) -> None:
        self.client.tables["profiles"][0]["leetcode_username"] = "new_handle"
        self.client.tables["leetcode_stats"] = [
            {
                "user_id": str(USER_ID),
                "provider_username": "old_handle",
                "solved_total": 3,
                "easy_solved": 1,
                "medium_solved": 1,
                "hard_solved": 1,
                "submission_calendar": {},
                "contest_rating": None,
                "global_ranking": None,
                "solved_by_topic": None,
                "recent_submissions": None,
                "fetched_at": (NOW - timedelta(days=2)).isoformat(),
                "fetch_status": "success",
            }
        ]

        def fail(_username: str) -> LeetCodeStats:
            raise LeetCodeProviderError("profile_not_found", "Profile not found.", 404)

        response, response_status = refresh_my_leetcode_stats(
            self.client,
            USER_ID,
            3600,
            fetcher=fail,
            now=NOW,
        )

        self.assertEqual(response_status, 404)
        self.assertIsNone(response.data)
        self.assertEqual(self.client.tables["leetcode_stats"][0]["provider_username"], "old_handle")

    def test_reads_activity_topics_and_account_from_user_scoped_cache(self) -> None:
        self.client.tables["leetcode_stats"] = [{
            "user_id": str(USER_ID),
            "provider_username": "student_handle",
            "solved_total": 6,
            "easy_solved": 2,
            "medium_solved": 3,
            "hard_solved": 1,
            "submission_calendar": {"1732300000": 2},
            "contest_rating": None,
            "global_ranking": None,
            "solved_by_topic": {"Graph": 2},
            "recent_submissions": None,
            "public_profile": None,
            "fetched_at": NOW.isoformat(),
            "fetch_status": "success",
        }]
        self.client.tables["user_activity"] = [{
            "user_id": str(USER_ID),
            "activity_date": "2024-11-22",
            "problems_solved": 2,
        }, {
            "user_id": str(USER_ID),
            "activity_date": "2020-01-01",
            "problems_solved": 50,
        }]
        self.client.tables["topic_stats"] = [{
            "user_id": str(USER_ID),
            "topic_name": "Graph",
            "problems_solved": 2,
        }, {
            "user_id": str(USER_ID),
            "topic_name": "Old account topic",
            "problems_solved": 50,
        }]

        activity = get_my_leetcode_activity(self.client, USER_ID)
        topics = get_my_leetcode_topics(self.client, USER_ID)
        account = get_my_leetcode_account(self.client, USER_ID)

        self.assertTrue(activity.data.available)
        self.assertEqual(len(activity.data.days), 1)
        self.assertEqual(activity.data.days[0].submissions_count, 2)
        self.assertTrue(topics.data.available)
        self.assertEqual(topics.data.topics[0].topic_name, "Graph")
        self.assertEqual(len(topics.data.topics), 1)
        self.assertEqual(account.data.username, "student_handle")

    def test_missing_topic_data_is_reported_as_unavailable(self) -> None:
        self.client.tables["leetcode_stats"] = [{
            "user_id": str(USER_ID),
            "provider_username": "student_handle",
            "solved_total": 0,
            "easy_solved": 0,
            "medium_solved": 0,
            "hard_solved": 0,
            "submission_calendar": {},
            "contest_rating": None,
            "global_ranking": None,
            "solved_by_topic": None,
            "recent_submissions": None,
            "public_profile": None,
            "fetched_at": NOW.isoformat(),
            "fetch_status": "success",
        }]

        response = get_my_leetcode_topics(self.client, USER_ID)

        self.assertFalse(response.data.available)
        self.assertEqual(response.data.topics, [])

    def test_account_update_validates_and_updates_only_the_authenticated_profile(self) -> None:
        response = update_my_leetcode_account(
            self.client,
            USER_ID,
            "New_Handle",
            validator=lambda username: username,
        )

        self.assertEqual(response.data.username, "new_handle")
        self.assertEqual(
            self.client.tables["profiles"][0]["leetcode_username"],
            "new_handle",
        )
        self.assertEqual(
            self.client.tables["leetcode_accounts"][0]["leetcode_username"],
            "new_handle",
        )


if __name__ == "__main__":
    unittest.main()
