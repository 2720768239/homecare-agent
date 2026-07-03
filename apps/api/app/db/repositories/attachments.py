from __future__ import annotations

import random
import string
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AttachmentModel


def _gen_id(prefix: str) -> str:
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def to_schema(row: AttachmentModel) -> dict:
    return {
        "id": row.id,
        "householdId": row.household_id,
        "deviceId": row.device_id,
        "agentRunId": row.agent_run_id,
        "filename": row.filename,
        "mimeType": row.mime_type,
        "fileType": row.file_type,
        "attachmentType": row.attachment_type,
        "sizeBytes": row.size_bytes,
        "url": row.url,
        "parseStatus": row.parse_status,
        "parseSummary": row.parse_summary,
        "parseError": row.parse_error,
        "createdByUserId": row.created_by_user_id,
        "createdAt": row.created_at,
    }


def list_attachments_by_device(db: Session, device_id: str) -> list[dict]:
    rows = db.execute(
        select(AttachmentModel).where(AttachmentModel.device_id == device_id)
    ).scalars().all()
    return [to_schema(r) for r in rows]


def get_attachment(db: Session, att_id: str) -> Optional[dict]:
    row = db.get(AttachmentModel, att_id)
    return to_schema(row) if row else None


def register_attachment(db: Session, input_data: dict, user_id: str, household_id: str) -> dict:
    mime = input_data.get("mimeType", "")
    if mime.startswith("image/"):
        file_type = "image"
    elif mime == "application/pdf":
        file_type = "pdf"
    else:
        file_type = "other"
    row = AttachmentModel(
        id=_gen_id("att"),
        household_id=household_id,
        filename=input_data["filename"],
        mime_type=mime,
        file_type=file_type,
        attachment_type=input_data.get("attachmentType") or "other",
        size_bytes=input_data.get("sizeBytes"),
        parse_status="pending",
        created_by_user_id=user_id,
        created_at=_now_iso(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return to_schema(row)


def parse_attachment(db: Session, att_id: str) -> dict:
    row = db.get(AttachmentModel, att_id)
    if row is None:
        raise KeyError(f"Attachment {att_id} not found")
    fn = row.filename.lower()
    attachment_type = row.attachment_type
    summary = "已解析文件内容"
    if "订单" in fn or "order" in fn:
        attachment_type = "order_screenshot"
        summary = "识别到订单截图：商品名称、购买日期、订单号、金额"
    elif "发票" in fn or "invoice" in fn:
        attachment_type = "invoice"
        summary = "识别到发票：购买方、商品明细、开票日期"
    elif "说明书" in fn or "manual" in fn or row.mime_type == "application/pdf":
        attachment_type = "manual"
        summary = "已提取说明书文本，可索引为问答来源"
    elif "保修" in fn or "warranty" in fn:
        attachment_type = "warranty_card"
        summary = "识别到保修卡：保修期、售后电话"
    elif "故障" in fn or "fault" in fn:
        attachment_type = "device_photo"
        summary = "识别到故障照片"
    row.attachment_type = attachment_type
    row.parse_status = "parsed"
    row.parse_summary = summary
    db.commit()
    db.refresh(row)
    return to_schema(row)


def set_attachment_parse_status(
    db: Session, att_id: str, status: str, error: Optional[str] = None
) -> Optional[dict]:
    row = db.get(AttachmentModel, att_id)
    if row is None:
        return None
    row.parse_status = status
    row.parse_error = error
    db.commit()
    db.refresh(row)
    return to_schema(row)


def bind_attachments_to_device(db: Session, att_ids: list[str], device_id: str) -> None:
    rows = db.execute(
        select(AttachmentModel).where(AttachmentModel.id.in_(att_ids))
    ).scalars().all()
    for row in rows:
        row.device_id = device_id
    db.commit()
