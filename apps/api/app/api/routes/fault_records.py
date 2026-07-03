"""Fault record routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.store import store
from app.schemas import FaultRecord

router = APIRouter(prefix="/fault-records", tags=["fault-records"])


@router.get("/by-device/{device_id}", response_model=list[FaultRecord])
def list_fault_records_by_device(device_id: str, db: Session = Depends(get_db)):
    return store.list_fault_records_by_device(db, device_id)
