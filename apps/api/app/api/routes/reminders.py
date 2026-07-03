"""Reminder routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.store import store
from app.schemas import PatchReminderRequest, Reminder

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=list[Reminder])
def list_reminders(db: Session = Depends(get_db)):
    return store.list_reminders(db)


@router.patch("/{reminder_id}", response_model=Reminder)
def patch_reminder(
    reminder_id: str, req: PatchReminderRequest, userId: str = "user_home_a", db: Session = Depends(get_db)
):
    patch = req.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    r = store.patch_reminder(db, reminder_id, patch, userId)
    if not r:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return r
