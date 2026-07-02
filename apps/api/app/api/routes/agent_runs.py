"""Agent run routes — start, list, get, confirm."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.agent.graph import confirm_agent_run, run_agent
from app.db.store import store
from app.schemas import AgentRun, ConfirmRunRequest, StartRunRequest

router = APIRouter(prefix="/agent/runs", tags=["agent"])


@router.post("", response_model=AgentRun, status_code=201)
def start_run(req: StartRunRequest):
    return run_agent(
        user_input=req.inputText,
        device_id=req.context.get("deviceId") if req.context else None,
        attachment_ids=req.attachmentIds or [],
        user_id=req.userId,
        intent_hint=req.intentHint,
    )


@router.get("", response_model=list[AgentRun])
def list_runs():
    return store.list_agent_runs()


@router.get("/{run_id}", response_model=AgentRun)
def get_run(run_id: str):
    r = store.get_agent_run(run_id)
    if not r:
        raise HTTPException(status_code=404, detail="Agent run not found")
    return r


@router.post("/{run_id}/confirm", response_model=AgentRun)
def confirm_run(run_id: str, req: ConfirmRunRequest):
    try:
        return confirm_agent_run(
            run_id=run_id,
            action=req.action,
            user_id=req.userId,
            device_id=req.deviceId,
            patch=req.patch,
        )
    except KeyError:
        raise HTTPException(status_code=404, detail="Agent run not found")
