"""safety_service 单测。"""

from app.services import safety_service as s


def test_no_risk_plain_text():
    r = s.detect_safety_risk("我的净水器漏水了怎么办")
    assert r.is_high_risk is False
    assert r.risk_level == "low"
    assert r.matched_keywords == []


def test_high_risk_electric_leak():
    r = s.detect_safety_risk("洗衣机漏电我能不能拆开修")
    assert r.is_high_risk is True
    assert r.risk_level == "high"
    assert "漏电" in r.matched_keywords


def test_high_risk_gas_smell():
    r = s.detect_safety_risk("我闻到煤气味")
    assert r.is_high_risk is True
    assert "煤气味" in r.matched_keywords


def test_disassembly_alone_is_high_risk():
    r = s.detect_safety_risk("我想自己拆开修一下")
    assert r.is_high_risk is True
    assert r.matched_keywords == ["需要拆机维修"]


def test_smoke_and_battery_keywords():
    assert s.detect_safety_risk("机身在冒烟").is_high_risk is True
    assert s.detect_safety_risk("电池鼓包了").is_high_risk is True
    assert s.detect_safety_risk("有烧焦味").is_high_risk is True


def test_safety_constants_present():
    assert s.SAFETY_TITLE
    assert isinstance(s.SAFETY_GUIDANCE, list) and len(s.SAFETY_GUIDANCE) >= 4
    assert "停止使用" in s.SAFETY_GUIDANCE[0] or "立即停止" in s.SAFETY_GUIDANCE[0]
