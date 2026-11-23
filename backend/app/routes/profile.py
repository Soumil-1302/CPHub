from fastapi import APIRouter, Depends, Path, status
from supabase import Client

from app.dependencies import (
    AuthenticatedUser,
    get_current_user,
    get_supabase_admin_client,
    get_supabase_public_client,
)
from app.schemas.profile import (
    MyProfileResponse,
    ProfileCreateRequest,
    ProfileUpdateRequest,
    PublicProfileResponse,
)
from app.services.profile_service import (
    create_profile,
    get_my_profile as load_my_profile,
    get_public_profile,
    update_my_profile,
)

router = APIRouter(prefix="/profile", tags=["profiles"])


@router.get(
    "/me",
    response_model=MyProfileResponse,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        404: {"description": "The authenticated user has not created a profile."},
    },
)
def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> MyProfileResponse:
    return load_my_profile(client, current_user.id, current_user.email)


@router.get(
    "/{username}",
    response_model=PublicProfileResponse,
    responses={
        404: {"description": "The requested public profile does not exist."},
        422: {"description": "The username is invalid."},
    },
)
def get_profile(
    username: str = Path(min_length=3, max_length=30),
    client: Client = Depends(get_supabase_public_client),
) -> PublicProfileResponse:
    return get_public_profile(client, username)


@router.post(
    "",
    response_model=MyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        409: {"description": "The username is already in use or the profile exists."},
        422: {"description": "Profile input failed validation."},
    },
)
def create_my_profile(
    request: ProfileCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> MyProfileResponse:
    return create_profile(client, current_user.id, current_user.email, request)


@router.put(
    "/me",
    response_model=MyProfileResponse,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        404: {"description": "The authenticated user has not created a profile."},
        409: {"description": "The username is already in use."},
        422: {"description": "Profile input failed validation."},
    },
)
def put_my_profile(
    request: ProfileUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> MyProfileResponse:
    return update_my_profile(client, current_user.id, current_user.email, request)
