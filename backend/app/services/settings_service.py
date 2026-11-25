import logging
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.settings import UserSettingsData, UserSettingsUpdateRequest

logger = logging.getLogger("cphub.api.settings")


def _settings_error(code: str, message: str, status_code: int) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def get_my_settings(client: Client, user_id: UUID) -> UserSettingsData:
    try:
        profile_response = (
            client.table("profiles")
            .select("is_public")
            .eq("id", str(user_id))
            .maybe_single()
            .execute()
        )
        preferences_response = (
            client.table("user_preferences")
            .select("notification_preferences,dashboard_preferences")
            .eq("user_id", str(user_id))
            .maybe_single()
            .execute()
        )
    except Exception as error:
        logger.error("User settings lookup failed (%s).", type(error).__name__)
        raise _settings_error(
            "settings_unavailable",
            "Your settings are temporarily unavailable.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from None

    profile = profile_response.data
    if not isinstance(profile, dict):
        raise _settings_error(
            "profile_not_found",
            "Your profile could not be found.",
            status.HTTP_404_NOT_FOUND,
        )
    preferences = preferences_response.data
    preferences = preferences if isinstance(preferences, dict) else {}
    return UserSettingsData(
        is_public=bool(profile.get("is_public", False)),
        notification_preferences=preferences.get("notification_preferences") or {},
        dashboard_preferences=preferences.get("dashboard_preferences") or {},
    )


def update_my_settings(
    client: Client,
    user_id: UUID,
    request: UserSettingsUpdateRequest,
) -> UserSettingsData:
    fields = request.model_dump(exclude_unset=True)
    if "is_public" in fields:
        try:
            response = (
                client.table("profiles")
                .update({"is_public": fields["is_public"]})
                .eq("id", str(user_id))
                .select("id")
                .maybe_single()
                .execute()
            )
        except Exception as error:
            logger.error("Profile visibility update failed (%s).", type(error).__name__)
            raise _settings_error(
                "settings_update_failed",
                "Your profile visibility could not be updated.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from None
        if not isinstance(response.data, dict):
            raise _settings_error(
                "profile_not_found",
                "Your profile could not be found.",
                status.HTTP_404_NOT_FOUND,
            )

    preference_updates = {
        key: value
        for key, value in fields.items()
        if key in {"notification_preferences", "dashboard_preferences"}
    }
    if preference_updates:
        try:
            preferences = client.table("user_preferences")
            updated = (
                preferences.update(preference_updates)
                .eq("user_id", str(user_id))
                .select("user_id")
                .maybe_single()
                .execute()
            )
            if not isinstance(updated.data, dict):
                initial_preferences = {
                    "user_id": str(user_id),
                    "notification_preferences": {},
                    "dashboard_preferences": {},
                    **preference_updates,
                }
                try:
                    preferences.insert(initial_preferences).execute()
                except Exception as insert_error:
                    if getattr(insert_error, "code", None) != "23505":
                        raise
                    (
                        client.table("user_preferences")
                        .update(preference_updates)
                        .eq("user_id", str(user_id))
                        .execute()
                    )
        except Exception as error:
            logger.error("User preference update failed (%s).", type(error).__name__)
            raise _settings_error(
                "settings_update_failed",
                "Your preferences could not be updated.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            ) from None
    return get_my_settings(client, user_id)


def delete_my_account(client: Client, user_id: UUID) -> None:
    try:
        client.auth.admin.delete_user(str(user_id))
    except Exception as error:
        logger.error("Account deletion failed (%s).", type(error).__name__)
        raise _settings_error(
            "account_deletion_failed",
            "Your account could not be deleted. Please try again or contact support.",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        ) from None
