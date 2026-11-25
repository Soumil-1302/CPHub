import logging
from collections.abc import Sequence
from typing import Any, Literal

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.routes import auth, branches, dashboard, leaderboard, leetcode, profile, settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cphub.api")

app_settings = get_settings()
app = FastAPI(
    title=app_settings.app_name,
    description="Backend API foundation for CPHub.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthData(BaseModel):
    status: str


class HealthResponse(BaseModel):
    success: bool
    data: HealthData
    error: None = None


class ApiError(BaseModel):
    code: str
    message: str
    details: list[dict[str, Any]] | None = None


class ErrorResponse(BaseModel):
    success: Literal[False] = False
    data: None = None
    error: ApiError


def error_response(
    *,
    status_code: int,
    code: str,
    message: str,
    details: Sequence[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    response = ErrorResponse(
        error=ApiError(
            code=code,
            message=message,
            details=list(details) if details else None,
        )
    )
    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(mode="json"),
        headers=headers,
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    _request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code", "http_error"))
        message = str(exc.detail.get("message", "The request could not be completed."))
        details = exc.detail.get("details")
    else:
        code = "http_error"
        message = str(exc.detail)
        details = None

    return error_response(
        status_code=exc.status_code,
        code=code,
        message=message,
        details=details,
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def request_validation_exception_handler(
    _request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    details = [
        {
            "location": [str(part) for part in error.get("loc", ())],
            "message": error.get("msg", "Invalid value."),
            "type": error.get("type", "validation_error"),
        }
        for error in exc.errors()
    ]
    return error_response(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        code="validation_error",
        message="Request validation failed.",
        details=details,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.error("Unhandled API error (%s).", type(exc).__name__)
    return error_response(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        code="internal_server_error",
        message="An unexpected server error occurred.",
    )


app.include_router(profile.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(leetcode.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(branches.router, prefix="/api")


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    return HealthResponse(
        success=True,
        data=HealthData(status="ok"),
    )
