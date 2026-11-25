import logging
from typing import Any, Literal

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.leaderboard import (
    LeaderboardData,
    LeaderboardPagination,
    LeaderboardResponse,
    LeaderboardStudent,
    LeaderboardSummary,
)
from app.utils.branch_mapping import get_branch_mapping, normalize_branch

logger = logging.getLogger("cphub.api.leaderboard")
SortField = Literal[
    "total_solved",
    "easy_solved",
    "medium_solved",
    "hard_solved",
]


def _database_rows(data: Any) -> dict[str, Any]:
    if isinstance(data, list) and len(data) == 1 and isinstance(data[0], dict):
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError("Leaderboard database function returned an invalid result.")
    return data


def get_public_leaderboard(
    client: Client,
    *,
    branch: str | None,
    year_of_passing: int | None,
    sort_by: SortField,
    sort_order: Literal["asc", "desc"],
    limit: int,
    offset: int,
    search: str | None,
) -> LeaderboardResponse:
    normalized_branch = None
    if branch is not None:
        try:
            normalized_branch = normalize_branch(branch)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "invalid_branch",
                    "message": str(error),
                },
            ) from error
    branch_values = None
    if normalized_branch is not None:
        normalized_folded = normalized_branch.casefold()
        branch_values = [
            normalized_folded,
            *(
                code.casefold()
                for code, name in get_branch_mapping().items()
                if name.casefold() == normalized_folded
            ),
        ]

    try:
        result = client.rpc(
            "get_public_leaderboard",
            {
                "p_branches": branch_values,
                "p_year_of_passing": year_of_passing,
                "p_sort_by": sort_by,
                "p_sort_order": sort_order,
                "p_limit": limit,
                "p_offset": offset,
                "p_search": search.strip() if search and search.strip() else None,
            },
        ).execute()
        payload = _database_rows(result.data)
        students_raw = payload.get("students")
        summary_raw = payload.get("summary")
        pagination_raw = payload.get("pagination")
        if (
            not isinstance(students_raw, list)
            or not isinstance(summary_raw, dict)
            or not isinstance(pagination_raw, dict)
        ):
            raise ValueError("Leaderboard database function returned an incomplete result.")

        students = []
        for row in students_raw:
            if not isinstance(row, dict):
                raise ValueError("Leaderboard database function returned an invalid student.")
            if isinstance(row.get("branch"), str) and row["branch"].casefold() != "general":
                try:
                    row["branch"] = normalize_branch(row["branch"])
                except ValueError:
                    pass
            students.append(LeaderboardStudent.model_validate(row))
        return LeaderboardResponse(
            data=LeaderboardData(
                students=students,
                summary=LeaderboardSummary.model_validate(summary_raw),
                pagination=LeaderboardPagination.model_validate(pagination_raw),
            )
        )
    except HTTPException:
        raise
    except Exception as error:
        logger.error(
            "Public leaderboard query failed (%s).",
            type(error).__name__,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "leaderboard_unavailable",
                "message": "The leaderboard is temporarily unavailable.",
            },
        ) from None
