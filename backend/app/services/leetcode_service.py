import json
import logging
import math
import re
from dataclasses import dataclass, replace
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from supabase import Client

from app.schemas.leetcode import (
    LeetCodeAccount,
    LeetCodeAccountResponse,
    LeetCodeActivityData,
    LeetCodeActivityDay,
    LeetCodeActivityResponse,
    LeetCodeRefreshResponse,
    LeetCodeStatsResponse,
    LeetCodeSyncStatusData,
    LeetCodeSyncStatusResponse,
    LeetCodeTopicStat,
    LeetCodeTopicsData,
    LeetCodeTopicsResponse,
    RefreshError,
)

logger = logging.getLogger("cphub.api.leetcode")
LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql/"
LEETCODE_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
CACHE_COLUMNS = (
    "user_id,provider_username,solved_total,easy_solved,medium_solved,hard_solved,"
    "submission_calendar,contest_rating,global_ranking,solved_by_topic,"
    "recent_submissions,public_profile,total_submissions,acceptance_rate,fetched_at,fetch_status"
)
MIN_REFRESH_INTERVAL_SECONDS = 300
FETCH_LEASE_SECONDS = 90
MAX_RESPONSE_BYTES = 256 * 1024
MAX_CALENDAR_ENTRIES = 12_000
MAX_RECENT_SUBMISSIONS = 20
MAX_ACTIVITY_TIMESTAMP = 4_102_444_800

BASE_QUERY = """
query UserStats($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking }
    submitStats {
      acSubmissionNum { difficulty count }
    }
    submissionCalendar
  }
}
"""

USERNAME_QUERY = """
query ValidateUser($username: String!) {
  matchedUser(username: $username) {
    username
  }
}
"""

EXTENDED_QUERY = """
query UserStats($username: String!) {
  matchedUser(username: $username) {
    username
    profile { ranking }
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty submissions }
    }
    submissionCalendar
  }
  userContestRanking(username: $username) {
    attendedContestsCount
    rating
    globalRanking
  }
  recentSubmissionList(username: $username, limit: 10) {
    title
    titleSlug
    timestamp
    statusDisplay
    lang
  }
}
"""

OPTIONAL_PROFILE_QUERY = """
query PublicUserProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      userAvatar
      realName
      aboutMe
      countryName
      school
      websites
      skillTags
    }
    submitStats {
      acSubmissionNum { difficulty submissions }
      totalSubmissionNum { difficulty submissions }
    }
    tagProblemCounts {
      advanced { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      fundamental { tagName problemsSolved }
    }
  }
}
"""


class LeetCodeProviderError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 502,
        retry_after_seconds: int | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


@dataclass(frozen=True)
class LeetCodeStats:
    provider_username: str
    solved_total: int
    easy_solved: int
    medium_solved: int
    hard_solved: int
    submission_calendar: dict[str, int]
    contest_rating: float | None = None
    global_ranking: int | None = None
    solved_by_topic: dict[str, int] | None = None
    recent_submissions: list[dict[str, Any]] | None = None
    public_profile: dict[str, Any] | None = None
    total_submissions: int | None = None
    acceptance_rate: float | None = None


def normalize_leetcode_username(username: object) -> str:
    if not isinstance(username, str):
        raise LeetCodeProviderError(
            "invalid_username",
            "The saved LeetCode username has an invalid format.",
            status.HTTP_400_BAD_REQUEST,
        )
    normalized = username.strip()
    if not LEETCODE_USERNAME_PATTERN.fullmatch(normalized):
        raise LeetCodeProviderError(
            "invalid_username",
            "The saved LeetCode username has an invalid format.",
            status.HTTP_400_BAD_REQUEST,
        )
    return normalized.lower()


def _non_negative_integer(value: object) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and value >= 0


def _is_https_url(value: str) -> bool:
    try:
        parsed = urlsplit(value)
    except ValueError:
        return False
    return parsed.scheme == "https" and bool(parsed.hostname)


def _submission_calendar(value: object) -> dict[str, int]:
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError) as error:
            raise LeetCodeProviderError(
                "invalid_response",
                "LeetCode returned an invalid submission calendar.",
            ) from error
    if not isinstance(value, dict) or len(value) > MAX_CALENDAR_ENTRIES:
        raise LeetCodeProviderError(
            "invalid_response",
            "LeetCode returned an invalid submission calendar.",
        )
    calendar: dict[str, int] = {}
    for timestamp, count in value.items():
        if (
            not isinstance(timestamp, str)
            or not re.fullmatch(r"\d{1,12}", timestamp)
            or int(timestamp) > MAX_ACTIVITY_TIMESTAMP
            or not _non_negative_integer(count)
        ):
            raise LeetCodeProviderError(
                "invalid_response",
                "LeetCode returned malformed submission calendar data.",
            )
        calendar[timestamp] = count
    return calendar


