from functools import lru_cache

BRANCH_MAPPING = {
    "ct": "CST",
    "am": "AI&ML",
    "cy": "CYBER",
    "cs": "CSE",
    "ad": "AI&DS",
    "ds": "DataSci",
    "ec": "ECE",
    "ra": "ROBOTICS",
    "as": "AEROSPACE",
    "me": "MECH",
}


@lru_cache
def get_branch_mapping() -> dict[str, str]:
    return BRANCH_MAPPING.copy()


def normalize_branch(value: str) -> str:
    normalized = value.strip().casefold()
    mapping = get_branch_mapping()
    for code, name in mapping.items():
        if normalized in (code, name.casefold()):
            return name
    raise ValueError("Select a valid CPHub university branch.")
