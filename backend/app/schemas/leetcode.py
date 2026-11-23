from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class RecentSubmission(BaseModel):
    title: str = Field(max_length=200)
    title_slug: str = Field(max_length=200)
    timestamp: str = Field(pattern=r"^\d{1,13}$")
    status: str = Field(max_length=50)
    language: str = Field(max_length=50)


class LeetCodeStatsResponse(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    profile_url: HttpUrl | None = None
    solved_total: int = Field(ge=0)
    easy_solved: int = Field(ge=0)
    medium_solved: int = Field(ge=0)
    hard_solved: int = Field(ge=0)
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
