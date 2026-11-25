from uuid import UUID

from supabase import Client

from app.schemas.dashboard import (
    DashboardData,
    DashboardProfile,
    DashboardResponse,
)
from app.services.leetcode_service import get_my_cached_leetcode_stats
from app.services.profile_service import get_my_profile


def get_my_dashboard(
    client: Client,
    user_id: UUID,
    email: str | None,
) -> DashboardResponse:
    profile = get_my_profile(client, user_id, email)
    leetcode_stats = (
        get_my_cached_leetcode_stats(client, user_id).data
        if profile.leetcode_username
        else None
    )
    return DashboardResponse(
        data=DashboardData(
            profile=DashboardProfile(
                username=profile.username,
                display_name=profile.display_name,
                university=profile.university,
                branch=profile.branch,
                year_of_passing=profile.year_of_passing,
                avatar_url=profile.avatar_url,
                is_public=profile.is_public,
                leetcode_username=profile.leetcode_username,
            ),
            leetcode=leetcode_stats,
        )
    )
