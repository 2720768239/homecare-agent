"""Application configuration — v0.1 使用简单 dataclass，无需 pydantic-settings 额外依赖。"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Settings:
    API_TITLE: str = "HomeCare Agent API"
    API_VERSION: str = "0.1.0"
    HOUSEHOLD_ID: str = "household_default"
    MOCK_AUTH: bool = True  # v0.1 always true

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
