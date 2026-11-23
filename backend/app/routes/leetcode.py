from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.schemas.leetcode import LeetCodeRefreshResponse, RefreshError
from app.services.leetcode_service import refresh_my_leetcode_stats

router = APIRouter(prefix="/leetcode", tags=["leetcode"])


@router.post(
    "/refresh",
    response_model=LeetCodeRefreshResponse,
    responses={
        400: {"model": LeetCodeRefreshResponse},
        404: {"model": LeetCodeRefreshResponse},
        429: {"model": LeetCodeRefreshResponse},
        502: {"model": LeetCodeRefreshResponse},
        503: {"model": LeetCodeRefreshResponse},
        504: {"model": LeetCodeRefreshResponse},
    },
)
def refresh_leetcode_stats(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    response_headers = None
    try:
        response, response_status = refresh_my_leetcode_stats(
            client,
            current_user.id,
            settings.leetcode_cache_ttl,
        )
    except HTTPException as error:
        response_headers = error.headers
        detail = error.detail if isinstance(error.detail, dict) else {}
        response = LeetCodeRefreshResponse(
            success=False,
            cached=False,
            error=RefreshError(
                code=str(detail.get("code", "refresh_failed")),
                message=str(detail.get("message", "The LeetCode refresh could not be completed.")),
            ),
        )
        response_status = error.status_code
    return JSONResponse(
        status_code=response_status,
        content=response.model_dump(mode="json"),
        headers=(
            {"Retry-After": str(response.error.retry_after_seconds)}
            if response.error and response.error.retry_after_seconds
            else response_headers
        ),
    )
