"""POST /auth/login — mock auth for v0.1."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.schemas import LoginRequest, LoginResponse, Session

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    user_cfg = settings.ALLOWED_USERS.get(req.username)
    if not user_cfg or user_cfg["password"] != req.password:
        raise HTTPException(
            status_code=401,
            detail={"error": "INVALID_CREDENTIALS", "message": "账号名或密码错误"},
        )

    session = Session(
        userId=user_cfg["user_id"],
        username=req.username,
        displayName=user_cfg["display_name"],
        householdId=settings.HOUSEHOLD_ID,
        householdName="我的家",
        token=f"mock-token-{user_cfg['user_id']}",
    )
    return LoginResponse(user=session, token=session.token)
