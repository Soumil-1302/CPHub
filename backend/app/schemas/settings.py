from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class UserSettingsData(BaseModel):
    is_public: bool
    notification_preferences: dict[str, Any] = Field(default_factory=dict)
    dashboard_preferences: dict[str, Any] = Field(default_factory=dict)


class UserSettingsResponse(BaseModel):
    success: bool = True
    data: UserSettingsData
    error: None = None


class UserSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_public: bool | None = None
    notification_preferences: dict[str, Any] | None = None
    dashboard_preferences: dict[str, Any] | None = None

    @model_validator(mode="after")
    def require_changes(self) -> "UserSettingsUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("Provide at least one setting to update.")
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Settings cannot be null.")
        return self


class AccountDeletionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmation: Literal["DELETE"]


class AccountDeletionResponse(BaseModel):
    success: bool = True
    data: dict[str, str] = Field(
        default_factory=lambda: {"message": "Your CPHub account was deleted."}
    )
    error: None = None
