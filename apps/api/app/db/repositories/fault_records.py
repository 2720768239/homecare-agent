from __future__ import annotations

import random
import string
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import FaultRecordModel


def _gen_id(prefix: str) -> str:
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def to_schema(row: FaultRecordModel) -> dict:
    return {
        "id": row.id,
        "householdId": row.household_id,
        "deviceId": row.device_id,
        "agentRunId": row.agent_run_id,
        "type": row.type,
        "title": row.title,
        "symptom": row.symptom,
        "riskLevel": row.risk_level,
        "summary": row.summary,
        "serviceScript": row.service_script,
        "occurredAt": row.occurred_at,
        "createdByUserId": row.created_by_user_id,
        "createdAt": row.created_at,
    }


def list_fault_records_by_device(db: Session, device_id: str) -> list[dict]:
    rows = db.execute(
        select(FaultRecordModel).where(FaultRecordModel.device_id == device_id)
    ).scalars().all()
    return [to_schema(r) for r in rows]


def create_fault_record(db: Session, data: dict, user_id: str, household_id: str) -> dict:
    now = _now_iso()
    row = FaultRecordModel(
        id=_gen_id("fault"),
        household_id=household_id,
        device_id=data.get("deviceId", ""),
        agent_run_id=data.get("agentRunId"),
        type=data.get("type", "troubleshooting"),
        title=data.get("title", "故障记录"),
        symptom=data.get("symptom", ""),
        risk_level=data.get("riskLevel", "low"),
        summary=data.get("summary", ""),
        service_script=data.get("serviceScript"),
        occurred_at=data.get("occurredAt", now),
        created_by_user_id=user_id,
        created_at=now,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_schema(row)
