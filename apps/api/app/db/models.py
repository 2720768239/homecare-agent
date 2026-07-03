from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class DeviceModel(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String)
    purchase_date: Mapped[str | None] = mapped_column(String, nullable=True)
    warranty_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warranty_expire_date: Mapped[str | None] = mapped_column(String, nullable=True)
    warranty_status: Mapped[str] = mapped_column(String, default="unknown")
    serial_number: Mapped[str | None] = mapped_column(String, nullable=True)
    purchase_channel: Mapped[str | None] = mapped_column(String, nullable=True)
    service_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(String)
    updated_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)


class AttachmentModel(Base):
    __tablename__ = "attachments"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    device_id: Mapped[str | None] = mapped_column(String, nullable=True)
    agent_run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    filename: Mapped[str] = mapped_column(String)
    mime_type: Mapped[str] = mapped_column(String)
    file_type: Mapped[str] = mapped_column(String)
    attachment_type: Mapped[str] = mapped_column(String)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str | None] = mapped_column(String, nullable=True)
    parse_status: Mapped[str] = mapped_column(String)
    parse_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    parse_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class ReminderModel(Base):
    __tablename__ = "reminders"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    device_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    source_agent_run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(String)
    updated_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)


class FaultRecordModel(Base):
    __tablename__ = "fault_records"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    device_id: Mapped[str] = mapped_column(String)
    agent_run_id: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    symptom: Mapped[str] = mapped_column(Text)
    risk_level: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(Text)
    service_script: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[str] = mapped_column(String)
    created_by_user_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String)


class AgentRunModel(Base):
    __tablename__ = "agent_runs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    created_by_user_id: Mapped[str] = mapped_column(String)
    intent: Mapped[str] = mapped_column(String)
    user_input: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String)
    device_id: Mapped[str | None] = mapped_column(String, nullable=True)
    current_node: Mapped[str | None] = mapped_column(String, nullable=True)
    waiting_for: Mapped[str | None] = mapped_column(String, nullable=True)
    result_type: Mapped[str | None] = mapped_column(String, nullable=True)
    result_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    node_path_json: Mapped[str] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    context_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)


class ManualChunkModel(Base):
    __tablename__ = "manual_chunks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String, index=True)
    attachment_id: Mapped[str] = mapped_column(String)
    chunk_index: Mapped[int] = mapped_column(Integer)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text)
