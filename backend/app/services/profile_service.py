import logging
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from pydantic import ValidationError
from supabase import Client

from app.schemas.profile import (
    MyProfileResponse,
    RegistrationDraftResponse,
    RegistrationProfileRequest,
    ProfileUpdateRequest,
    PublicProfileResponse,
    normalize_profile_username,
)
from app.services.leetcode_service import LeetCodeProviderError, validate_leetcode_username

logger = logging.getLogger("cphub.api.profiles")
PROFILE_COLUMNS = (
    "id,username,display_name,full_name,university,usn,branch,graduation_year,leetcode_username,"
    "avatar_url,bio,is_public,created_at,updated_at"
)


def _database_error_code(error: Exception) -> str | None:
    code = getattr(error, "code", None)
    if isinstance(code, str):
        return code
    if isinstance(error, dict):
        value = error.get("code")
        return value if isinstance(value, str) else None
    return None


def _raise_database_error(operation: str, error: Exception) -> None:
    code = _database_error_code(error)
    logger.error("Profile database operation failed (%s, code=%s).", operation, code or "unknown")

    if code == "23505":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "username_taken",
                "message": "That username is already in use.",
            },
        ) from None
    if code == "P0001":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "profile_exists",
                "message": "A profile with a username already exists for this account.",
            },
        ) from None
    if code == "PGRST116":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "profile_not_found",
                "message": "Profile not found.",
            },
        ) from None

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail={
            "code": "profile_operation_failed",
            "message": "The profile could not be processed.",
        },
    ) from None


def _as_profile_row(data: Any) -> dict[str, Any] | None:
    if isinstance(data, list):
        data = data[0] if data else None
    return data if isinstance(data, dict) else None


def _profile_values(row: dict[str, Any]) -> dict[str, Any]:
    leetcode_username = row.get("leetcode_username") or ""
    try:
        year_of_passing = int(row["graduation_year"])
    except (KeyError, TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "invalid_profile_data",
                "message": "The saved profile data could not be processed.",
            },
        ) from error

    return {
        "username": row["username"],
        "display_name": row.get("display_name") or "",
        "full_name": row.get("full_name") or row.get("display_name") or "",
        "university": row.get("university"),
        "usn": row.get("usn"),
        "branch": row.get("branch") or "",
        "year_of_passing": year_of_passing,
        "leetcode_username": leetcode_username or None,
        "avatar_url": row.get("avatar_url"),
        "bio": row.get("bio"),
        "is_public": bool(row.get("is_public", True)),
        "leetcode_profile_url": (
            f"https://leetcode.com/u/{leetcode_username}/" if leetcode_username else None
        ),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _get_profile_by_id(client: Client, user_id: UUID) -> dict[str, Any] | None:
    try:
        response = (
            client.table("profiles")
            .select(PROFILE_COLUMNS)
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception as error:
        _raise_database_error("get_by_id", error)
    return _as_profile_row(response.data)


def get_my_profile(
    client: Client,
    user_id: UUID,
    email: str | None,
) -> MyProfileResponse:
    row = _get_profile_by_id(client, user_id)
    if not row or not row.get("username"):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "profile_not_found",
                "message": "You have not created a profile yet.",
            },
        )
    return MyProfileResponse(
        **_profile_values(row),
        user_id=user_id,
        university_email=email,
    )


def get_registration_draft(
    client: Client,
    user_id: UUID,
) -> RegistrationDraftResponse:
    row = _get_profile_by_id(client, user_id)
    if row and row.get("username"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "profile_exists",
                "message": "Your CPHub profile is already complete.",
            },
        )

    raw_year = row.get("graduation_year") if row else None
    try:
        year_of_passing = int(raw_year) if raw_year else None
    except (TypeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "invalid_profile_data",
                "message": "Your saved registration details could not be loaded.",
            },
        ) from error

    leetcode_username = str(row.get("leetcode_username") or "").strip() if row else ""
    return RegistrationDraftResponse(
        username=row.get("username") if row else None,
        full_name=(
            row.get("full_name") or row.get("display_name")
            if row
            else None
        ),
        university=row.get("university") if row else None,
        branch=row.get("branch") if row else None,
        year_of_passing=year_of_passing,
        leetcode_username=leetcode_username or None,
        leetcode_profile_url=(
            f"https://leetcode.com/u/{leetcode_username}/" if leetcode_username else None
        ),
    )


