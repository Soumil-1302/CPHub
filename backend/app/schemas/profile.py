import re
from datetime import date, datetime
from urllib.parse import unquote, urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.branch_mapping import normalize_branch

USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,30}$")
LEETCODE_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")


def validate_year_of_passing(value: int) -> int:
    current_year = date.today().year
    if not current_year <= value <= current_year + 5:
        raise ValueError(
            f"Year of passing must be between {current_year} and {current_year + 5}."
        )
    return value


def normalize_profile_username(value: str) -> str:
    normalized = value.strip().lower()
    if not USERNAME_PATTERN.fullmatch(normalized):
        raise ValueError("Username must be 3-30 characters using letters, numbers, or underscores.")
    return normalized


def leetcode_username_from_url(value: str | None) -> str:
    if value is None or not value.strip():
        return ""

    try:
        parsed = urlsplit(value.strip())
    except ValueError as error:
        raise ValueError("Enter a valid LeetCode profile URL.") from error

    if (
        parsed.scheme != "https"
        or parsed.hostname not in {"leetcode.com", "www.leetcode.com"}
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port not in (None, 443)
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use an HTTPS LeetCode profile URL.")

    path_parts = [unquote(part) for part in parsed.path.strip("/").split("/") if part]
    if len(path_parts) == 2 and path_parts[0].casefold() == "u":
        username = path_parts[1]
    elif len(path_parts) == 1:
        username = path_parts[0]
    else:
        raise ValueError("Use a LeetCode profile URL such as https://leetcode.com/u/username/.")

    if not LEETCODE_USERNAME_PATTERN.fullmatch(username):
        raise ValueError("The LeetCode profile URL contains an invalid username.")
    return username


class ProfileCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str = Field(min_length=3, max_length=30)
    display_name: str = Field(min_length=1, max_length=100)
    branch: str = Field(min_length=1, max_length=60)
    year_of_passing: int = Field(ge=1900, le=2200)
    leetcode_profile_url: str | None = Field(default=None, max_length=512)

    @field_validator("year_of_passing")
    @classmethod
    def validate_year(cls, value: int) -> int:
        return validate_year_of_passing(value)

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        return normalize_profile_username(value)

    @field_validator("display_name", "branch")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field must not be empty.")
        return normalized

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, value: str) -> str:
        return normalize_branch(value)

    @field_validator("leetcode_profile_url")
    @classmethod
    def validate_leetcode_profile_url(cls, value: str | None) -> str | None:
        if value is not None:
            leetcode_username_from_url(value)
        return value.strip() if value else None

    @property
    def leetcode_username(self) -> str:
        return leetcode_username_from_url(self.leetcode_profile_url)


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str | None = Field(default=None, min_length=3, max_length=30)
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    branch: str | None = Field(default=None, min_length=1, max_length=60)
    year_of_passing: int | None = Field(default=None, ge=1900, le=2200)
    leetcode_profile_url: str | None = Field(default=None, max_length=512)

    @field_validator("year_of_passing")
    @classmethod
    def validate_year(cls, value: int | None) -> int | None:
        return validate_year_of_passing(value) if value is not None else None

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str | None) -> str | None:
        return normalize_profile_username(value) if value is not None else None

    @field_validator("display_name", "branch")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("This field must not be empty.")
        return normalized

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, value: str | None) -> str | None:
        return normalize_branch(value) if value is not None else None

    @field_validator("leetcode_profile_url")
    @classmethod
    def validate_leetcode_profile_url(cls, value: str | None) -> str | None:
        if value is not None:
            leetcode_username_from_url(value)
        return value.strip() if value else value

    @model_validator(mode="after")
    def require_changes(self) -> "ProfileUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Provide at least one profile field to update.")
        return self

    def database_updates(self) -> dict[str, object]:
        fields = self.model_dump(exclude_unset=True)
        if "username" in fields and fields["username"] is None:
            raise ValueError("Username cannot be cleared.")
        if "display_name" in fields and fields["display_name"] is None:
            raise ValueError("Display name cannot be cleared.")
        if "branch" in fields and fields["branch"] is None:
            raise ValueError("Branch cannot be cleared.")
        if "year_of_passing" in fields and fields["year_of_passing"] is None:
            raise ValueError("Year of passing cannot be cleared.")

        updates: dict[str, object] = {}
        if "username" in fields:
            updates["username"] = fields["username"]
        if "display_name" in fields:
            updates["display_name"] = fields["display_name"]
        if "branch" in fields:
            updates["branch"] = fields["branch"]
        if "year_of_passing" in fields:
            updates["graduation_year"] = str(fields["year_of_passing"])
        if "leetcode_profile_url" in fields:
            updates["leetcode_username"] = leetcode_username_from_url(
                fields["leetcode_profile_url"]
            )
        return updates


class PublicProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    display_name: str
    branch: str
    year_of_passing: int
    leetcode_username: str | None
    leetcode_profile_url: str | None
    created_at: datetime
    updated_at: datetime


class MyProfileResponse(PublicProfileResponse):
    user_id: UUID
    university_email: str | None
