from fastapi import APIRouter
from pydantic import BaseModel

from app.utils.branch_mapping import get_branch_mapping

router = APIRouter(prefix="/branches", tags=["branches"])


class BranchListResponse(BaseModel):
    branches: list[str]


@router.get("", response_model=BranchListResponse)
def list_branches() -> BranchListResponse:
    return BranchListResponse(
        branches=sorted(set(get_branch_mapping().values()), key=str.casefold),
    )
