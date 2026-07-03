from __future__ import annotations

import json

from sqlalchemy.orm import Session

from app.db.models import (
    AgentRunModel,
    AttachmentModel,
    DeviceModel,
    FaultRecordModel,
    ManualChunkModel,
    ReminderModel,
)
from app.db.seed import (
    SEED_AGENT_RUNS,
    SEED_ATTACHMENTS,
    SEED_DEVICES,
    SEED_FAULT_RECORDS,
    SEED_MANUAL_CHUNKS,
    SEED_REMINDERS,
)


def _device_row(data: dict) -> DeviceModel:
    return DeviceModel(
        id=data["id"],
        household_id=data["householdId"],
        name=data["name"],
        brand=data.get("brand"),
        model=data.get("model"),
        category=data["category"],
        purchase_date=data.get("purchaseDate"),
        warranty_months=data.get("warrantyMonths"),
        warranty_expire_date=data.get("warrantyExpireDate"),
        warranty_status=data.get("warrantyStatus", "unknown"),
        serial_number=data.get("serialNumber"),
        purchase_channel=data.get("purchaseChannel"),
        service_phone=data.get("servicePhone"),
        notes=data.get("notes"),
        created_by_user_id=data["createdByUserId"],
        updated_by_user_id=data.get("updatedByUserId"),
        created_at=data["createdAt"],
        updated_at=data["updatedAt"],
    )


def _attachment_row(data: dict) -> AttachmentModel:
    return AttachmentModel(
        id=data["id"],
        household_id=data["householdId"],
        device_id=data.get("deviceId"),
        agent_run_id=data.get("agentRunId"),
        filename=data["filename"],
        mime_type=data["mimeType"],
        file_type=data["fileType"],
        attachment_type=data["attachmentType"],
        size_bytes=data.get("sizeBytes"),
        url=data.get("url"),
        parse_status=data["parseStatus"],
        parse_summary=data.get("parseSummary"),
        parse_error=data.get("parseError"),
        created_by_user_id=data["createdByUserId"],
        created_at=data["createdAt"],
    )


def _reminder_row(data: dict) -> ReminderModel:
    return ReminderModel(
        id=data["id"],
        household_id=data["householdId"],
        device_id=data.get("deviceId"),
        type=data["type"],
        title=data["title"],
        description=data.get("description"),
        due_date=data["dueDate"],
        status=data["status"],
        source=data.get("source"),
        source_agent_run_id=data.get("sourceAgentRunId"),
        created_by_user_id=data["createdByUserId"],
        updated_by_user_id=data.get("updatedByUserId"),
        created_at=data["createdAt"],
        updated_at=data["updatedAt"],
    )


def _fault_record_row(data: dict) -> FaultRecordModel:
    return FaultRecordModel(
        id=data["id"],
        household_id=data["householdId"],
        device_id=data["deviceId"],
        agent_run_id=data.get("agentRunId"),
        type=data["type"],
        title=data["title"],
        symptom=data["symptom"],
        risk_level=data["riskLevel"],
        summary=data["summary"],
        service_script=data.get("serviceScript"),
        occurred_at=data["occurredAt"],
        created_by_user_id=data["createdByUserId"],
        created_at=data["createdAt"],
    )


def _agent_run_row(data: dict) -> AgentRunModel:
    return AgentRunModel(
        id=data["id"],
        household_id=data["householdId"],
        created_by_user_id=data["createdByUserId"],
        intent=data["intent"],
        user_input=data["userInput"],
        status=data["status"],
        device_id=data.get("deviceId"),
        current_node=data.get("currentNode"),
        waiting_for=data.get("waitingFor"),
        result_type=data.get("resultType"),
        result_json=json.dumps(data["result"], ensure_ascii=False) if data.get("result") else None,
        node_path_json=json.dumps(data.get("nodePath", []), ensure_ascii=False),
        error_message=data.get("errorMessage"),
        attachment_ids_json=json.dumps(data.get("attachmentIds"), ensure_ascii=False)
        if data.get("attachmentIds")
        else None,
        context_json=json.dumps(data.get("context"), ensure_ascii=False) if data.get("context") else None,
        created_at=data["createdAt"],
        updated_at=data["updatedAt"],
    )


def _manual_chunk_row(data: dict) -> ManualChunkModel:
    return ManualChunkModel(
        device_id=data["deviceId"],
        attachment_id=data["attachmentId"],
        chunk_index=data["chunkIndex"],
        page_number=data.get("pageNumber"),
        section=data.get("section"),
        content=data["content"],
    )


def insert_seed_dataset(db: Session) -> None:
    for row in SEED_DEVICES:
        db.add(_device_row(row))
    for row in SEED_ATTACHMENTS:
        db.add(_attachment_row(row))
    for row in SEED_REMINDERS:
        db.add(_reminder_row(row))
    for row in SEED_FAULT_RECORDS:
        db.add(_fault_record_row(row))
    for row in SEED_AGENT_RUNS:
        db.add(_agent_run_row(row))
    for row in SEED_MANUAL_CHUNKS:
        db.add(_manual_chunk_row(row))