def _validate_stats(payload: object, username: str) -> LeetCodeStats:
    if not isinstance(payload, dict):
        raise LeetCodeProviderError("invalid_response", "LeetCode returned an invalid response.")
    if payload.get("errors"):
        raise LeetCodeProviderError(
            "upstream_graphql_error",
            "LeetCode could not provide profile statistics.",
        )

    data = payload.get("data")
    matched_user = data.get("matchedUser") if isinstance(data, dict) else None
    if matched_user is None:
        raise LeetCodeProviderError(
            "profile_not_found",
            "The LeetCode profile was not found or is unavailable.",
            status.HTTP_404_NOT_FOUND,
        )
    if (
        not isinstance(matched_user, dict)
        or not isinstance(matched_user.get("username"), str)
        or matched_user["username"].casefold() != username.casefold()
    ):
        raise LeetCodeProviderError(
            "username_mismatch",
            "LeetCode returned a different profile than requested.",
        )

    submission_counts = (
        matched_user.get("submitStats", {}).get("acSubmissionNum")
        if isinstance(matched_user.get("submitStats"), dict)
        else None
    )
    if not isinstance(submission_counts, list):
        raise LeetCodeProviderError(
            "invalid_response",
            "LeetCode returned incomplete solve statistics.",
        )

    counts: dict[str, int] = {}
    for entry in submission_counts:
        if not isinstance(entry, dict):
            raise LeetCodeProviderError(
                "invalid_response",
                "LeetCode returned malformed solve statistics.",
            )
        difficulty, count = entry.get("difficulty"), entry.get("count")
        if not isinstance(difficulty, str) or not _non_negative_integer(count) or difficulty in counts:
            raise LeetCodeProviderError(
                "invalid_response",
                "LeetCode returned malformed solve statistics.",
            )
        counts[difficulty] = count

    if any(key not in counts for key in ("All", "Easy", "Medium", "Hard")):
        raise LeetCodeProviderError(
            "invalid_response",
            "LeetCode returned incomplete difficulty counts.",
        )
    total, easy, medium, hard = (
        counts["All"],
        counts["Easy"],
        counts["Medium"],
        counts["Hard"],
    )
    if easy + medium + hard != total:
        raise LeetCodeProviderError(
            "invalid_response",
            "LeetCode returned inconsistent solve totals.",
        )

    profile = matched_user.get("profile")
    ranking_value = profile.get("ranking") if isinstance(profile, dict) else None
    global_ranking = ranking_value if _non_negative_integer(ranking_value) and ranking_value else None

    contest = data.get("userContestRanking") if isinstance(data, dict) else None
    raw_rating = contest.get("rating") if isinstance(contest, dict) else None
    contest_rating = (
        float(raw_rating)
        if isinstance(raw_rating, (int, float))
        and not isinstance(raw_rating, bool)
        and math.isfinite(raw_rating)
        and raw_rating >= 0
        else None
    )
    contest_ranking = contest.get("globalRanking") if isinstance(contest, dict) else None
    if _non_negative_integer(contest_ranking) and contest_ranking:
        global_ranking = contest_ranking

    total_submissions = None
    acceptance_rate = None
    submit_stats = matched_user.get("submitStats")
    total_submissions_by_difficulty = (
        submit_stats.get("totalSubmissionNum")
        if isinstance(submit_stats, dict)
        else None
    )
    accepted_submissions_by_difficulty = (
        submit_stats.get("acSubmissionNum")
        if isinstance(submit_stats, dict)
        else None
    )
    if isinstance(total_submissions_by_difficulty, list) and isinstance(
        accepted_submissions_by_difficulty,
        list,
    ):
        total_all = next(
            (
                item.get("submissions")
                for item in total_submissions_by_difficulty
                if isinstance(item, dict) and item.get("difficulty") == "All"
            ),
            None,
        )
        accepted_all = next(
            (
                item.get("submissions")
                for item in accepted_submissions_by_difficulty
                if isinstance(item, dict) and item.get("difficulty") == "All"
            ),
            None,
        )
        if (
            _non_negative_integer(total_all)
            and _non_negative_integer(accepted_all)
            and accepted_all <= total_all
        ):
            total_submissions = total_all
            acceptance_rate = (
                round(accepted_all * 100 / total_all, 1)
                if total_all > 0
                else None
            )

    raw_submissions = data.get("recentSubmissionList") if isinstance(data, dict) else None
    recent_submissions = None
    if isinstance(raw_submissions, list):
        recent_submissions = []
        for item in raw_submissions[:MAX_RECENT_SUBMISSIONS]:
            if not isinstance(item, dict):
                continue
            title = item.get("title")
            slug = item.get("titleSlug")
            timestamp = item.get("timestamp")
            if (
                isinstance(title, str)
                and isinstance(slug, str)
                and isinstance(timestamp, str)
                and re.fullmatch(r"\d{1,13}", timestamp)
            ):
                recent_submissions.append(
                    {
                        "title": title[:200],
                        "title_slug": slug[:200],
                        "timestamp": timestamp,
                        "status": str(item.get("statusDisplay", ""))[:50],
                        "language": str(item.get("lang", ""))[:50],
                    }
                )

    return LeetCodeStats(
        provider_username=matched_user["username"],
        solved_total=total,
        easy_solved=easy,
        medium_solved=medium,
        hard_solved=hard,
        submission_calendar=_submission_calendar(matched_user.get("submissionCalendar", {})),
        contest_rating=contest_rating,
        global_ranking=global_ranking,
        solved_by_topic=None,
        recent_submissions=recent_submissions,
        total_submissions=total_submissions,
        acceptance_rate=acceptance_rate,
    )


