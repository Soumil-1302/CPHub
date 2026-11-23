import json
from functools import lru_cache
from pathlib import Path


_BRANCH_MAPPING_PATH = (
    Path(__file__).resolve().parents[3]
    / "Frontend"
    / "src"
    / "data"
    / "branches.json"
)


@lru_cache
def get_branch_mapping() -> dict[str, str]:
    try:
        with _BRANCH_MAPPING_PATH.open(encoding="utf-8") as mapping_file:
            data = json.load(mapping_file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError("The shared CPHub branch mapping could not be loaded.") from error

    branches = data.get("branch") if isinstance(data, dict) else None
    if not isinstance(branches, dict) or not branches:
        raise RuntimeError("The shared CPHub branch mapping is invalid.")

    return {
        str(code).strip().casefold(): str(name).strip()
        for code, name in branches.items()
        if str(code).strip() and str(name).strip()
    }


def normalize_branch(value: str) -> str:
    normalized = value.strip().casefold()
    mapping = get_branch_mapping()
    for code, name in mapping.items():
        if normalized in (code, name.casefold()):
            return name
    raise ValueError("Select a valid CPHub university branch.")
