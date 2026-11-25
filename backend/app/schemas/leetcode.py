from datetime import date, datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class RecentSubmission(BaseModel):
    title: str = Field(max_length=200)
    title_slug: str = Field(max_length=200)
    timestamp: str = Field(pattern=r"^\d{1,13}$")
    status: str = Field(max_length=50)
    language: str = Field(max_length=50)


class LeetCodePublicProfile(BaseModel):
    avatar_url: str | None = None
    real_name: str | None = Field(default=None, max_length=120)
    about_me: str | None = Field(default=None, max_length=1000)
    country: str | None = Field(default=None, max_length=120)
    school: str | None = Field(default=None, max_length=200)
    websites: list[str] = Field(default_factory=list, max_length=20)
    skills: list[str] = Field(default_factory=list, max_length=40)


class LeetCodeStatsResponse(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    profile_url: HttpUrl | None = None
    public_profile: LeetCodePublicProfile | None = None
    solved_total: int = Field(ge=0)
    easy_solved: int = Field(ge=0)
    medium_solved: int = Field(ge=0)
    hard_solved: int = Field(ge=0)
    total_submissions: int | None = Field(default=None, ge=0)
    acceptance_rate: float | None = Field(default=None, ge=0, le=100)
    contest_rating: float | None = Field(default=None, ge=0)
    global_ranking: int | None = Field(default=None, ge=0)
    solved_by_topic: dict[str, int] | None = None
    recent_submissions: list[RecentSubmission] | None = None
    submission_calendar: dict[str, int] = Field(default_factory=dict)
    fetched_at: datetime


class RefreshError(BaseModel):
    code: str
    message: str
    retry_after_seconds: int | None = Field(default=None, ge=1)


class LeetCodeRefreshResponse(BaseModel):
    success: bool
    cached: bool
    data: LeetCodeStatsResponse | None = None
    error: RefreshError | None = None


class LeetCodeActivityDay(BaseModel):
    activity_date: date
    submissions_count: int = Field(ge=0)


class LeetCodeActivityData(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    days: list[LeetCodeActivityDay]
    fetched_at: datetime | None = None
    available: bool = True


class LeetCodeActivityResponse(BaseModel):
    success: bool
    cached: bool
    data: LeetCodeActivityData | None = None
    error: RefreshError | None = None


class LeetCodeTopicStat(BaseModel):
    topic_name: str = Field(min_length=1, max_length=80)
    problems_solved: int = Field(ge=0)


class LeetCodeTopicsData(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    topics: list[LeetCodeTopicStat]
    fetched_at: datetime | None = None
    available: bool = True


class LeetCodeTopicsResponse(BaseModel):
    success: bool
    cached: bool
    data: LeetCodeTopicsData | None = None
    error: RefreshError | None = None


class LeetCodeAccount(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str | None = Field(default=None, min_length=1, max_length=40)
    linked_at: datetime
    last_synced_at: datetime | None = None
    sync_status: Literal["pending", "syncing", "success", "error", "unlinked"]


class LeetCodeAccountResponse(BaseModel):
    success: bool
    cached: bool
    data: LeetCodeAccount | None = None
    error: RefreshError | None = None


class LeetCodeSyncStatusData(BaseModel):
    username: str | None = None
    status: Literal["pending", "syncing", "success", "error", "unlinked"]
    last_synced_at: datetime | None = None
    last_attempted_at: datetime | None = None
    last_completed_at: datetime | None = None
    error_message: str | None = None


class LeetCodeSyncStatusResponse(BaseModel):
    success: bool = True
    cached: bool = True
    data: LeetCodeSyncStatusData
    error: RefreshError | None = None


class LeetCodeAccountUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    leetcode_username: str = Field(min_length=1, max_length=40)

    @field_validator("leetcode_username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = value.strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", normalized):
            raise ValueError(
                "LeetCode usernames may contain letters, numbers, underscores, and hyphens."
            )
        return normalized