def _optional_profile_data(
    payload: object,
    username: str,
) -> tuple[dict[str, Any] | None, dict[str, int] | None]:
    if not isinstance(payload, dict) or payload.get("errors"):
        raise LeetCodeProviderError(
            "optional_data_unavailable",
            "LeetCode did not provide optional profile information.",
        )
    data = payload.get("data")
    matched_user = data.get("matchedUser") if isinstance(data, dict) else None
    if not isinstance(matched_user, dict):
        return None, None
    returned_username = matched_user.get("username")
    if not isinstance(returned_username, str) or returned_username.casefold() != username.casefold():
        raise LeetCodeProviderError(
            "username_mismatch",
            "LeetCode returned a different profile than requested.",
        )

    raw_profile = matched_user.get("profile")
    profile: dict[str, Any] = {}
    if isinstance(raw_profile, dict):
        fields = {
            "avatar_url": ("userAvatar", 500),
            "real_name": ("realName", 120),
            "about_me": ("aboutMe", 1000),
            "country": ("countryName", 120),
            "school": ("school", 200),
        }
        for output_key, (source_key, max_length) in fields.items():
            value = raw_profile.get(source_key)
            if (
                isinstance(value, str)
                and value.strip()
                and (output_key != "avatar_url" or _is_https_url(value.strip()))
            ):
                profile[output_key] = value.strip()[:max_length]
        websites = raw_profile.get("websites")
        if isinstance(websites, list):
            profile["websites"] = [
                value.strip()[:500]
                for value in websites[:20]
                if isinstance(value, str) and _is_https_url(value.strip())
            ]
        skills = raw_profile.get("skillTags")
        if isinstance(skills, list):
            profile["skills"] = [
                value.strip()[:80]
                for value in skills[:40]
                if isinstance(value, str) and value.strip()
            ]

    raw_topic_counts = matched_user.get("tagProblemCounts")
    topics: dict[str, int] = {}
    if isinstance(raw_topic_counts, dict):
        for category in ("advanced", "intermediate", "fundamental"):
            entries = raw_topic_counts.get(category)
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                topic_name = entry.get("tagName")
                problems_solved = entry.get("problemsSolved")
                if (
                    isinstance(topic_name, str)
                    and topic_name.strip()
                    and _non_negative_integer(problems_solved)
                ):
                    key = topic_name.strip()[:80]
                    existing = next(
                        (topic for topic in topics if topic.casefold() == key.casefold()),
                        None,
                    )
                    topics[existing or key] = max(
                        problems_solved,
                        topics.get(existing or key, 0),
                    )
    return profile or None, topics or None


def fetch_leetcode_stats(
    requested_username: str,
    *,
    client_factory: Callable[..., httpx.Client] = httpx.Client,
    timeout_seconds: float = 8.0,
) -> LeetCodeStats:
    username = normalize_leetcode_username(requested_username)
    with client_factory(timeout=timeout_seconds, follow_redirects=False) as client:
        payload = _request_graphql(client, EXTENDED_QUERY, username)
        if isinstance(payload, dict) and payload.get("errors"):
            payload = _request_graphql(client, BASE_QUERY, username)
        stats = _validate_stats(payload, username)
        try:
            optional_payload = _request_graphql(client, OPTIONAL_PROFILE_QUERY, username)
            public_profile, solved_by_topic = _optional_profile_data(
                optional_payload,
                username,
            )
        except LeetCodeProviderError as error:
            logger.info("Optional LeetCode profile data unavailable (%s).", error.code)
            public_profile, solved_by_topic = None, None

    return replace(
        stats,
        public_profile=public_profile,
        solved_by_topic=solved_by_topic,
    )


