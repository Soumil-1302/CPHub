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
    RegistrationDraftResponse,
    RegistrationProfileRequest,
    ProfileUpdateRequest,
    PublicProfileResponse,
)
from app.services.profile_service import (
    complete_registration,
    get_registration_draft,
    get_my_profile as load_my_profile,
    get_public_profile,
    update_my_profile,
    validate_leetcode_profile,
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
    "/me/registration-draft",
    response_model=RegistrationDraftResponse,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        409: {"description": "The caller already has a completed profile."},
    },
)
def get_my_registration_draft(
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> RegistrationDraftResponse:
    return get_registration_draft(client, current_user.id)


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
    request: RegistrationProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> MyProfileResponse:
    get_registration_draft(client, current_user.id)
    validate_leetcode_profile(request.leetcode_username)
    return complete_registration(client, current_user.id, current_user.email, request)


@router.post(
    "/registration",
    response_model=MyProfileResponse,
    status_code=status.HTTP_201_CREATED,
    responses={
        401: {"description": "A valid Supabase access token is required."},
        409: {"description": "The username is taken or registration is already complete."},
        422: {"description": "Registration input failed validation."},
    },
)
def complete_my_registration(
    request: RegistrationProfileRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    client: Client = Depends(get_supabase_admin_client),
) -> MyProfileResponse:
    get_registration_draft(client, current_user.id)
    validate_leetcode_profile(request.leetcode_username)
    return complete_registration(client, current_user.id, current_user.email, request)


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
