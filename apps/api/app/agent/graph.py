"""LangGraph graph skeleton — nodes, conditional edges, compile.

Provides `run_agent()` and `confirm_agent_run()` as high-level entry points.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from langgraph.graph import END, StateGraph
from sqlalchemy.orm import Session

from app.agent.state import AgentIntent, AgentState
from app.db.database import SessionLocal
from app.db.store import store
from app.services.intent_service import classify_intent, intent_label
from app.services.safety_service import (
    SAFETY_GUIDANCE,
    SAFETY_MESSAGE,
    SAFETY_TITLE,
    detect_safety_risk,
)
from app.services.warranty_service import (
    add_months,
    calc_warranty_expire_date,
    calc_warranty_status,
)


# ── Helpers ──────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")


def _today_iso() -> str:
    return date.today().isoformat()


def _gen_id(prefix: str) -> str:
    import random, string
    chars = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    ts = datetime.now().strftime("%H%M%S")[-4:]
    return f"{prefix}_{chars}{ts}"


def _node(name: str, status: str = "completed", summary: str = "") -> dict:
    now = _now_iso()
    return {"name": name, "status": status, "startedAt": now, "endedAt": now, "summary": summary}


def _extract_keywords(text: str) -> list[str]:
    """Extract keywords from Chinese text — uses 2-4 char sliding window."""
    stop = {"的", "了", "怎么", "如何", "吗", "呢", "是", "在", "我", "请问", "一下", "帮", "帮忙",
            "什么", "有", "这个", "那个", "哪个", "可以", "能", "会", "要", "没", "不", "就"}
    # Remove punctuation
    cleaned = re.sub(r"[，。？！,.?、\s]", "", text)
    # Remove common stop words by character
    for s in stop:
        cleaned = cleaned.replace(s, "")

    # Generate 2-4 gram keywords
    keywords = set()
    for n in range(2, min(5, len(cleaned) + 1)):
        for i in range(len(cleaned) - n + 1):
            keywords.add(cleaned[i:i+n])

    # Also add the whole cleaned string if short enough
    if 2 <= len(cleaned) <= 6:
        keywords.add(cleaned)

    return list(keywords)


def _db(state: AgentState) -> Session:
    db = (state.get("_ctx") or {}).get("db")
    if db is None:
        raise RuntimeError("Database session missing from agent state")
    return db


def _resolve_device(db: Session, input_text: str, context_device_id: Optional[str] = None):
    devices = store.list_devices(db)
    if context_device_id:
        d = next((x for x in devices if x["id"] == context_device_id), None)
        return {"device": d, "ambiguous": False, "candidates": None}

    matched = []
    for d in devices:
        name = d.get("name", "")
        brand = d.get("brand") or ""
        model = d.get("model") or ""
        if (
            (name and name in input_text)
            or (brand and brand in input_text)
            or (model and model in input_text)
            or (
                name
                and any(
                    seg in input_text
                    for seg in name.split()
                    if len(seg) >= 2
                )
            )
        ):
            matched.append(d)

    # deduplicate
    seen = set()
    unique = []
    for d in matched:
        if d["id"] not in seen:
            seen.add(d["id"])
            unique.append(d)

    if len(unique) == 1:
        return {"device": unique[0], "ambiguous": False, "candidates": None}
    if len(unique) > 1:
        return {"device": None, "ambiguous": True, "candidates": unique}
    return {"device": None, "ambiguous": False, "candidates": None}


# ── Graph Nodes ──────────────────────────────────────────────────────────

def input_normalize(state: AgentState) -> dict:
    return {
        "user_input": state.get("user_input", "").strip(),
        "node_path": state.get("node_path", []) + [_node("input_normalize", "completed", "解析用户输入")],
    }


def intent_classify(state: AgentState) -> dict:
    text = state.get("user_input", "")
    has_attachments = bool(state.get("attachment_ids"))
    hint = state.get("intent_hint")
    intent = classify_intent(text, has_attachments=has_attachments, intent_hint=hint)
    return {
        "intent": intent,
        "node_path": state.get("node_path", []) + [_node("intent_classify", "completed", f"识别为{intent_label(intent)}")],
    }


def resolve_device_context(state: AgentState) -> dict:
    text = state.get("user_input", "")
    ctx_id = state.get("device_id")
    res = _resolve_device(_db(state), text, ctx_id)
    device = res["device"]
    ambiguous = res["ambiguous"]
    candidates = res.get("candidates")

    summary = "未命中设备"
    if device:
        summary = f"命中{device['name']}"
    elif ambiguous:
        summary = "多候选设备"

    return {
        "device_id": device["id"] if device else state.get("device_id"),
        "node_path": state.get("node_path", []) + [_node("resolve_device_context", "completed", summary)],
        # Store internal context in _ctx, not result
        "_ctx": {
            **(state.get("_ctx") or {}),
            "_resolved_device": device,
            "_ambiguous": ambiguous,
            "_candidates": candidates,
        },
    }


def safety_check(state: AgentState) -> dict:
    text = state.get("user_input", "")
    safety = detect_safety_risk(text)
    summary = f"高风险：{'、'.join(safety.matched_keywords)}" if safety.is_high_risk else "普通风险"
    return {
        "node_path": state.get("node_path", []) + [_node("safety_check", "completed", summary)],
        "_ctx": {
            **(state.get("_ctx") or {}),
            "_safety": {
                "is_high_risk": safety.is_high_risk,
                "risk_level": safety.risk_level,
                "matched_keywords": safety.matched_keywords,
            },
        },
    }


def route_by_intent(state: AgentState) -> str:
    intent = state.get("intent", "unknown")
    mapping = {
        "create_device": "create_device_flow",
        "manual_qa": "manual_qa_flow",
        "warranty_check": "warranty_check_flow",
        "troubleshooting": "troubleshooting_flow",
    }
    return mapping.get(intent, "render_result")


# ── create_device flow ──────────────────────────────────────────────────

def create_device_flow(state: AgentState) -> dict:
    db = _db(state)
    att_ids = state.get("attachment_ids", [])
    node_path = state.get("node_path", [])

    node_path.append(_node("load_attachments", "completed", f"加载 {len(att_ids)} 个附件"))

    attachments = []
    for aid in att_ids:
        a = store.get_attachment(db, aid)
        if a:
            attachments.append(a)

    if not attachments:
        node_path.append(_node("extract_device_info", "failed", "没有可解析的附件"))
        return {
            "status": "failed",
            "error_message": "还没有上传资料，请先点 + 上传订单截图、发票、说明书或保修卡。",
            "result": {
                "type": "error",
                "error": {"code": "NO_ATTACHMENTS", "message": "还没有上传资料，请先上传。"},
            },
            "node_path": node_path,
        }

    node_path.append(_node("extract_device_info", "completed", "提取设备字段（mock）"))
    draft = _mock_extract_device_fields(attachments)
    node_path.append(_node("normalize_device_draft", "completed", f"生成设备草稿，置信度 {round(draft['confidence'] * 100)}%"))
    node_path.append(_node("wait_user_confirmation", "completed", "等待用户确认"))

    return {
        "status": "waiting_confirmation",
        "waiting_for": "device_draft_confirmation",
        "result": {
            "type": "device_draft",
            "message": "我从你上传的资料中识别到一台设备，请确认后再创建。",
            "deviceDraft": draft,
        },
        "node_path": node_path,
    }


def _mock_extract_device_fields(attachments: list[dict]) -> dict:
    has_order = any(
        a.get("attachmentType") == "order_screenshot" or "订单" in a.get("filename", "") or "order" in a.get("filename", "").lower()
        for a in attachments
    )
    has_manual = any(
        a.get("attachmentType") == "manual" or "说明书" in a.get("filename", "") or "manual" in a.get("filename", "").lower() or a.get("fileType") == "pdf"
        for a in attachments
    )
    has_warranty = any(
        a.get("attachmentType") == "warranty_card" or "保修" in a.get("filename", "") or "warranty" in a.get("filename", "").lower()
        for a in attachments
    )

    missing: list[str] = []
    if not has_order:
        missing.extend(["purchase_date", "purchase_channel"])
    if not has_warranty:
        missing.append("serial_number")

    purchase_date = _today_iso() if has_order else None
    warranty_months = 24 if has_warranty else 12
    expire_date = calc_warranty_expire_date(purchase_date, warranty_months) if purchase_date else None

    confidence = 0.86 if (has_order and has_manual) else 0.72 if (has_order or has_manual) else 0.6

    suggested_reminders = []
    if purchase_date:
        suggested_reminders.append({
            "type": "warranty_expire",
            "title": "九阳破壁机 Y88 保修即将到期",
            "dueDate": add_months(purchase_date, warranty_months - 1),
        })

    return {
        "id": _gen_id("draft"),
        "name": "九阳破壁机 Y88",
        "brand": "九阳",
        "model": "Y88",
        "category": "厨房设备",
        "purchaseDate": purchase_date,
        "warrantyMonths": warranty_months,
        "warrantyExpireDate": expire_date,
        "serialNumber": "JY-Y88-2026-0001" if has_warranty else None,
        "purchaseChannel": "京东" if has_order else None,
        "confidence": confidence,
        "missingFields": missing,
        "sourceAttachmentIds": [a["id"] for a in attachments],
        "suggestedReminders": suggested_reminders,
        "status": "pending_confirmation",
    }


# ── manual_qa flow ──────────────────────────────────────────────────────

def manual_qa_flow(state: AgentState) -> dict:
    db = _db(state)
    ctx = state.get("_ctx") or {}
    node_path = state.get("node_path", [])
    device = ctx.get("_resolved_device")
    ambiguous = ctx.get("_ambiguous", False)
    candidates = ctx.get("_candidates")

    if ambiguous or (not device and not state.get("device_id")):
        cands = (candidates or store.list_devices(db)[:3])
        node_path.append(_node("wait_device_selection", "completed", "等待用户选择设备"))
        return {
            "status": "waiting_confirmation",
            "waiting_for": "device_selection",
            "result": {
                "type": "device_selection_required",
                "message": "你说的是哪台设备？",
                "candidates": [
                    {"id": c["id"], "name": c["name"], "brand": c.get("brand"),
                     "model": c.get("model"), "category": c.get("category"),
                     "warrantyStatus": c.get("warrantyStatus", "unknown")}
                    for c in cands
                ],
            },
            "node_path": node_path,
        }

    if not device:
        return {
            "status": "failed",
            "error_message": "没有找到对应设备。",
            "result": {"type": "error", "error": {"code": "NO_DEVICE", "message": "没有找到对应设备。"}},
            "node_path": node_path,
        }

    device_id = device["id"]
    node_path.append(_node("check_manual_exists", "completed"))

    chunks = store.get_manual_chunks(db, device_id)
    manual_att = None
    for a in store.list_attachments_by_device(db, device_id):
        if a.get("attachmentType") == "manual":
            manual_att = a
            break

    if not chunks or not manual_att:
        node_path.append(_node("retrieve_manual_chunks", "skipped", "无说明书"))
        node_path.append(_node("persist_agent_run", "completed", "已记录"))
        return {
            "status": "completed",
            "result": {
                "type": "manual_no_source",
                "manualNoSourceReason": "no_manual",
                "message": "这台设备还没有上传说明书。上传说明书后，我可以帮你回答使用方法、故障代码和保养步骤。",
            },
            "node_path": node_path,
        }

    # mock keyword retrieval
    keywords = _extract_keywords(state.get("user_input", ""))
    scored = []
    for c in chunks:
        score = sum(1 for k in keywords if k in c.get("content", "") or k in (c.get("section") or ""))
        if score > 0:
            scored.append((c, score))
    scored.sort(key=lambda x: -x[1])

    if not scored:
        node_path.append(_node("generate_manual_answer", "skipped", "未命中答案"))
        node_path.append(_node("persist_agent_run", "completed", "已记录"))
        return {
            "status": "completed",
            "result": {
                "type": "manual_no_source",
                "manualNoSourceReason": "answer_not_found",
                "message": "我没有在这台设备的说明书中找到明确答案。你可以换个问法，或上传更完整的说明书。",
            },
            "node_path": node_path,
        }

    top = scored[0][0]
    node_path.append(_node("retrieve_manual_chunks", "completed", f"检索到 {len(scored)} 条片段"))

    content = top.get("content", "")
    steps = None
    if re.search(r"清洗|更换|安装|操作", content):
        parts = [s.strip() for s in re.split(r"[：:；;]", content) if s.strip()]
        if len(parts) > 1:
            steps = parts[1:]

    answer = {
        "summary": re.split(r"[，。；;]", content)[0],
        "steps": steps,
        "sources": [{
            "attachmentId": manual_att["id"],
            "fileName": manual_att["filename"],
            "pageNumber": top.get("pageNumber"),
            "section": top.get("section"),
            "snippet": content,
        }],
    }

    node_path.append(_node("generate_manual_answer", "completed", "生成结构化答案"))
    node_path.append(_node("persist_agent_run", "completed", "已记录"))

    return {
        "status": "completed",
        "device_id": device_id,
        "result": {"type": "manual_answer", "manualAnswer": answer},
        "node_path": node_path,
    }


# ── warranty_check flow ─────────────────────────────────────────────────

def warranty_check_flow(state: AgentState) -> dict:
    db = _db(state)
    ctx = state.get("_ctx") or {}
    node_path = state.get("node_path", [])
    device = ctx.get("_resolved_device")
    ambiguous = ctx.get("_ambiguous", False)
    candidates = ctx.get("_candidates")

    if ambiguous or (not device and not state.get("device_id")):
        cands = candidates or store.list_devices(db)[:3]
        node_path.append(_node("wait_device_selection", "completed", "等待用户选择设备"))
        return {
            "status": "waiting_confirmation",
            "waiting_for": "device_selection",
            "result": {
                "type": "device_selection_required",
                "message": "你想查询哪台设备的保修？",
                "candidates": [
                    {"id": c["id"], "name": c["name"], "brand": c.get("brand"),
                     "model": c.get("model"), "category": c.get("category"),
                     "warrantyStatus": c.get("warrantyStatus", "unknown")}
                    for c in cands
                ],
            },
            "node_path": node_path,
        }

    if not device:
        return {
            "status": "failed",
            "error_message": "没有找到对应设备。",
            "result": {"type": "error", "error": {"code": "NO_DEVICE", "message": "没有找到对应设备。"}},
            "node_path": node_path,
        }

    ws = calc_warranty_status(device.get("purchaseDate"), device.get("warrantyMonths"))
    node_status = "failed" if ws.status == "unknown" else "completed"
    node_summary = "缺少购买日期或保修期" if ws.status == "unknown" else f"状态 {ws.status}"
    node_path.append(_node("calculate_warranty_status", node_status, node_summary))

    wr = {
        "deviceId": device["id"],
        "deviceName": device["name"],
        "purchaseDate": device.get("purchaseDate"),
        "warrantyMonths": device.get("warrantyMonths"),
        "status": ws.status,
    }
    if ws.status == "unknown":
        wr_result = {
            **wr,
            "message": "这台设备缺少购买日期或保修期，无法计算保修状态。可以在设备详情里补充信息。",
        }
    else:
        wr_result = {
            **wr,
            "warrantyExpireDate": ws.expire_date,
            "daysRemaining": ws.days_remaining,
        }

    node_path.append(_node("persist_agent_run", "completed", "已记录"))
    return {
        "status": "completed",
        "device_id": device["id"],
        "result": {"type": "warranty_check_result", "warrantyResult": wr_result},
        "node_path": node_path,
    }


# ── troubleshooting flow ────────────────────────────────────────────────

def troubleshooting_flow(state: AgentState) -> dict:
    db = _db(state)
    ctx = state.get("_ctx") or {}
    node_path = state.get("node_path", [])
    device = ctx.get("_resolved_device")
    ambiguous = ctx.get("_ambiguous", False)
    candidates = ctx.get("_candidates")
    safety_info = ctx.get("_safety", {})

    # Safety check takes PRIORITY over device selection — even if device is
    # ambiguous or not resolved, high-risk safety content must be blocked first.
    if safety_info.get("is_high_risk"):
        device_id = device["id"] if device else state.get("device_id")
        node_path.append(_node("render_result", "completed", "高风险拒答"))
        node_path.append(_node("persist_agent_run", "completed", "已记录"))
        return {
            "status": "completed",
            "device_id": device_id,
            "result": {
                "type": "safety_blocked",
                "safetyBlocked": {
                    "deviceId": device_id,
                    "deviceName": device["name"] if device else "未知设备",
                    "riskKeywords": safety_info["matched_keywords"],
                    "title": SAFETY_TITLE,
                    "message": SAFETY_MESSAGE,
                    "guidance": SAFETY_GUIDANCE,
                },
            },
            "node_path": node_path,
        }

    if ambiguous or (not device and not state.get("device_id")):
        cands = candidates or store.list_devices(db)[:3]
        node_path.append(_node("wait_device_selection", "completed", "等待用户选择设备"))
        return {
            "status": "waiting_confirmation",
            "waiting_for": "device_selection",
            "result": {
                "type": "device_selection_required",
                "message": "你说的是哪台设备出了故障？",
                "candidates": [
                    {"id": c["id"], "name": c["name"], "brand": c.get("brand"),
                     "model": c.get("model"), "category": c.get("category"),
                     "warrantyStatus": c.get("warrantyStatus", "unknown")}
                    for c in cands
                ],
            },
            "node_path": node_path,
        }

    if not device:
        return {
            "status": "failed",
            "error_message": "没有找到对应设备。",
            "result": {"type": "error", "error": {"code": "NO_DEVICE", "message": "没有找到对应设备。"}},
            "node_path": node_path,
        }

    ws = calc_warranty_status(device.get("purchaseDate"), device.get("warrantyMonths"))
    node_path.append(_node("calculate_warranty_status", "completed", f"状态 {ws.status}"))
    node_path.append(_node("generate_troubleshooting_result", "completed", "生成排查步骤"))

    tr = _build_troubleshooting_result(device, ws.status, state.get("user_input", ""))
    node_path.append(_node("render_result", "completed", "已生成故障结果"))
    node_path.append(_node("persist_agent_run", "completed", "已记录"))

    return {
        "status": "completed",
        "device_id": device["id"],
        "result": {"type": "troubleshooting_result", "troubleshooting": tr},
        "node_path": node_path,
    }


def _build_troubleshooting_result(dev: dict, ws: str, user_input: str) -> dict:
    symptom = re.sub(r"我的|这台|这个|了|怎么办|怎么修|坏了", "", user_input).strip() or "设备故障"
    actions: list[str] = []
    support_message = ""
    materials = ["订单截图", "设备序列号", "故障照片"]
    safety_alert = None

    if "漏水" in user_input:
        actions = ["关闭进水阀", "断开电源", "擦干周围水渍", "拍照记录漏水位置"]
        safety_alert = {"level": "warning", "title": "安全提醒", "message": "先关闭进水阀并断开电源，再检查漏水位置。"}
        support_message = f"您好，我的{dev['name']}出现漏水，已关闭进水阀并拍照，序列号{dev.get('serialNumber') or '（待补充）'}，请问如何安排上门检测？"
    elif re.search(r"异响|噪音", user_input):
        actions = ["断开电源", "检查是否有异物卡住", "拍照记录故障现象"]
        safety_alert = {"level": "warning", "title": "安全提醒", "message": "检查前请先断开电源，避免带电操作。"}
        support_message = f"您好，我的{dev['name']}运行时有异响，已断电检查未见明显异物，序列号{dev.get('serialNumber') or '（待补充）'}，请问是否需要送修？"
    elif re.search(r"不制冷|不工作|不开机", user_input):
        actions = ["检查电源是否接通", "检查插座与电源线", "尝试重新通电"]
        support_message = f"您好，我的{dev['name']}无法正常工作，已检查电源仍未恢复，序列号{dev.get('serialNumber') or '（待补充）'}，请协助处理。"
    else:
        actions = ["断开电源", "拍照记录故障现象", "保留现场"]
        support_message = f"您好，我的{dev['name']}出现问题：{symptom}，序列号{dev.get('serialNumber') or '（待补充）'}，请协助处理。"

    return {
        "deviceId": dev["id"],
        "deviceName": dev["name"],
        "warrantyStatus": ws,
        "riskLevel": "low",
        "safetyAlert": safety_alert,
        "actions": actions,
        "supportMessage": support_message,
        "materials": materials,
        "canSaveRecord": True,
    }


# ── render_result (fallback for unknown intent) ─────────────────────────

def render_result(state: AgentState) -> dict:
    result = state.get("result")
    node_path = state.get("node_path", [])

    if not result or (result.get("type") == "error" and result.get("error", {}).get("code") == "UNKNOWN_INTENT"):
        return {
            "status": "failed",
            "error_message": "无法识别你的意图，可以试试上传资料建档，或问我说明书、保修、故障问题。",
            "result": {"type": "error", "error": {"code": "UNKNOWN_INTENT", "message": "无法识别意图"}},
            "node_path": node_path + [_node("route_by_intent", "skipped", "无法识别意图")],
        }

    # If result already set by a flow node, just pass through
    return {"node_path": node_path}


def persist_agent_run(state: AgentState) -> dict:
    # The actual persist happens outside the graph in run_agent()
    return {}


# ── Build and compile graph ─────────────────────────────────────────────

def build_graph() -> StateGraph:
    g = StateGraph(AgentState)

    # Add nodes
    g.add_node("input_normalize", input_normalize)
    g.add_node("intent_classify", intent_classify)
    g.add_node("resolve_device_context", resolve_device_context)
    g.add_node("safety_check", safety_check)
    g.add_node("create_device_flow", create_device_flow)
    g.add_node("manual_qa_flow", manual_qa_flow)
    g.add_node("warranty_check_flow", warranty_check_flow)
    g.add_node("troubleshooting_flow", troubleshooting_flow)
    g.add_node("render_result", render_result)
    g.add_node("persist_agent_run", persist_agent_run)

    # Edges
    g.set_entry_point("input_normalize")
    g.add_edge("input_normalize", "intent_classify")
    g.add_edge("intent_classify", "resolve_device_context")
    g.add_edge("resolve_device_context", "safety_check")

    # Conditional edge from safety_check to intent-specific flow or render_result
    g.add_conditional_edges(
        "safety_check",
        route_by_intent,
        {
            "create_device_flow": "create_device_flow",
            "manual_qa_flow": "manual_qa_flow",
            "warranty_check_flow": "warranty_check_flow",
            "troubleshooting_flow": "troubleshooting_flow",
            "render_result": "render_result",
        },
    )

    # All flow nodes → persist → END
    for flow in ["create_device_flow", "manual_qa_flow", "warranty_check_flow", "troubleshooting_flow", "render_result"]:
        g.add_edge(flow, "persist_agent_run")
    g.add_edge("persist_agent_run", END)

    return g


# Compiled graph singleton
compiled_graph = build_graph().compile()


# ── High-level API ──────────────────────────────────────────────────────

def run_agent(
    user_input: str,
    device_id: Optional[str] = None,
    attachment_ids: Optional[list[str]] = None,
    user_id: str = "user_home_a",
    intent_hint: Optional[str] = None,
    db: Optional[Session] = None,
) -> dict:
    """Execute the LangGraph agent and return an AgentRun dict."""

    def _execute(session: Session) -> dict:
        now = _now_iso()
        initial_state: AgentState = {
            "user_input": user_input,
            "device_id": device_id,
            "attachment_ids": attachment_ids or [],
            "user_id": user_id,
            "intent_hint": intent_hint,
            "node_path": [],
            "status": "running",
            "result": None,
            "_ctx": {"db": session},
            "waiting_for": None,
            "error_message": None,
        }

        final_state = compiled_graph.invoke(initial_state)

        run = {
            "id": _gen_id("run"),
            "householdId": "household_default",
            "createdByUserId": user_id,
            "intent": final_state.get("intent", "unknown"),
            "userInput": user_input,
            "status": final_state.get("status", "failed"),
            "deviceId": final_state.get("device_id"),
            "waitingFor": final_state.get("waiting_for"),
            "resultType": (final_state.get("result") or {}).get("type"),
            "result": final_state.get("result"),
            "nodePath": final_state.get("node_path", []),
            "errorMessage": final_state.get("error_message"),
            "attachmentIds": attachment_ids or [],
            "context": {"deviceId": device_id} if device_id else None,
            "createdAt": now,
            "updatedAt": _now_iso(),
        }

        if run["status"] == "waiting_confirmation":
            run["currentNode"] = "wait_user_confirmation"

        store.upsert_agent_run(session, run)
        return store.get_agent_run(session, run["id"])

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)


def confirm_agent_run(
    run_id: str,
    action: str,
    user_id: str = "user_home_a",
    device_id: Optional[str] = None,
    patch: Optional[dict] = None,
    db: Optional[Session] = None,
) -> dict:
    """Handle user confirmation actions on an existing AgentRun."""

    def _execute(session: Session) -> dict:
        run = store.get_agent_run(session, run_id)
        if not run:
            raise KeyError(f"Run {run_id} not found")

        now = _now_iso()

        if action == "cancel_device_draft":
            run["status"] = "cancelled"
            run["nodePath"] = run.get("nodePath", []) + [_node("apply_user_confirmation", "completed", "用户取消")]
            run["updatedAt"] = now
            store.upsert_agent_run(session, run)
            return run

        if action == "cancel_fault_record":
            run["status"] = "completed"
            run["waitingFor"] = None
            run["currentNode"] = None
            result = run.get("result") or {}
            if result.get("troubleshooting"):
                run["result"] = {**result, "type": "troubleshooting_result"}
                run["resultType"] = "troubleshooting_result"
            run["nodePath"] = run.get("nodePath", []) + [_node("wait_save_record_confirmation", "skipped", "用户取消保存")]
            run["updatedAt"] = now
            store.upsert_agent_run(session, run)
            return run

        if action == "modify_device_draft":
            result = run.get("result") or {}
            draft = result.get("deviceDraft")
            if draft and patch:
                draft.update(patch)
                draft["status"] = "modified"
                run["result"] = {**result, "type": "device_draft", "deviceDraft": draft}
                run["resultType"] = "device_draft"
            run["nodePath"] = run.get("nodePath", []) + [_node("apply_user_confirmation", "completed", "用户修改草稿")]
            run["updatedAt"] = now
            store.upsert_agent_run(session, run)
            return run

        if action == "confirm_device_draft":
            result = run.get("result") or {}
            draft = result.get("deviceDraft")
            if not draft:
                run["status"] = "failed"
                run["errorMessage"] = "草稿不存在"
                run["nodePath"] = run.get("nodePath", []) + [_node("apply_user_confirmation", "failed", "草稿不存在")]
                store.upsert_agent_run(session, run)
                return run

            if patch:
                draft.update(patch)
            run["nodePath"] = run.get("nodePath", []) + [_node("apply_user_confirmation", "completed", "用户已确认")]

            device = store.create_device(session, {
                "name": draft.get("name"),
                "brand": draft.get("brand"),
                "model": draft.get("model"),
                "category": draft.get("category"),
                "purchaseDate": draft.get("purchaseDate"),
                "warrantyMonths": draft.get("warrantyMonths"),
                "serialNumber": draft.get("serialNumber"),
                "purchaseChannel": draft.get("purchaseChannel"),
            }, user_id)
            run["nodePath"].append(_node("create_device", "completed", f"已创建设备 {device['id']}"))

            source_ids = draft.get("sourceAttachmentIds", [])
            if source_ids:
                store.bind_attachments_to_device(session, source_ids, device["id"])
                run["nodePath"].append(_node("attach_files_to_device", "completed", f"绑定 {len(source_ids)} 个附件"))

            reminder = None
            suggested = draft.get("suggestedReminders", [])
            if suggested and device.get("warrantyExpireDate"):
                s = suggested[0]
                reminder = store.create_reminder(session, {
                    "deviceId": device["id"],
                    "type": "warranty_expire",
                    "title": s.get("title"),
                    "dueDate": s.get("dueDate"),
                    "description": f"保修将于 {device['warrantyExpireDate']} 到期",
                    "sourceAgentRunId": run_id,
                }, user_id)
                run["nodePath"].append(_node("create_warranty_reminder", "completed", "已创建保修提醒"))
            else:
                run["nodePath"].append(_node("create_warranty_reminder", "skipped", "无保修截止日"))

            manual_att = None
            for aid in source_ids:
                a = store.get_attachment(session, aid)
                if a and a.get("attachmentType") == "manual":
                    manual_att = a
                    break
            if manual_att:
                store.add_manual_chunk(session, {
                    "deviceId": device["id"],
                    "attachmentId": manual_att["id"],
                    "chunkIndex": 0,
                    "pageNumber": 1,
                    "section": "使用说明",
                    "content": f"{device['name']} 使用说明：请按说明书指引安装与使用，定期清洁保养。如有异常请先断电并联系官方售后。",
                })
                run["nodePath"].append(_node("index_manual_if_exists", "completed", "已索引说明书"))
            else:
                run["nodePath"].append(_node("index_manual_if_exists", "skipped", "无说明书"))

            attachments = [store.get_attachment(session, aid) for aid in source_ids]
            attachments = [a for a in attachments if a]

            run["status"] = "completed"
            run["deviceId"] = device["id"]
            run["result"] = {
                "type": "device_create_success",
                "device": device,
                "attachments": attachments,
                "reminder": reminder,
                "message": f"已创建设备「{device['name']}」，绑定 {len(attachments)} 个附件，并生成保修提醒。",
            }
            run["resultType"] = "device_create_success"
            run["nodePath"].append(_node("final_response", "completed", "建档完成"))
            run["updatedAt"] = _now_iso()
            store.upsert_agent_run(session, run)
            return run

        if action == "select_device":
            if not device_id:
                run["status"] = "failed"
                run["errorMessage"] = "未选择设备"
                store.upsert_agent_run(session, run)
                return run

            run["deviceId"] = device_id
            run["context"] = {**(run.get("context") or {}), "deviceId": device_id}
            run["nodePath"] = run.get("nodePath", []) + [_node("apply_user_confirmation", "completed", f"用户选择设备 {device_id}")]

            new_run = run_agent(
                user_input=run["userInput"],
                device_id=device_id,
                attachment_ids=run.get("attachmentIds"),
                user_id=user_id,
                intent_hint=run.get("intent"),
                db=session,
            )
            run["nodePath"].extend(new_run.get("nodePath", []))
            run["status"] = new_run["status"]
            run["result"] = new_run["result"]
            run["resultType"] = new_run.get("resultType")
            run["waitingFor"] = new_run.get("waitingFor")
            run["errorMessage"] = new_run.get("errorMessage")
            run["updatedAt"] = _now_iso()
            store.upsert_agent_run(session, run)
            return run

        if action == "save_fault_record":
            result = run.get("result") or {}
            tr = result.get("troubleshooting")
            if not tr:
                run["status"] = "failed"
                run["errorMessage"] = "没有可保存的故障结果"
                store.upsert_agent_run(session, run)
                return run

            fr = store.create_fault_record(session, {
                "deviceId": tr["deviceId"],
                "agentRunId": run_id,
                "type": "troubleshooting",
                "title": f"{tr['deviceName']} 故障记录",
                "symptom": run["userInput"],
                "riskLevel": tr["riskLevel"],
                "summary": "；".join(tr.get("actions", [])),
                "serviceScript": tr.get("supportMessage"),
            }, user_id)

            run["status"] = "completed"
            run["result"] = {**result, "type": "fault_record_saved", "faultRecord": fr}
            run["resultType"] = "fault_record_saved"
            run["nodePath"] = run.get("nodePath", []) + [_node("save_maintenance_record", "completed", "已保存故障记录")]
            run["updatedAt"] = _now_iso()
            store.upsert_agent_run(session, run)
            return run

        return run

    if db is not None:
        return _execute(db)
    with SessionLocal() as session:
        return _execute(session)