def validate_leetcode_username(
    requested_username: str,
    *,
    client_factory: Callable[..., httpx.Client] = httpx.Client,
    timeout_seconds: float = 8.0,
) -> str:
    username = normalize_leetcode_username(requested_username)
    with client_factory(timeout=timeout_seconds, follow_redirects=False) as client:
        payload = _request_graphql(client, USERNAME_QUERY, username)
    if not isinstance(payload, dict) or payload.get("errors"):
        raise LeetCodeProviderError(
            "upstream_graphql_error",
            "LeetCode could not validate the profile.",
        )
    data = payload.get("data")
    matched_user = data.get("matchedUser") if isinstance(data, dict) else None
    if matched_user is None:
        raise LeetCodeProviderError(
            "profile_not_found",
            "The LeetCode profile was not found or is unavailable.",
            status.HTTP_404_NOT_FOUND,
        )
    if (
        not isinstance(matched_user, dict)
        or not isinstance(matched_user.get("username"), str)
        or matched_user["username"].casefold() != username.casefold()
    ):
        raise LeetCodeProviderError(
            "username_mismatch",
            "LeetCode returned a different profile than requested.",
        )
    return matched_user["username"]


def _request_graphql(
    client: httpx.Client,
    query: str,
    username: str,
) -> object:
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "CPHub-public-profile-stats/1.0",
    }
    try:
        with client.stream(
            "POST",
            LEETCODE_GRAPHQL_URL,
            headers=headers,
            json={"query": query, "variables": {"username": username}},
        ) as response:
            if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                        retry_after_header = response.headers.get("retry-after", "")
                        retry_after = (
                            max(MIN_REFRESH_INTERVAL_SECONDS, min(int(retry_after_header), 3600))
                            if len(retry_after_header) <= 6 and retry_after_header.isdigit()
                            else MIN_REFRESH_INTERVAL_SECONDS
                        )
                        raise LeetCodeProviderError(
                            "upstream_rate_limited",
                            "LeetCode is rate limiting requests. Please try again later.",
                            status.HTTP_429_TOO_MANY_REQUESTS,
                            retry_after_seconds=retry_after,
                        )
            if response.status_code >= 500:
                raise LeetCodeProviderError(
                    "upstream_unavailable",
                    "The LeetCode stats provider is temporarily unavailable.",
                )
            if response.status_code != status.HTTP_200_OK:
                raise LeetCodeProviderError(
                    "upstream_http_error",
                    "LeetCode could not provide profile statistics.",
                )

            content_length = response.headers.get("content-length")
            if content_length and content_length.isdigit() and int(content_length) > MAX_RESPONSE_BYTES:
                raise LeetCodeProviderError(
                    "response_too_large",
                    "LeetCode returned an unexpectedly large response.",
                )

            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise LeetCodeProviderError(
                        "response_too_large",
                        "LeetCode returned an unexpectedly large response.",
                    )
    except httpx.TimeoutException as error:
        raise LeetCodeProviderError(
            "upstream_timeout",
            "LeetCode did not respond in time.",
            status.HTTP_504_GATEWAY_TIMEOUT,
        ) from error
    except httpx.RequestError as error:
        raise LeetCodeProviderError(
            "upstream_unavailable",
            "The LeetCode stats provider could not be reached.",
        ) from error

    try:
        return json.loads(body)
    except (UnicodeDecodeError, ValueError) as error:
        raise LeetCodeProviderError(
            "invalid_response",
            "LeetCode returned invalid data.",
        ) from error


def _stats_from_cache(row: dict[str, Any]) -> LeetCodeStatsResponse:
    username = str(row.get("provider_username") or "")
    return LeetCodeStatsResponse(
        username=username,
        profile_url=f"https://leetcode.com/u/{username}/" if username else None,
        public_profile=row.get("public_profile"),
        solved_total=row["solved_total"],
        easy_solved=row["easy_solved"],
        medium_solved=row["medium_solved"],
        hard_solved=row["hard_solved"],
        contest_rating=row.get("contest_rating"),
        global_ranking=row.get("global_ranking"),
        solved_by_topic=row.get("solved_by_topic"),
        recent_submissions=row.get("recent_submissions"),
        total_submissions=row.get("total_submissions"),
        acceptance_rate=row.get("acceptance_rate"),
        submission_calendar=row.get("submission_calendar") or {},
        fetched_at=row["fetched_at"],
    )


