"""warranty_service 单测 —— 用 seed.ts 的日期样本验证与 TS 实现等价。"""

from datetime import date
from app.services import warranty_service as w


def test_unknown_when_missing_inputs():
    assert w.calc_warranty_status(None, 24).status == "unknown"
    assert w.calc_warranty_status("2026-06-20", None).status == "unknown"


def test_active_status():
    # 小米净水器：2026-06-20 购买，24 月，截至 2026-07-02 仍保修中且 >30 天
    r = w.calc_warranty_status("2026-06-20", 24, now=date(2026, 7, 2))
    assert r.status == "active"
    assert r.expire_date == "2028-06-20"
    assert r.days_remaining is not None and r.days_remaining > 30


def test_expiring_status_within_30_days():
    # 距过保 10 天 → expiring
    r = w.calc_warranty_status("2026-06-20", 2, now=date(2026, 8, 11))
    # expire = 2026-08-20，2026-08-11 距过保 9 天
    assert r.expire_date == "2026-08-20"
    assert r.status == "expiring"
    assert r.days_remaining == 9


def test_expiring_boundary_exactly_30_days():
    r = w.calc_warranty_status("2026-06-20", 2, now=date(2026, 7, 21))
    # expire 2026-08-20；2026-07-21 → 30 天，<=30 → expiring
    assert r.status == "expiring"
    assert r.days_remaining == 30


def test_expired_status():
    # 戴森 V12：2023-05-01 购买 24 月 → 2025-05-01 过保，2026-07 已过保
    r = w.calc_warranty_status("2023-05-01", 24, now=date(2026, 7, 2))
    assert r.status == "expired"
    assert r.expire_date == "2025-05-01"


def test_add_months_normal():
    assert w.add_months("2026-06-20", 24) == "2028-06-20"
    assert w.add_months("2024-07-20", 24) == "2026-07-20"


def test_add_months_month_end_overflow():
    # 1 月 31 日 + 1 月 → TS 回退到 2 月 28 日
    assert w.add_months("2026-01-31", 1) == "2026-02-28"
    # 3 月 31 日 + 1 月 → 4 月 30 日
    assert w.add_months("2026-03-31", 1) == "2026-04-30"
    # 1 月 31 日 + 2 月 → 3 月 31 日（正常）
    assert w.add_months("2026-01-31", 2) == "2026-03-31"


def test_recompute_device_warranty():
    dev = {
        "id": "dev_xiaomi_water",
        "purchaseDate": "2026-06-20",
        "warrantyMonths": 24,
        "warrantyStatus": "unknown",  # 落库值不信任
    }
    out = w.recompute_device_warranty(dev)
    assert out["warrantyExpireDate"] == "2028-06-20"
    assert out["warrantyStatus"] in ("active", "expiring")
    # 不修改原 dict 关键字段
    assert out["id"] == "dev_xiaomi_water"


def test_diff_days():
    assert w.diff_days("2026-06-20", "2026-06-20") == 0
    assert w.diff_days("2026-06-20", "2026-07-20") == 30
