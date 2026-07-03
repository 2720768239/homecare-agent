"""Fault record routes."""

from __future__ import annotations

from fastapi import APIRouter

from app.db.store import store
from app.schemas import FaultRecord

router = APIRouter(prefix="/fault-records", tags=["fault-records"])


@router.get("/by-device/{device_id}", response_model=list[FaultRecord])
def list_fault_records_by_device(device_id: str):
    return store.list_fault_records_by_device(device_id)
