from pydantic import BaseModel

from app.schemas.leetcode import LeetCodeStatsResponse


class DashboardProfile(BaseModel):
    username: str
    display_name: str
    university: str | None = None
    branch: str | None = None
    year_of_passing: int | None = None
    avatar_url: str | None = None
    is_public: bool = True
    leetcode_username: str | None = None


class DashboardData(BaseModel):
    profile: DashboardProfile
    leetcode: LeetCodeStatsResponse | None = None


class DashboardResponse(BaseModel):
    success: bool = True
    data: DashboardData
    error: None = None