def complete_registration(
    client: Client,
    user_id: UUID,
    email: str | None,
    request: RegistrationProfileRequest,
) -> MyProfileResponse:
    try:
        response = client.rpc(
            "complete_registration",
            {
                "p_user_id": str(user_id),
                "p_username": request.username,
                "p_full_name": request.full_name,
                "p_university": request.university,
                "p_branch": request.branch,
                "p_graduation_year": request.year_of_passing,
                "p_leetcode_username": request.leetcode_username,
            },
        ).execute()
    except Exception as error:
        _raise_database_error("registration", error)

    row = _as_profile_row(response.data)
    if not row:
        logger.error("Registration RPC returned no profile row.")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": "registration_failed",
                "message": "Your registration could not be completed.",
            },
        )
    return MyProfileResponse(
        **_profile_values(row),
        user_id=user_id,
        university_email=email,
    )


def validate_leetcode_profile(username: str) -> None:
    try:
        validate_leetcode_username(username)
    except LeetCodeProviderError as error:
        if error.code == "profile_not_found":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "leetcode_profile_not_found",
                    "message": "The LeetCode profile could not be found.",
                    "details": [{
                        "location": ["body", "leetcode_username"],
                        "message": "Enter an existing LeetCode username.",
                    }],
                },
            ) from None
        logger.info("LeetCode registration validation failed (%s).", error.code)
        raise HTTPException(
            status_code=error.status_code,
            detail={
                "code": "leetcode_validation_unavailable",
                "message": "Unable to validate the LeetCode profile right now. Please try again.",
            },
            headers=(
                {"Retry-After": str(error.retry_after_seconds)}
                if error.retry_after_seconds
                else None
            ),
        ) from None


def update_my_profile(
    client: Client,
    user_id: UUID,
    email: str | None,
    request: ProfileUpdateRequest,
) -> MyProfileResponse:
    try:
        updates = request.database_updates()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_profile_update",
                "message": str(error),
            },
        ) from error

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "empty_profile_update",
                "message": "Provide at least one profile field to update.",
            },
        )

    leetcode_username = updates.get("leetcode_username")
    if isinstance(leetcode_username, str) and leetcode_username:
        validate_leetcode_profile(leetcode_username)

    try:
        response = (
            client.table("profiles")
            .update(updates)
            .eq("id", str(user_id))
            .select(PROFILE_COLUMNS)
            .maybe_single()
            .execute()
        )
    except Exception as error:
        _raise_database_error("update", error)

    row = _as_profile_row(response.data)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "profile_not_found",
                "message": "You have not created a profile yet.",
            },
        )
    return MyProfileResponse(
        **_profile_values(row),
        user_id=user_id,
        university_email=email,
    )


def get_public_profile(client: Client, username: str) -> PublicProfileResponse:
    try:
        normalized_username = normalize_profile_username(username)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "invalid_username",
                "message": str(error),
            },
        ) from error

    try:
        response = client.rpc(
            "get_public_profile",
            {"p_username": normalized_username},
        ).execute()
    except Exception as error:
        _raise_database_error("get_public", error)

    row = _as_profile_row(response.data)
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "profile_not_found",
                "message": "Profile not found.",
            },
        )
    try:
        return PublicProfileResponse.model_validate(row)
    except (TypeError, ValidationError) as error:
        logger.error(
            "Public profile RPC returned invalid data (%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "profile_data_unavailable",
                "message": "Profile data is temporarily unavailable.",
            },
        ) from None
