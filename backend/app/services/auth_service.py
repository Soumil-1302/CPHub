import logging
import re
from typing import Literal

from fastapi import HTTPException, status
from supabase import Client

logger = logging.getLogger("cphub.api.auth")
GENERIC_OTP_MESSAGE = "If the address is eligible, a verification code has been sent."


def _failure(status_code: int = status.HTTP_503_SERVICE_UNAVAILABLE) -> HTTPException:
    if status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        code = "otp_rate_limited"
        message = "Too many verification requests. Please wait before trying again."
    else:
        code = "authentication_unavailable"
        message = "Authentication is temporarily unavailable. Please try again later."
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )


def request_email_otp(
    admin_client: Client,
    auth_client: Client,
    email: str,
    intent: Literal["register", "login"],
) -> str:
    try:
        existence_response = admin_client.rpc(
            "auth_user_exists",
            {"p_email": email},
        ).execute()
        account_exists = bool(existence_response.data)
    except Exception as error:
        logger.error("Supabase account eligibility check failed (%s).", type(error).__name__)
        raise _failure() from None

    should_create_user = intent == "register" and not account_exists
    try:
        auth_client.auth.sign_in_with_otp(
            {
                "email": email,
                "options": {"should_create_user": should_create_user},
            }
        )
    except Exception as error:
        error_status = getattr(error, "status", None)
        error_code = str(getattr(error, "code", "")).casefold()
        error_message = str(getattr(error, "message", "")).casefold()
        if error_status == status.HTTP_429_TOO_MANY_REQUESTS:
            raise _failure(status.HTTP_429_TOO_MANY_REQUESTS) from None
        if (
            intent == "login"
            and isinstance(error_status, int)
            and 400 <= error_status < 500
            and (
                error_code in {"user_not_found", "email_not_found"}
                or re.search(r"\b(user|email)\s+(was\s+)?not found\b", error_message)
            )
        ):
            # Supabase may reject unknown addresses instead of silently omitting email.
            logger.info("Supabase OTP request was not accepted (HTTP %s).", error_status)
            return GENERIC_OTP_MESSAGE
        logger.error("Supabase OTP request failed (%s).", type(error).__name__)
        raise _failure() from None

    return GENERIC_OTP_MESSAGE