def _read_cache(client: Client, user_id: UUID) -> dict[str, Any] | None:
    try:
        response = (
            client.table("leetcode_stats")
            .select(CACHE_COLUMNS)
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode cache lookup failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "stats_cache_unavailable",
                "message": "Cached LeetCode statistics are temporarily unavailable.",
            },
        ) from None
    return response.data if isinstance(response.data, dict) else None


def _read_profile_username(client: Client, user_id: UUID) -> str:
    try:
        response = (
            client.table("profiles")
            .select("leetcode_username")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode profile lookup failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "profile_unavailable",
                "message": "Your profile is temporarily unavailable.",
            },
        ) from None
    profile = response.data
    username = profile.get("leetcode_username") if isinstance(profile, dict) else None
    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "leetcode_username_required",
                "message": "Add a LeetCode username to your profile before refreshing stats.",
            },
        )
    try:
        return normalize_leetcode_username(username)
    except LeetCodeProviderError as error:
        raise HTTPException(
            status_code=error.status_code,
            detail={"code": error.code, "message": error.message},
        ) from None


def get_my_cached_leetcode_stats(
    client: Client,
    user_id: UUID,
) -> LeetCodeRefreshResponse:
    username = _read_profile_username(client, user_id)
    cached_row = _read_cache(client, user_id)
    if (
        not cached_row
        or cached_row.get("fetch_status") != "success"
        or str(cached_row.get("provider_username") or "").casefold() != username.casefold()
    ):
        return LeetCodeRefreshResponse(success=True, cached=True, data=None)
    try:
        stats = _stats_from_cache(cached_row)
    except (KeyError, TypeError, ValueError):
        logger.warning("Saved LeetCode stats were incomplete for an existing profile.")
        return LeetCodeRefreshResponse(success=True, cached=True, data=None)
    return LeetCodeRefreshResponse(success=True, cached=True, data=stats)


def _read_leetcode_account(client: Client, user_id: UUID) -> LeetCodeAccount | None:
    try:
        response = (
            client.table("leetcode_accounts")
            .select("leetcode_username,linked_at,last_synced_at,sync_status")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode account lookup failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_unavailable",
                "message": "Your LeetCode connection is temporarily unavailable.",
            },
        ) from None
    row = response.data
    if not isinstance(row, dict):
        return None
    try:
        sync_status = row["sync_status"]
        return LeetCodeAccount(
            username=None if sync_status == "unlinked" else row["leetcode_username"],
            linked_at=row["linked_at"],
            last_synced_at=row.get("last_synced_at"),
            sync_status=sync_status,
        )
    except (KeyError, TypeError, ValueError):
        logger.error("Saved LeetCode account data was malformed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_unavailable",
                "message": "Your LeetCode connection is temporarily unavailable.",
            },
        ) from None


def get_my_leetcode_account(client: Client, user_id: UUID) -> LeetCodeAccountResponse:
    return LeetCodeAccountResponse(
        success=True,
        cached=True,
        data=_read_leetcode_account(client, user_id),
    )


