from fastapi import APIRouter, Depends
from supabase import Client

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
)
from app.schemas.settings import (
    AccountDeletionRequest,
    AccountDeletionResponse,
    UserSettingsResponse,
    UserSettingsUpdateRequest,
)
from app.services.settings_service import (
    delete_my_account,
    get_my_settings,
    update_my_settings,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/me", response_model=UserSettingsResponse)
def get_settings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> UserSettingsResponse:
    return UserSettingsResponse(data=get_my_settings(client, current_user.id))


@router.put("/me", response_model=UserSettingsResponse)
def put_settings(
    request: UserSettingsUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> UserSettingsResponse:
    return UserSettingsResponse(
        data=update_my_settings(client, current_user.id, request),
    )


@router.delete("/account", response_model=AccountDeletionResponse)
def delete_account(
    request: AccountDeletionRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> AccountDeletionResponse:
    delete_my_account(client, current_user.id)
    return AccountDeletionResponse()
