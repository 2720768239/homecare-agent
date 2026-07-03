from __future__ import annotations

import json
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AgentRunModel, ManualChunkModel


def to_schema(row: AgentRunModel) -> dict:
    result: dict[str, Any] = {
        "id": row.id,
        "householdId": row.household_id,
        "createdByUserId": row.created_by_user_id,
        "intent": row.intent,
        "userInput": row.user_input,
        "status": row.status,
        "deviceId": row.device_id,
        "currentNode": row.current_node,
        "waitingFor": row.waiting_for,
        "resultType": row.result_type,
        "nodePath": json.loads(row.node_path_json) if row.node_path_json else [],
        "errorMessage": row.error_message,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }
    if row.result_json:
        result["result"] = json.loads(row.result_json)
    if row.attachment_ids_json:
        result["attachmentIds"] = json.loads(row.attachment_ids_json)
    if row.context_json:
        result["context"] = json.loads(row.context_json)
    return result


def _run_to_row(run: dict) -> AgentRunModel:
    return AgentRunModel(
        id=run["id"],
        household_id=run["householdId"],
        created_by_user_id=run["createdByUserId"],
        intent=run.get("intent", "unknown"),
        user_input=run["userInput"],
        status=run["status"],
        device_id=run.get("deviceId"),
        current_node=run.get("currentNode"),
        waiting_for=run.get("waitingFor"),
        result_type=run.get("resultType"),
        result_json=json.dumps(run["result"], ensure_ascii=False) if run.get("result") else None,
        node_path_json=json.dumps(run.get("nodePath", []), ensure_ascii=False),
        error_message=run.get("errorMessage"),
        attachment_ids_json=json.dumps(run.get("attachmentIds"), ensure_ascii=False)
        if run.get("attachmentIds") is not None
        else None,
        context_json=json.dumps(run.get("context"), ensure_ascii=False)
        if run.get("context") is not None
        else None,
        created_at=run["createdAt"],
        updated_at=run["updatedAt"],
    )


def list_agent_runs(db: Session, household_id: str) -> list[dict]:
    rows = db.execute(
        select(AgentRunModel).where(AgentRunModel.household_id == household_id)
    ).scalars().all()
    return sorted([to_schema(r) for r in rows], key=lambda r: r["createdAt"], reverse=True)


def get_agent_run(db: Session, run_id: str) -> Optional[dict]:
    row = db.get(AgentRunModel, run_id)
    return to_schema(row) if row else None


def upsert_agent_run(db: Session, run: dict) -> None:
    row = db.get(AgentRunModel, run["id"])
    if row is None:
        db.add(_run_to_row(run))
    else:
        updated = _run_to_row(run)
        for col in AgentRunModel.__table__.columns:
            if col.name == "id":
                continue
            setattr(row, col.name, getattr(updated, col.name))
    db.commit()


def get_manual_chunks(db: Session, device_id: str) -> list[dict]:
    rows = db.execute(
        select(ManualChunkModel).where(ManualChunkModel.device_id == device_id)
    ).scalars().all()
    return [
        {
            "deviceId": r.device_id,
            "attachmentId": r.attachment_id,
            "chunkIndex": r.chunk_index,
            "pageNumber": r.page_number,
            "section": r.section,
            "content": r.content,
        }
        for r in rows
    ]


def add_manual_chunk(db: Session, chunk: dict) -> None:
    row = ManualChunkModel(
        device_id=chunk["deviceId"],
        attachment_id=chunk["attachmentId"],
        chunk_index=chunk["chunkIndex"],
        page_number=chunk.get("pageNumber"),
        section=chunk.get("section"),
        content=chunk["content"],
    )
    db.add(row)
    db.commit()