def get_my_leetcode_sync_status(
    client: Client,
    user_id: UUID,
) -> LeetCodeSyncStatusResponse:
    account = _read_leetcode_account(client, user_id)
    if account is None or account.sync_status == "unlinked" or not account.username:
        return LeetCodeSyncStatusResponse(
            data=LeetCodeSyncStatusData(status="unlinked"),
        )

    username = account.username.casefold()
    try:
        state_response = (
            client.table("leetcode_fetch_state")
            .select("fetch_status,last_attempted_at,lease_until,last_error_code")
            .eq("leetcode_username", username)
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
        log_response = (
            client.table("sync_logs")
            .select("status,error_message,started_at,completed_at")
            .eq("user_id", str(user_id))
            .order("started_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode sync status lookup failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "sync_status_unavailable",
                "message": "LeetCode synchronization status is temporarily unavailable.",
            },
        ) from None

    state_row = state_response.data if isinstance(state_response.data, dict) else {}
    logs = log_response.data if isinstance(log_response.data, list) else []
    latest_log = logs[0] if logs and isinstance(logs[0], dict) else {}
    lease_until_value = state_row.get("lease_until")
    lease_is_active = False
    if isinstance(lease_until_value, str):
        try:
            lease_until = datetime.fromisoformat(lease_until_value.replace("Z", "+00:00"))
            if lease_until.tzinfo is None:
                lease_until = lease_until.replace(tzinfo=timezone.utc)
            lease_is_active = lease_until > datetime.now(timezone.utc)
        except ValueError:
            logger.warning("LeetCode fetch state has an invalid lease timestamp.")
    if state_row.get("fetch_status") == "fetching" and lease_is_active:
        sync_status = "syncing"
    elif account.sync_status == "syncing":
        sync_status = "pending"
    else:
        sync_status = account.sync_status
    error_code = state_row.get("last_error_code") or latest_log.get("error_message")
    error_messages = {
        "upstream_timeout": "LeetCode did not respond in time.",
        "upstream_unavailable": "The LeetCode stats provider could not be reached.",
        "upstream_rate_limited": "LeetCode is temporarily rate limiting requests.",
        "profile_not_found": "The saved LeetCode profile could not be found.",
        "username_mismatch": "LeetCode returned a different profile than requested.",
        "stats_persistence_failed": "Retrieved statistics could not be saved.",
        "provider_error": "LeetCode stats could not be refreshed right now.",
    }

    return LeetCodeSyncStatusResponse(
        data=LeetCodeSyncStatusData(
            username=account.username,
            status=sync_status,
            last_synced_at=account.last_synced_at,
            last_attempted_at=state_row.get("last_attempted_at")
            or latest_log.get("started_at"),
            last_completed_at=latest_log.get("completed_at"),
            error_message=(
                error_messages.get(error_code, "The latest synchronization failed.")
                if sync_status == "error" and error_code
                else None
            ),
        ),
    )


def get_my_leetcode_activity(
    client: Client,
    user_id: UUID,
    limit: int = 365,
) -> LeetCodeActivityResponse:
    username = _read_profile_username(client, user_id)
    cache = _read_cache(client, user_id)
    matching_cache = (
        cache
        if cache
        and str(cache.get("provider_username") or "").casefold() == username.casefold()
        else None
    )
    try:
        response = (
            client.table("user_activity")
            .select("activity_date,problems_solved")
            .eq("user_id", str(user_id))
            .order("activity_date", desc=True)
            .limit(limit)
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode activity lookup failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "activity_unavailable",
                "message": "Cached LeetCode activity is temporarily unavailable.",
            },
        ) from None
    rows = response.data if isinstance(response.data, list) else []
    calendar = matching_cache.get("submission_calendar") if matching_cache else None
    active_dates: set[date] = set()
    if isinstance(calendar, dict):
        for timestamp in calendar:
            if (
                isinstance(timestamp, str)
                and timestamp.isdigit()
                and int(timestamp) <= MAX_ACTIVITY_TIMESTAMP
            ):
                active_dates.add(
                    datetime.fromtimestamp(
                        int(timestamp),
                        tz=timezone.utc,
                    ).date()
                )
    try:
        days = [
            LeetCodeActivityDay(
                activity_date=date.fromisoformat(str(row["activity_date"])[:10]),
                submissions_count=row["problems_solved"],
            )
            for row in rows
            if isinstance(row, dict)
            and date.fromisoformat(str(row["activity_date"])[:10]) in active_dates
        ]
    except (KeyError, TypeError, ValueError):
        logger.error("Saved LeetCode activity data was malformed.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "activity_unavailable",
                "message": "Cached LeetCode activity is temporarily unavailable.",
            },
        ) from None
    fetched_at = matching_cache.get("fetched_at") if matching_cache else None
    available = bool(matching_cache and matching_cache.get("submission_calendar"))
    return LeetCodeActivityResponse(
        success=True,
        cached=True,
        data=LeetCodeActivityData(
            username=username,
            days=days,
            fetched_at=fetched_at,
            available=available,
        ),
    )


def get_my_leetcode_topics(
    client: Client,
    user_id: UUID,
) -> LeetCodeTopicsResponse:
    username = _read_profile_username(client, user_id)
    cache = _read_cache(client, user_id)
    matching_cache = (
        cache
        if cache
        and str(cache.get("provider_username") or "").casefold() == username.casefold()
        else None
    )
    topic_counts = matching_cache.get("solved_by_topic") if matching_cache else None
    available = isinstance(topic_counts, dict)
    topics = (
        sorted(
            (
                LeetCodeTopicStat(topic_name=name, problems_solved=count)
                for name, count in topic_counts.items()
                if isinstance(name, str)
                and isinstance(count, int)
                and not isinstance(count, bool)
                and count >= 0
            ),
            key=lambda topic: (-topic.problems_solved, topic.topic_name.casefold()),
        )[:200]
        if available
        else []
    )
    fetched_at = matching_cache.get("fetched_at") if matching_cache else None
    return LeetCodeTopicsResponse(
        success=True,
        cached=True,
        data=LeetCodeTopicsData(
            username=username,
            topics=topics,
            fetched_at=fetched_at,
            available=available,
        ),
    )


