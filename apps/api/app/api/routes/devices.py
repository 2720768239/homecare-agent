"""Device CRUD routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.db.store import store
from app.schemas import (
    CreateDeviceRequest,
    Device,
    PatchDeviceRequest,
)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[Device])
def list_devices():
    return store.list_devices()


@router.get("/{device_id}", response_model=Device)
def get_device(device_id: str):
    d = store.get_device(device_id)
    if not d:
        raise HTTPException(status_code=404, detail="Device not found")
    return d


@router.post("", response_model=Device, status_code=201)
def create_device(req: CreateDeviceRequest, userId: str = "user_home_a"):
    return store.create_device(req.model_dump(exclude_none=True), userId)


@router.patch("/{device_id}", response_model=Device)
def patch_device(device_id: str, req: PatchDeviceRequest, userId: str = "user_home_a"):
    patch = req.model_dump(exclude_none=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    d = store.patch_device(device_id, patch, userId)
    if not d:
        raise HTTPException(status_code=404, detail="Device not found")
    return d
