from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.schemas.leetcode import (
    LeetCodeAccountResponse,
    LeetCodeAccountUpdateRequest,
    LeetCodeActivityResponse,
    LeetCodeRefreshResponse,
    LeetCodeSyncStatusResponse,
    LeetCodeTopicsResponse,
    RefreshError,
)
from app.services.leetcode_service import (
    get_my_cached_leetcode_stats,
    get_my_leetcode_account,
    get_my_leetcode_activity,
    get_my_leetcode_topics,
    get_my_leetcode_sync_status,
    refresh_my_leetcode_stats,
    update_my_leetcode_account,
)

router = APIRouter(prefix="/leetcode", tags=["leetcode"])


@router.get("/sync-status", response_model=LeetCodeSyncStatusResponse)
def get_my_leetcode_sync_status_route(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeSyncStatusResponse:
    return get_my_leetcode_sync_status(client, current_user.id)


@router.get(
    "/me",
    response_model=LeetCodeRefreshResponse,
    responses={
        400: {"description": "A LeetCode username has not been added to the profile."},
        401: {"description": "A valid Supabase access token is required."},
        503: {"description": "Cached statistics are temporarily unavailable."},
    },
)
@router.get("/profile", response_model=LeetCodeRefreshResponse)
@router.get("/stats", response_model=LeetCodeRefreshResponse)
def get_my_leetcode_stats(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeRefreshResponse:
    return get_my_cached_leetcode_stats(client, current_user.id)


@router.get("/activity", response_model=LeetCodeActivityResponse)
def get_my_leetcode_activity_route(
    limit: int = Query(default=365, ge=1, le=3660),
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeActivityResponse:
    return get_my_leetcode_activity(client, current_user.id, limit)


@router.get("/topics", response_model=LeetCodeTopicsResponse)
def get_my_leetcode_topics_route(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeTopicsResponse:
    return get_my_leetcode_topics(client, current_user.id)


@router.get("/account", response_model=LeetCodeAccountResponse)
def get_my_leetcode_account_route(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeAccountResponse:
    return get_my_leetcode_account(client, current_user.id)


@router.put("/account", response_model=LeetCodeAccountResponse)
def update_my_leetcode_account_route(
    request: LeetCodeAccountUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> LeetCodeAccountResponse:
    return update_my_leetcode_account(
        client,
        current_user.id,
        request.leetcode_username,
    )


@router.post(
    "/sync",
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
@router.post(
    "/refresh",
    response_model=LeetCodeRefreshResponse,
    responses={
        400: {"description": "A LeetCode username has not been added to the profile."},
        401: {"description": "A valid Supabase access token is required."},
        503: {"description": "Cached statistics are temporarily unavailable."},
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