def update_my_leetcode_account(
    client: Client,
    user_id: UUID,
    requested_username: str,
    *,
    validator: Callable[[str], str] = validate_leetcode_username,
) -> LeetCodeAccountResponse:
    username = normalize_leetcode_username(requested_username)
    existing_account = _read_leetcode_account(client, user_id)
    if (
        existing_account
        and existing_account.sync_status != "unlinked"
        and existing_account.username
        and existing_account.username.casefold() == username.casefold()
    ):
        return LeetCodeAccountResponse(
            success=True,
            cached=True,
            data=existing_account,
        )
    try:
        validated_username = validator(username)
    except LeetCodeProviderError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
                if error.code == "profile_not_found"
                else error.status_code
            ),
            detail={
                "code": (
                    "leetcode_profile_not_found"
                    if error.code == "profile_not_found"
                    else error.code
                ),
                "message": (
                    "The LeetCode profile could not be found."
                    if error.code == "profile_not_found"
                    else error.message
                ),
            },
            headers=(
                {"Retry-After": str(error.retry_after_seconds)}
                if error.retry_after_seconds
                else None
            ),
        ) from None
    if (
        not isinstance(validated_username, str)
        or validated_username.casefold() != username.casefold()
    ):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "username_mismatch",
                "message": "LeetCode returned a different profile than requested.",
            },
        )

    try:
        response = (
            client.table("profiles")
            .update({"leetcode_username": username})
            .eq("id", str(user_id))
            .select("id")
            .maybe_single()
            .execute()
        )
    except Exception as error:
        logger.error("LeetCode account update failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_update_failed",
                "message": "Your LeetCode connection could not be updated.",
            },
        ) from None
    if not isinstance(response.data, dict):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "profile_not_found",
                "message": "Your profile could not be found.",
            },
        )
    account = _read_leetcode_account(client, user_id)
    if account is None:
        logger.error("LeetCode account trigger did not create an account row.")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "account_update_failed",
                "message": "Your LeetCode connection could not be saved.",
            },
        )
    return LeetCodeAccountResponse(success=True, cached=False, data=account)


def _finish_failed_fetch(
    client: Client,
    username: str,
    user_id: UUID,
    attempt_token: str,
    code: str,
) -> None:
    try:
        client.rpc(
            "finish_leetcode_fetch_error",
            {
                "p_username": username,
                "p_user_id": str(user_id),
                "p_attempt_token": attempt_token,
                "p_error_code": code,
            },
        ).execute()
    except Exception as error:
        logger.error("LeetCode fetch failure status could not be saved (%s).", type(error).__name__)


def _refresh_error_response(
    *,
    error: LeetCodeProviderError,
    stale_stats: LeetCodeStatsResponse | None,
) -> LeetCodeRefreshResponse:
    return LeetCodeRefreshResponse(
        success=False,
        cached=stale_stats is not None,
        data=stale_stats,
        error=RefreshError(
            code=error.code,
            message=error.message,
            retry_after_seconds=error.retry_after_seconds,
        ),
    )


