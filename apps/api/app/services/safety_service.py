"""高风险安全判断 — 真实规则，移植自 apps/web/lib/safety.ts。

EXECUTION_PLAN §9.5 / §12.2：命中高风险关键词即保守拒答。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal

FaultRiskLevel = Literal["low", "medium", "high"]

# 命中即视为高风险的关键词（对齐 safety.ts HIGH_RISK_KEYWORDS）
HIGH_RISK_KEYWORDS: List[str] = [
    "漏电",
    "电击",
    "燃气味",
    "煤气味",
    "明火",
    "冒烟",
    "爆炸",
    "电池鼓包",
    "电池发烫",
    "带电拆机",
    "带电维修",
    "短路",
    "高压",
    "烧焦味",
    "漏气",
    "触电",
]


@dataclass
class SafetyCheckResult:
    is_high_risk: bool
    risk_level: FaultRiskLevel
    matched_keywords: List[str]


def detect_safety_risk(text: str) -> SafetyCheckResult:
    """检测文本是否含高风险语义。移植 TS detectSafetyRisk。

    1. 子串匹配 HIGH_RISK_KEYWORDS（含大小写不敏感）。
    2. 另外识别「拆机/自己修」类意图 —— 即使未命中上面关键词也视为高风险。
    """
    lower = text.lower()
    matched = [
        kw
        for kw in HIGH_RISK_KEYWORDS
        if kw in text or kw.lower() in lower
    ]
    is_high_risk = len(matched) > 0

    disassembly = any(
        token in text
        for token in ("拆开", "拆机", "拆修", "自己修", "拆开修")
    )
    if disassembly and not is_high_risk:
        return SafetyCheckResult(
            is_high_risk=True,
            risk_level="high",
            matched_keywords=["需要拆机维修"],
        )
    return SafetyCheckResult(
        is_high_risk=is_high_risk,
        risk_level="high" if is_high_risk else "low",
        matched_keywords=matched,
    )


# 高风险响应文案（对齐 safety.ts 常量）
SAFETY_GUIDANCE: List[str] = [
    "立即停止使用该设备",
    "断开电源 / 关闭燃气阀门 / 远离现场",
    "不要尝试带电拆机、燃气维修或复杂拆机",
    "联系官方售后或专业维修人员处理",
]

SAFETY_TITLE = "检测到高风险情况"
SAFETY_MESSAGE = (
    "这类故障涉及安全风险，我不能提供拆机或带电维修步骤。"
    "请先确保人身安全，再联系官方售后或专业人员。"
)
