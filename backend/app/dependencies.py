import logging
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client
from supabase_auth.errors import (
    AuthApiError,
    AuthInvalidCredentialsError,
    AuthInvalidJwtError,
    AuthRetryableError,
)

from app.config import Settings, get_settings
from app.services.supabase_service import (
    SupabaseConfigurationError,
    create_supabase_admin_client,
    create_supabase_auth_client,
    create_supabase_public_client,
)

logger = logging.getLogger("cphub.api.auth")
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: UUID
    email: str | None = None


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={
            "code": "unauthorized",
            "message": "A valid Bearer access token is required.",
        },
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_bearer_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    return credentials.credentials


def get_supabase_admin_client(
    settings: Settings = Depends(get_settings),
) -> Client:
    try:
        return create_supabase_admin_client(settings)
    except SupabaseConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "supabase_not_configured",
                "message": "Supabase server operations are not configured.",
            },
        ) from error


def get_supabase_public_client(
    settings: Settings = Depends(get_settings),
) -> Client:
    try:
        return create_supabase_public_client(settings)
    except SupabaseConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "supabase_not_configured",
                "message": "Public profile service is not configured.",
            },
        ) from error


def get_current_user(
    access_token: str = Depends(get_bearer_token),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    try:
        auth_client = create_supabase_auth_client(settings)
    except SupabaseConfigurationError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "supabase_not_configured",
                "message": "Authentication service is not configured.",
            },
        ) from error
    except Exception as error:
        logger.error("Supabase Auth client initialization failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "authentication_unavailable",
                "message": "Authentication service is temporarily unavailable.",
            },
        ) from None

    try:
        auth_response = auth_client.auth.get_user(access_token)
    except (AuthInvalidJwtError, AuthInvalidCredentialsError):
        raise _unauthorized() from None
    except AuthApiError as error:
        if 400 <= error.status < 500 and error.status != status.HTTP_429_TOO_MANY_REQUESTS:
            raise _unauthorized() from None
        logger.warning("Supabase Auth token validation is unavailable (HTTP %s).", error.status)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "authentication_unavailable",
                "message": "Authentication service is temporarily unavailable.",
            },
        ) from None
    except AuthRetryableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "authentication_unavailable",
                "message": "Authentication service is temporarily unavailable.",
            },
        ) from None
    except Exception as error:
        logger.error("Supabase Auth token validation failed (%s).", type(error).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "authentication_unavailable",
                "message": "Authentication service is temporarily unavailable.",
            },
        ) from None

    user = getattr(auth_response, "user", None)
    user_id = getattr(user, "id", None)
    try:
        validated_user_id = UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        raise _unauthorized() from None

    user_email = getattr(user, "email", None)
    return AuthenticatedUser(
        id=validated_user_id,
        email=user_email if isinstance(user_email, str) else None,
    )