def refresh_my_leetcode_stats(
    client: Client,
    user_id: UUID,
    cache_ttl_seconds: int,
    *,
    fetcher: Callable[[str], LeetCodeStats] = fetch_leetcode_stats,
    now: datetime | None = None,
) -> tuple[LeetCodeRefreshResponse, int]:
    username = _read_profile_username(client, user_id)
    cached_row = _read_cache(client, user_id)
    stale_stats: LeetCodeStatsResponse | None = None

    if cached_row and cached_row.get("fetch_status") == "success":
        try:
            stale_stats = _stats_from_cache(cached_row)
        except (KeyError, TypeError, ValueError):
            logger.warning("Saved LeetCode stats were incomplete for an existing profile.")
            cached_row = None
            stale_stats = None

    if (
        cached_row
        and stale_stats is not None
        and str(cached_row.get("provider_username", "")).casefold() == username.casefold()
    ):
        try:
            fetched_at = datetime.fromisoformat(
                str(cached_row["fetched_at"]).replace("Z", "+00:00")
            )
            current_time = now or datetime.now(timezone.utc)
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            if current_time - fetched_at < timedelta(seconds=cache_ttl_seconds):
                return (
                    LeetCodeRefreshResponse(success=True, cached=True, data=stale_stats),
                    status.HTTP_200_OK,
                )
        except (KeyError, TypeError, ValueError):
            pass
    elif stale_stats is not None:
        stale_stats = None

    try:
        claim_response = client.rpc(
            "claim_leetcode_fetch",
            {
                "p_username": username,
                "p_user_id": str(user_id),
                "p_min_interval_seconds": MIN_REFRESH_INTERVAL_SECONDS,
                "p_lease_seconds": FETCH_LEASE_SECONDS,
            },
        ).execute()
        claims = claim_response.data
    except Exception as error:
        logger.error("LeetCode refresh could not be claimed (%s).", type(error).__name__)
        return (
            _refresh_error_response(
                error=LeetCodeProviderError(
                    "refresh_unavailable",
                    "A LeetCode refresh could not be started.",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                ),
                stale_stats=stale_stats,
            ),
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    claim = claims[0] if isinstance(claims, list) and claims else None
    attempt_token = claim.get("attempt_token") if isinstance(claim, dict) else None
    if not isinstance(claim, dict) or not claim.get("claimed") or not isinstance(attempt_token, str):
        retry_after = max(
            1,
            int(claim.get("retry_after_seconds") or MIN_REFRESH_INTERVAL_SECONDS)
            if isinstance(claim, dict)
            else MIN_REFRESH_INTERVAL_SECONDS,
        )
        reason = claim.get("reason") if isinstance(claim, dict) else None
        code = "refresh_in_progress" if reason == "in_progress" else "refresh_rate_limited"
        message = (
            "A refresh for this LeetCode profile is already running."
            if reason == "in_progress"
            else "Please wait before refreshing these stats again."
        )
        return (
            LeetCodeRefreshResponse(
                success=False,
                cached=stale_stats is not None,
                data=stale_stats,
                error=RefreshError(code=code, message=message, retry_after_seconds=retry_after),
            ),
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    try:
        stats = fetcher(username)
    except LeetCodeProviderError as error:
        _finish_failed_fetch(client, username, user_id, attempt_token, error.code)
        logger.warning("LeetCode provider refresh failed (%s).", error.code)
        return _refresh_error_response(error=error, stale_stats=stale_stats), error.status_code
    except Exception as error:
        _finish_failed_fetch(client, username, user_id, attempt_token, "provider_error")
        logger.error("LeetCode provider failed unexpectedly (%s).", type(error).__name__)
        failure = LeetCodeProviderError(
            "provider_error",
            "LeetCode stats could not be refreshed right now.",
            status.HTTP_502_BAD_GATEWAY,
        )
        return _refresh_error_response(error=failure, stale_stats=stale_stats), failure.status_code

    prior_calendar = (
        cached_row.get("submission_calendar")
        if cached_row
        and str(cached_row.get("provider_username") or "").casefold()
        == username.casefold()
        else None
    )
    if not stats.submission_calendar and isinstance(prior_calendar, dict) and prior_calendar:
        stats = replace(stats, submission_calendar=prior_calendar)

    try:
        saved = client.rpc(
            "finish_leetcode_fetch_success_v3",
            {
                "p_username": username,
                "p_user_id": str(user_id),
                "p_attempt_token": attempt_token,
                "p_provider_username": stats.provider_username,
                "p_solved_total": stats.solved_total,
                "p_easy_solved": stats.easy_solved,
                "p_medium_solved": stats.medium_solved,
                "p_hard_solved": stats.hard_solved,
                "p_submission_calendar": stats.submission_calendar,
                "p_contest_rating": stats.contest_rating,
                "p_global_ranking": stats.global_ranking,
                "p_solved_by_topic": stats.solved_by_topic,
                "p_recent_submissions": stats.recent_submissions,
                "p_public_profile": stats.public_profile,
                "p_total_submissions": stats.total_submissions,
                "p_acceptance_rate": stats.acceptance_rate,
            },
        ).execute()
        saved_row = saved.data[0] if isinstance(saved.data, list) and saved.data else saved.data
        if not isinstance(saved_row, dict):
            raise ValueError("The stats save RPC returned no row.")
        response_stats = _stats_from_cache(saved_row)
    except Exception as error:
        _finish_failed_fetch(
            client,
            username,
            user_id,
            attempt_token,
            "stats_persistence_failed",
        )
        logger.error("LeetCode stats could not be saved (%s).", type(error).__name__)
        return (
            _refresh_error_response(
                error=LeetCodeProviderError(
                    "stats_persistence_failed",
                    "Stats were retrieved but could not be saved.",
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                ),
                stale_stats=stale_stats,
            ),
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return (
        LeetCodeRefreshResponse(success=True, cached=False, data=response_stats),
        status.HTTP_200_OK,
    )
