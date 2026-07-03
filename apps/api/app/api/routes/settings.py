"""Settings routes — get, export, reset."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.store import store
from app.schemas import SettingsModel

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsModel)
def get_settings(userId: str = "user_home_a"):
    return store.get_settings(userId)


@router.get("/export")
def export_data(db: Session = Depends(get_db)):
    data = store.export_data(db)
    return JSONResponse(content=json.loads(data))


@router.post("/reset")
def reset_demo_data(db: Session = Depends(get_db)):
    store.reset(db)
    return {"ok": True, "message": "Demo data has been reset."}
