from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from supabase import Client

from app.dependencies import get_supabase_public_client
from app.schemas.leaderboard import LeaderboardResponse
from app.services.leaderboard_service import get_public_leaderboard

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get(
    "",
    response_model=LeaderboardResponse,
    responses={
        422: {"description": "A filter, sort option, or pagination value is invalid."},
        503: {"description": "The public leaderboard is temporarily unavailable."},
    },
)
def get_leaderboard(
    branch: Annotated[str | None, Query(min_length=1, max_length=60)] = None,
    year_of_passing: Annotated[int | None, Query(alias="year", ge=1900, le=2200)] = None,
    sort_by: Literal[
        "total_solved",
        "easy_solved",
        "medium_solved",
        "hard_solved",
    ] = "total_solved",
    sort_order: Literal["asc", "desc"] = "desc",
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str | None, Query(max_length=100)] = None,
    client: Client = Depends(get_supabase_public_client),
) -> LeaderboardResponse:
    return get_public_leaderboard(
        client,
        branch=branch,
        year_of_passing=year_of_passing,
        sort_by=sort_by,
        sort_order=sort_order,
        limit=limit,
        offset=offset,
        search=search,
    )
