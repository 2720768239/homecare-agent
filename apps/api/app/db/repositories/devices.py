from __future__ import annotations

import random
import string
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DeviceModel
from app.services.warranty_service import calc_warranty_status, recompute_device_warranty


def _gen_id(prefix: str) -> str:
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def to_schema(row: DeviceModel) -> dict:
    return recompute_device_warranty({
        "id": row.id,
        "householdId": row.household_id,
        "name": row.name,
        "brand": row.brand,
        "model": row.model,
        "category": row.category,
        "purchaseDate": row.purchase_date,
        "warrantyMonths": row.warranty_months,
        "warrantyExpireDate": row.warranty_expire_date,
        "warrantyStatus": row.warranty_status,
        "serialNumber": row.serial_number,
        "purchaseChannel": row.purchase_channel,
        "servicePhone": row.service_phone,
        "notes": row.notes,
        "createdByUserId": row.created_by_user_id,
        "updatedByUserId": row.updated_by_user_id,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    })


def list_devices(db: Session, household_id: str) -> list[DeviceModel]:
    return db.execute(
        select(DeviceModel).where(DeviceModel.household_id == household_id)
    ).scalars().all()


def get_device(db: Session, device_id: str) -> Optional[DeviceModel]:
    return db.get(DeviceModel, device_id)


def create_device(db: Session, data: dict, user_id: str, household_id: str) -> dict:
    now = _now_iso()
    ws = calc_warranty_status(data.get("purchaseDate"), data.get("warrantyMonths"))
    row = DeviceModel(
        id=_gen_id("dev"),
        household_id=household_id,
        name=data.get("name", "未命名设备"),
        brand=data.get("brand"),
        model=data.get("model"),
        category=data.get("category", "未分类"),
        purchase_date=data.get("purchaseDate"),
        warranty_months=data.get("warrantyMonths"),
        warranty_expire_date=ws.expire_date,
        warranty_status=ws.status,
        serial_number=data.get("serialNumber"),
        purchase_channel=data.get("purchaseChannel"),
        service_phone=data.get("servicePhone"),
        notes=data.get("notes"),
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_schema(row)


def patch_device(
    db: Session, device_id: str, patch: dict, user_id: str
) -> Optional[dict]:
    row = db.get(DeviceModel, device_id)
    if row is None:
        return None
    field_map = {
        "name": "name",
        "brand": "brand",
        "model": "model",
        "category": "category",
        "purchaseDate": "purchase_date",
        "warrantyMonths": "warranty_months",
        "serialNumber": "serial_number",
        "purchaseChannel": "purchase_channel",
        "servicePhone": "service_phone",
        "notes": "notes",
    }
    for api_key, db_key in field_map.items():
        if api_key in patch:
            setattr(row, db_key, patch[api_key])
    row.updated_by_user_id = user_id
    row.updated_at = _now_iso()
    ws = calc_warranty_status(row.purchase_date, row.warranty_months)
    row.warranty_expire_date = ws.expire_date
    row.warranty_status = ws.status
    db.commit()
    db.refresh(row)
    return to_schema(row)
