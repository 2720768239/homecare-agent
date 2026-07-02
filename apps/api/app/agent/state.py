"""LangGraph state definition for HomeCare Agent."""

from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict


AgentIntent = Literal["create_device", "manual_qa", "warranty_check", "troubleshooting", "unknown"]


class AgentState(TypedDict, total=False):
    """State flowing through the LangGraph agent nodes."""

    user_input: str
    intent: AgentIntent
    device_id: Optional[str]
    attachment_ids: List[str]
    node_path: List[dict]
    result: Optional[dict]          # final AgentResult-compatible dict (has "type" key)
    _ctx: Optional[dict]            # internal context (resolved device, safety info, etc.)
    status: str
    waiting_for: Optional[str]
    error_message: Optional[str]
    user_id: str
    intent_hint: Optional[str]
