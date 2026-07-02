"""In-memory data store — thread-safe dict-based CRUD for v0.1."""

from __future__ import annotations

import copy
import json
import random
import string
import threading
from datetime import date, datetime
from typing import Any, Optional

from app.core.config import settings
from app.db.seed import (
    HOUSEHOLD,
    SEED_AGENT_RUNS,
    SEED_ATTACHMENTS,
    SEED_DEVICES,
    SEED_FAULT_RECORDS,
    SEED_MANUAL_CHUNKS,
    SEED_REMINDERS,
)
from app.services.warranty_service import calc_warranty_status, recompute_device_warranty


def _gen_id(prefix: str) -> str:
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def _today_iso() -> str:
    return date.today().isoformat()


def _deep_copy(obj):
    return copy.deepcopy(obj)


class Store:
    """Thread-safe in-memory data store."""

    def __init__(self):
        self._lock = threading.Lock()
        self._db: dict[str, list[dict]] = {}
        self._seed()

    # ── Seed / Reset ────────────────────────────────────────────────────

    def _seed(self):
        self._db = {
            "devices": _deep_copy(SEED_DEVICES),
            "attachments": _deep_copy(SEED_ATTACHMENTS),
            "reminders": _deep_copy(SEED_REMINDERS),
            "faultRecords": _deep_copy(SEED_FAULT_RECORDS),
            "agentRuns": _deep_copy(SEED_AGENT_RUNS),
            "manualChunks": _deep_copy(SEED_MANUAL_CHUNKS),
        }

    def reset(self):
        with self._lock:
            self._seed()

    # ── Devices ──────────────────────────────────────────────────────────

    def list_devices(self) -> list[dict]:
        with self._lock:
            return [
                recompute_device_warranty(d)
                for d in self._db["devices"]
                if d["householdId"] == settings.HOUSEHOLD_ID
            ]

    def get_device(self, device_id: str) -> Optional[dict]:
        with self._lock:
            for d in self._db["devices"]:
                if d["id"] == device_id:
                    return recompute_device_warranty(d)
        return None

    def create_device(self, data: dict, user_id: str) -> dict:
        with self._lock:
            now = _now_iso()
            ws = calc_warranty_status(data.get("purchaseDate"), data.get("warrantyMonths"))
            device = {
                "id": _gen_id("dev"),
                "householdId": settings.HOUSEHOLD_ID,
                "name": data.get("name", "未命名设备"),
                "brand": data.get("brand"),
                "model": data.get("model"),
                "category": data.get("category", "未分类"),
                "purchaseDate": data.get("purchaseDate"),
                "warrantyMonths": data.get("warrantyMonths"),
                "warrantyExpireDate": ws.expire_date,
                "warrantyStatus": ws.status,
                "serialNumber": data.get("serialNumber"),
                "purchaseChannel": data.get("purchaseChannel"),
                "servicePhone": data.get("servicePhone"),
                "notes": data.get("notes"),
                "createdByUserId": user_id,
                "createdAt": now,
                "updatedAt": now,
            }
            self._db["devices"].append(device)
            return _deep_copy(device)

    def patch_device(self, device_id: str, patch: dict, user_id: str) -> Optional[dict]:
        with self._lock:
            for i, d in enumerate(self._db["devices"]):
                if d["id"] == device_id:
                    updated = {**d, **patch, "id": d["id"], "householdId": d["householdId"],
                               "updatedByUserId": user_id, "updatedAt": _now_iso()}
                    ws = calc_warranty_status(updated.get("purchaseDate"), updated.get("warrantyMonths"))
                    updated["warrantyExpireDate"] = ws.expire_date
                    updated["warrantyStatus"] = ws.status
                    self._db["devices"][i] = updated
                    return _deep_copy(recompute_device_warranty(updated))
        return None

    # ── Attachments ──────────────────────────────────────────────────────

    def list_attachments_by_device(self, device_id: str) -> list[dict]:
        with self._lock:
            return [a for a in self._db["attachments"] if a.get("deviceId") == device_id]

    def get_attachment(self, att_id: str) -> Optional[dict]:
        with self._lock:
            for a in self._db["attachments"]:
                if a["id"] == att_id:
                    return _deep_copy(a)
        return None

    def register_attachment(self, input_data: dict, user_id: str) -> dict:
        with self._lock:
            mime = input_data.get("mimeType", "")
            if mime.startswith("image/"):
                file_type = "image"
            elif mime == "application/pdf":
                file_type = "pdf"
            else:
                file_type = "other"
            att = {
                "id": _gen_id("att"),
                "householdId": settings.HOUSEHOLD_ID,
                "filename": input_data["filename"],
                "mimeType": mime,
                "fileType": file_type,
                "attachmentType": input_data.get("attachmentType") or "other",
                "sizeBytes": input_data.get("sizeBytes"),
                "parseStatus": "pending",
                "createdByUserId": user_id,
                "createdAt": _now_iso(),
            }
            self._db["attachments"].append(att)
            return _deep_copy(att)

    def parse_attachment(self, att_id: str) -> dict:
        """Mock parse — infer attachment type and summary from filename."""
        with self._lock:
            for i, att in enumerate(self._db["attachments"]):
                if att["id"] == att_id:
                    fn = att["filename"].lower()
                    attachment_type = att["attachmentType"]
                    summary = "已解析文件内容"
                    if "订单" in fn or "order" in fn:
                        attachment_type = "order_screenshot"
                        summary = "识别到订单截图：商品名称、购买日期、订单号、金额"
                    elif "发票" in fn or "invoice" in fn:
                        attachment_type = "invoice"
                        summary = "识别到发票：购买方、商品明细、开票日期"
                    elif "说明书" in fn or "manual" in fn or att["mimeType"] == "application/pdf":
                        attachment_type = "manual"
                        summary = "已提取说明书文本，可索引为问答来源"
                    elif "保修" in fn or "warranty" in fn:
                        attachment_type = "warranty_card"
                        summary = "识别到保修卡：保修期、售后电话"
                    elif "故障" in fn or "fault" in fn:
                        attachment_type = "device_photo"
                        summary = "识别到故障照片"
                    updated = {**att, "attachmentType": attachment_type,
                               "parseStatus": "parsed", "parseSummary": summary}
                    self._db["attachments"][i] = updated
                    return _deep_copy(updated)
        raise KeyError(f"Attachment {att_id} not found")

    def set_attachment_parse_status(
        self, att_id: str, status: str, error: Optional[str] = None
    ) -> Optional[dict]:
        with self._lock:
            for i, a in enumerate(self._db["attachments"]):
                if a["id"] == att_id:
                    self._db["attachments"][i] = {
                        **a, "parseStatus": status, "parseError": error,
                    }
                    return _deep_copy(self._db["attachments"][i])
        return None

    def bind_attachments_to_device(self, att_ids: list[str], device_id: str):
        with self._lock:
            self._db["attachments"] = [
                {**a, "deviceId": device_id} if a["id"] in att_ids else a
                for a in self._db["attachments"]
            ]

    # ── Reminders ────────────────────────────────────────────────────────

    def list_reminders(self) -> list[dict]:
        with self._lock:
            items = [r for r in self._db["reminders"]
                     if r["householdId"] == settings.HOUSEHOLD_ID]
            return sorted(items, key=lambda r: r["dueDate"])

    def patch_reminder(self, reminder_id: str, patch: dict, user_id: str) -> Optional[dict]:
        with self._lock:
            for i, r in enumerate(self._db["reminders"]):
                if r["id"] == reminder_id:
                    updated = {**r, **patch, "id": r["id"],
                               "updatedByUserId": user_id, "updatedAt": _now_iso()}
                    self._db["reminders"][i] = updated
                    return _deep_copy(updated)
        return None

    def create_reminder(self, data: dict, user_id: str) -> dict:
        with self._lock:
            now = _now_iso()
            r = {
                "id": _gen_id("rem"),
                "householdId": settings.HOUSEHOLD_ID,
                "deviceId": data.get("deviceId"),
                "type": data.get("type", "custom"),
                "title": data.get("title", "提醒"),
                "description": data.get("description"),
                "dueDate": data.get("dueDate", _today_iso()),
                "status": "pending",
                "source": data.get("source", "agent"),
                "sourceAgentRunId": data.get("sourceAgentRunId"),
                "createdByUserId": user_id,
                "createdAt": now,
                "updatedAt": now,
            }
            self._db["reminders"].append(r)
            return _deep_copy(r)

    # ── Fault Records ────────────────────────────────────────────────────

    def list_fault_records_by_device(self, device_id: str) -> list[dict]:
        with self._lock:
            return [f for f in self._db["faultRecords"] if f["deviceId"] == device_id]

    def create_fault_record(self, data: dict, user_id: str) -> dict:
        with self._lock:
            now = _now_iso()
            fr = {
                "id": _gen_id("fault"),
                "householdId": settings.HOUSEHOLD_ID,
                "deviceId": data.get("deviceId", ""),
                "agentRunId": data.get("agentRunId"),
                "type": data.get("type", "troubleshooting"),
                "title": data.get("title", "故障记录"),
                "symptom": data.get("symptom", ""),
                "riskLevel": data.get("riskLevel", "low"),
                "summary": data.get("summary", ""),
                "serviceScript": data.get("serviceScript"),
                "occurredAt": data.get("occurredAt", now),
                "createdByUserId": user_id,
                "createdAt": now,
            }
            self._db["faultRecords"].append(fr)
            return _deep_copy(fr)

    # ── Agent Runs ───────────────────────────────────────────────────────

    def list_agent_runs(self) -> list[dict]:
        with self._lock:
            items = [r for r in self._db["agentRuns"]
                     if r["householdId"] == settings.HOUSEHOLD_ID]
            return sorted(items, key=lambda r: r["createdAt"], reverse=True)

    def get_agent_run(self, run_id: str) -> Optional[dict]:
        with self._lock:
            for r in self._db["agentRuns"]:
                if r["id"] == run_id:
                    return _deep_copy(r)
        return None

    def upsert_agent_run(self, run: dict):
        with self._lock:
            for i, r in enumerate(self._db["agentRuns"]):
                if r["id"] == run["id"]:
                    self._db["agentRuns"][i] = run
                    return
            self._db["agentRuns"].append(run)

    # ── Manual Chunks ────────────────────────────────────────────────────

    def get_manual_chunks(self, device_id: str) -> list[dict]:
        with self._lock:
            return [c for c in self._db["manualChunks"] if c["deviceId"] == device_id]

    def add_manual_chunk(self, chunk: dict):
        with self._lock:
            self._db["manualChunks"].append(chunk)

    # ── Settings / Export ────────────────────────────────────────────────

    def get_settings(self, user_id: str) -> dict:
        return {
            "userId": user_id,
            "defaultReminderTime": "09:00",
            "categoryOrder": ["厨房设备", "清洁设备", "生活电器", "其他"],
            "exportAvailable": True,
        }

    def export_data(self) -> str:
        with self._lock:
            data = {
                "exportedAt": _now_iso(),
                "household": HOUSEHOLD,
                "devices": self._db["devices"],
                "attachments": self._db["attachments"],
                "reminders": self._db["reminders"],
                "faultRecords": self._db["faultRecords"],
                "agentRuns": self._db["agentRuns"],
            }
        return json.dumps(data, ensure_ascii=False, indent=2, default=str)


# Singleton store
store = Store()
