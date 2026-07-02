"""保修状态计算 — 真实逻辑，移植自 apps/web/lib/warranty.ts。

EXECUTION_PLAN §9.4 规则：
  无 purchase_date 或无 warranty_months → unknown
  当前日期 > warranty_expire_date → expired
  距离过保 <= 30 天 → expiring
  其他 → active
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal, Optional

WarrantyStatus = Literal["active", "expiring", "expired", "unknown"]

WARRANTY_STATUS_LABEL: dict[WarrantyStatus, str] = {
    "active": "保修中",
    "expiring": "即将过保",
    "expired": "已过保",
    "unknown": "保修未知",
}

_EXPIRING_WINDOW_DAYS = 30


@dataclass
class WarrantyCalc:
    status: WarrantyStatus
    expire_date: Optional[str] = None
    days_remaining: Optional[int] = None


def to_iso_date(d: date) -> str:
    """date → 'YYYY-MM-DD'（对齐 TS toISODate）。"""
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def _parse_iso_date(value: str) -> date:
    """解析 'YYYY-MM-DD'；与 TS 一致仅取日期部分。"""
    return datetime.strptime(value[:10], "%Y-%m-%d").date()


def add_months(date_str: str, months: int) -> str:
    """月份加法，移植 TS addMonths —— 含月末溢出回退处理。

    例：2026-01-31 + 1 月 → TS 会回退到 2026-02-28（取上月最后一天）。
    """
    d = _parse_iso_date(date_str)
    day = d.day
    # 计算 year/month 滚动
    total = (d.year * 12 + (d.month - 1)) + months
    new_year, new_month0 = divmod(total, 12)
    new_month = new_month0 + 1
    # 尝试取同 day，若该月没有该 day（如 2 月 30 日）则回退到当月最后一天
    # Python 会自动在创建 date 时抛错，这里用 calendar 找最大合法 day
    import calendar

    last_day = calendar.monthrange(new_year, new_month)[1]
    new_day = min(day, last_day)
    return to_iso_date(date(new_year, new_month, new_day))


def calc_warranty_expire_date(
    purchase_date: Optional[str],
    warranty_months: Optional[int],
) -> Optional[str]:
    if not purchase_date or not warranty_months:
        return None
    return add_months(purchase_date, warranty_months)


def diff_days(from_iso: str, to_iso: str) -> int:
    """天数差，移植 TS diffDays —— 四舍五入到整天。"""
    a = _parse_iso_date(from_iso)
    b = _parse_iso_date(to_iso)
    return round((b - a).days)


def calc_warranty_status(
    purchase_date: Optional[str],
    warranty_months: Optional[int],
    now: Optional[date] = None,
) -> WarrantyCalc:
    if not purchase_date or not warranty_months:
        return WarrantyCalc(status="unknown")

    expire_date = calc_warranty_expire_date(purchase_date, warranty_months)
    if not expire_date:
        return WarrantyCalc(status="unknown")

    today = to_iso_date(now or date.today())
    if today > expire_date:
        return WarrantyCalc(status="expired", expire_date=expire_date)

    days_remaining = diff_days(today, expire_date)
    if days_remaining <= _EXPIRING_WINDOW_DAYS:
        return WarrantyCalc(
            status="expiring", expire_date=expire_date, days_remaining=days_remaining
        )
    return WarrantyCalc(
        status="active", expire_date=expire_date, days_remaining=days_remaining
    )


def recompute_device_warranty(device: dict) -> dict:
    """对设备 dict 运行时重算 warranty_expire_date / warranty_status（不落库）。

    与 mock-backend.recomputeWarranty 等价。
    """
    calc = calc_warranty_status(device.get("purchaseDate"), device.get("warrantyMonths"))
    return {
        **device,
        "warrantyExpireDate": calc.expire_date,
        "warrantyStatus": calc.status,
    }
