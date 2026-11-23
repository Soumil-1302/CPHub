from pydantic import BaseModel, ConfigDict, Field


class LeaderboardStudent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=30)
    name: str
    usn: str | None = None
    branch: str
    year: str
    leetcode: int = Field(ge=0)
    total: int = Field(ge=0)
    easy_solved: int = Field(ge=0)
    medium_solved: int = Field(ge=0)
    hard_solved: int = Field(ge=0)
    contest_rating: float | None = Field(default=None, ge=0)
    leetcode_username: str | None = None
    leetcode_profile_url: str | None = None
    fetched_at: str | None = None
    rank: int = Field(ge=1)


class LeaderboardSummary(BaseModel):
    total_students: int = Field(ge=0)
    total_solved: int = Field(ge=0)
    active_branch_count: int = Field(ge=0)
    available_branches: list[str]
    available_years: list[str]


class LeaderboardPagination(BaseModel):
    total: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    offset: int = Field(ge=0)
    has_more: bool


class LeaderboardData(BaseModel):
    students: list[LeaderboardStudent]
    summary: LeaderboardSummary
    pagination: LeaderboardPagination


class LeaderboardResponse(BaseModel):
    success: bool = True
    data: LeaderboardData
    error: None = None
