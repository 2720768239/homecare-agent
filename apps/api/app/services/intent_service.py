"""意图识别 — 真实规则，移植自 apps/web/lib/mock-backend.ts::classifyIntent。

按关键词正则识别 create_device / manual_qa / warranty_check / troubleshooting / unknown。
"""

from __future__ import annotations

import re
from typing import Literal, Optional

AgentIntent = Literal["create_device", "manual_qa", "warranty_check", "troubleshooting", "unknown"]

_CREATE_DEVICE_RE = re.compile(r"建档|添加设备|新建设备|上传|订单|发票|保修卡")
_MANUAL_QA_RE = re.compile(r"说明书|怎么用|怎么清洗|怎么安装|滤芯|操作|使用方法")
_WARRANTY_RE = re.compile(r"保修|还在保修|过保|保修期|保修多久")
_TROUBLESHOOTING_RE = re.compile(r"故障|漏水|坏了|不工作|异响|不制冷|不加热|售后|修|漏电|冒烟")


def classify_intent(
    text: str,
    has_attachments: bool = False,
    intent_hint: Optional[str] = None,
) -> AgentIntent:
    """移植 classifyIntent。注意 intent_hint 仅在末兜底使用。"""
    if intent_hint == "create_device" or has_attachments:
        if _CREATE_DEVICE_RE.search(text) or has_attachments:
            return "create_device"
    if _MANUAL_QA_RE.search(text):
        return "manual_qa"
    if _WARRANTY_RE.search(text):
        return "warranty_check"
    if _TROUBLESHOOTING_RE.search(text):
        return "troubleshooting"
    if intent_hint:
        return intent_hint  # type: ignore[return-value]
    return "unknown"


def intent_label(intent: AgentIntent) -> str:
    """对齐 mock-backend.intentLabel。"""
    return {
        "create_device": "自动建档",
        "manual_qa": "说明书问答",
        "warranty_check": "保修查询",
        "troubleshooting": "故障售后",
        "unknown": "未知意图",
    }.get(intent, "未知意图")
