from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import get_my_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get(
    "/me",
    response_model=DashboardResponse,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        404: {"description": "The authenticated user has not created a profile."},
        503: {"description": "Dashboard data is temporarily unavailable."},
    },
)
def get_dashboard(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> DashboardResponse:
    return get_my_dashboard(client, current_user.id, current_user.email)
