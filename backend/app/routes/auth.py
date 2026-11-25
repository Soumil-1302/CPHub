from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client

from app.config import Settings, get_settings
from app.dependencies import ALLOWED_STUDENT_EMAIL_DOMAIN, get_supabase_admin_client
from app.schemas.auth import EmailOtpData, EmailOtpRequest, EmailOtpResponse
from app.services.auth_service import request_email_otp
from app.services.supabase_service import (
    SupabaseConfigurationError,
    create_supabase_auth_client,
)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post(
    "/otp",
    response_model=EmailOtpResponse,
    responses={
        422: {"description": "Email or login intent failed validation."},
        429: {"description": "Supabase Auth OTP rate limit was reached."},
        503: {"description": "Authentication service is unavailable."},
    },
)
def request_otp(
    request: EmailOtpRequest,
    admin_client: Client = Depends(get_supabase_admin_client),
    settings: Settings = Depends(get_settings),
) -> EmailOtpResponse:
    email_domain = request.email.rpartition("@")[2]
    if email_domain != ALLOWED_STUDENT_EMAIL_DOMAIN:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "student_email_required",
                "message": (
                    f"Use your verified @{ALLOWED_STUDENT_EMAIL_DOMAIN} university email."
                ),
            },
        )

    try:
        auth_client = create_supabase_auth_client(settings)
    except SupabaseConfigurationError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "authentication_unavailable",
                "message": "Authentication is temporarily unavailable. Please try again later.",
            },
        ) from None

    message = request_email_otp(
        admin_client,
        auth_client,
        request.email,
        request.intent,
    )
    return EmailOtpResponse(data=EmailOtpData(message=message))
