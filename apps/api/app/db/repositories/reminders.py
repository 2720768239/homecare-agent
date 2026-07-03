from __future__ import annotations

import random
import string
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ReminderModel


def _gen_id(prefix: str) -> str:
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def _today_iso() -> str:
    return date.today().isoformat()


def to_schema(row: ReminderModel) -> dict:
    return {
        "id": row.id,
        "householdId": row.household_id,
        "deviceId": row.device_id,
        "type": row.type,
        "title": row.title,
        "description": row.description,
        "dueDate": row.due_date,
        "status": row.status,
        "source": row.source,
        "sourceAgentRunId": row.source_agent_run_id,
        "createdByUserId": row.created_by_user_id,
        "updatedByUserId": row.updated_by_user_id,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


def list_reminders(db: Session, household_id: str) -> list[dict]:
    rows = db.execute(
        select(ReminderModel).where(ReminderModel.household_id == household_id)
    ).scalars().all()
    return sorted([to_schema(r) for r in rows], key=lambda r: r["dueDate"])


def patch_reminder(
    db: Session, reminder_id: str, patch: dict, user_id: str
) -> Optional[dict]:
    row = db.get(ReminderModel, reminder_id)
    if row is None:
        return None
    field_map = {
        "status": "status",
        "title": "title",
        "description": "description",
        "dueDate": "due_date",
        "type": "type",
    }
    for api_key, db_key in field_map.items():
        if api_key in patch:
            setattr(row, db_key, patch[api_key])
    row.updated_by_user_id = user_id
    row.updated_at = _now_iso()
    db.commit()
    db.refresh(row)
    return to_schema(row)


def create_reminder(db: Session, data: dict, user_id: str, household_id: str) -> dict:
    now = _now_iso()
    row = ReminderModel(
        id=_gen_id("rem"),
        household_id=household_id,
        device_id=data.get("deviceId"),
        type=data.get("type", "custom"),
        title=data.get("title", "提醒"),
        description=data.get("description"),
        due_date=data.get("dueDate", _today_iso()),
        status="pending",
        source=data.get("source", "agent"),
        source_agent_run_id=data.get("sourceAgentRunId"),
        created_by_user_id=user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_schema(row)
