import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailOtpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=254)
    intent: Literal["register", "login"]

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().casefold()
        if not EMAIL_PATTERN.fullmatch(normalized):
            raise ValueError("Enter a valid university email address.")
        return normalized


class EmailOtpData(BaseModel):
    message: str


class EmailOtpResponse(BaseModel):
    success: bool = True
    data: EmailOtpData
    error: None = None
