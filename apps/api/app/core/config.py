"""Application configuration — v0.1 使用简单 dataclass，无需 pydantic-settings 额外依赖。"""

from __future__ import annotations

import os
from pathlib import Path

from dataclasses import dataclass, field

_API_ROOT = Path(__file__).resolve().parents[2]


def _default_database_url() -> str:
    if url := os.getenv("DATABASE_URL"):
        return url
    db_file = _API_ROOT / "data" / "homecare-agent.db"
    return f"sqlite:///{db_file.as_posix()}"


@dataclass
class Settings:
    API_TITLE: str = "HomeCare Agent API"
    API_VERSION: str = "0.1.0"
    HOUSEHOLD_ID: str = "household_default"
    MOCK_AUTH: bool = True  # v0.1 always true
    DATABASE_URL: str = field(default_factory=_default_database_url)

    ALLOWED_USERS: dict[str, dict[str, str]] = field(default_factory=lambda: {
        "home_a": {
            "password": "home123456",
            "user_id": "user_home_a",
            "display_name": "家庭成员 A",
        },
        "home_b": {
            "password": "home123456",
            "user_id": "user_home_b",
            "display_name": "家庭成员 B",
        },
    })

    CORS_ORIGINS: list[str] = field(default_factory=lambda: ["*"])


settings = Settings()
