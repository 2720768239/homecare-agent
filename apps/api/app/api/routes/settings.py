"""Settings routes — get, export, reset."""

from __future__ import annotations

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.db.store import store
from app.schemas import SettingsModel

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsModel)
def get_settings(userId: str = "user_home_a"):
    return store.get_settings(userId)


@router.get("/export")
def export_data():
    data = store.export_data()
    return JSONResponse(content=json.loads(data))


@router.post("/reset")
def reset_demo_data():
    store.reset()
    return {"ok": True, "message": "Demo data has been reset."}
