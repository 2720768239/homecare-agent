"""Database-backed storage facade for API routes and agent flows."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.repositories import agent_runs, attachments, devices, fault_records, reminders
from app.db.repositories.seed_repository import insert_seed_dataset
from app.db.seed import HOUSEHOLD
from app.db.models import (
    AgentRunModel,
    AttachmentModel,
    DeviceModel,
    FaultRecordModel,
    ManualChunkModel,
    ReminderModel,
)


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


class Store:
    """Database-backed storage facade for API routes and agent flows."""

    def list_devices(self, db: Session) -> list[dict]:
        return [devices.to_schema(row) for row in devices.list_devices(db, settings.HOUSEHOLD_ID)]

    def get_device(self, db: Session, device_id: str) -> Optional[dict]:
        row = devices.get_device(db, device_id)
        return devices.to_schema(row) if row else None

    def create_device(self, db: Session, data: dict, user_id: str) -> dict:
        return devices.create_device(db, data, user_id, settings.HOUSEHOLD_ID)

    def patch_device(self, db: Session, device_id: str, patch: dict, user_id: str) -> Optional[dict]:
        return devices.patch_device(db, device_id, patch, user_id)

    def list_attachments_by_device(self, db: Session, device_id: str) -> list[dict]:
        return attachments.list_attachments_by_device(db, device_id)

    def get_attachment(self, db: Session, att_id: str) -> Optional[dict]:
        return attachments.get_attachment(db, att_id)

    def register_attachment(self, db: Session, input_data: dict, user_id: str) -> dict:
        return attachments.register_attachment(db, input_data, user_id, settings.HOUSEHOLD_ID)

    def parse_attachment(self, db: Session, att_id: str) -> dict:
        return attachments.parse_attachment(db, att_id)

    def set_attachment_parse_status(
        self, db: Session, att_id: str, status: str, error: Optional[str] = None
    ) -> Optional[dict]:
        return attachments.set_attachment_parse_status(db, att_id, status, error)

    def bind_attachments_to_device(self, db: Session, att_ids: list[str], device_id: str) -> None:
        attachments.bind_attachments_to_device(db, att_ids, device_id)

    def list_reminders(self, db: Session) -> list[dict]:
        return reminders.list_reminders(db, settings.HOUSEHOLD_ID)

    def patch_reminder(self, db: Session, reminder_id: str, patch: dict, user_id: str) -> Optional[dict]:
        return reminders.patch_reminder(db, reminder_id, patch, user_id)

    def create_reminder(self, db: Session, data: dict, user_id: str) -> dict:
        return reminders.create_reminder(db, data, user_id, settings.HOUSEHOLD_ID)

    def list_fault_records_by_device(self, db: Session, device_id: str) -> list[dict]:
        return fault_records.list_fault_records_by_device(db, device_id)

    def create_fault_record(self, db: Session, data: dict, user_id: str) -> dict:
        return fault_records.create_fault_record(db, data, user_id, settings.HOUSEHOLD_ID)

    def list_agent_runs(self, db: Session) -> list[dict]:
        return agent_runs.list_agent_runs(db, settings.HOUSEHOLD_ID)

    def get_agent_run(self, db: Session, run_id: str) -> Optional[dict]:
        return agent_runs.get_agent_run(db, run_id)

    def upsert_agent_run(self, db: Session, run: dict) -> None:
        agent_runs.upsert_agent_run(db, run)

    def get_manual_chunks(self, db: Session, device_id: str) -> list[dict]:
        return agent_runs.get_manual_chunks(db, device_id)

    def add_manual_chunk(self, db: Session, chunk: dict) -> None:
        agent_runs.add_manual_chunk(db, chunk)

    def get_settings(self, user_id: str) -> dict:
        return {
            "userId": user_id,
            "defaultReminderTime": "09:00",
            "categoryOrder": ["厨房设备", "清洁设备", "生活电器", "其他"],
            "exportAvailable": True,
        }

    def export_data(self, db: Session) -> str:
        data = {
            "exportedAt": _now_iso(),
            "household": HOUSEHOLD,
            "devices": self.list_devices(db),
            "attachments": [
                attachments.to_schema(r)
                for r in db.query(AttachmentModel).all()
            ],
            "reminders": self.list_reminders(db),
            "faultRecords": [
                fault_records.to_schema(r)
                for r in db.query(FaultRecordModel).all()
            ],
            "agentRuns": self.list_agent_runs(db),
        }
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)

    def reset(self, db: Session) -> None:
        db.query(ManualChunkModel).delete()
        db.query(AgentRunModel).delete()
        db.query(FaultRecordModel).delete()
        db.query(ReminderModel).delete()
        db.query(AttachmentModel).delete()
        db.query(DeviceModel).delete()
        db.commit()
        insert_seed_dataset(db)
        db.commit()


store = Store()
