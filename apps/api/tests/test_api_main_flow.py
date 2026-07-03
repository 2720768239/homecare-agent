"""Main-flow API contract tests."""

from fastapi.testclient import TestClient

from app.db.store import store
from main import app


client = TestClient(app)


def setup_function():
    store.reset()


def test_login_success():
    res = client.post(
        "/api/auth/login",
        json={"username": "home_a", "password": "home123456"},
    )

    assert res.status_code == 200
    data = res.json()
    assert data["user"]["userId"] == "user_home_a"
    assert data["user"]["username"] == "home_a"
    assert data["token"].startswith("mock-token-")


def test_login_invalid_credentials():
    res = client.post(
        "/api/auth/login",
        json={"username": "home_a", "password": "wrong"},
    )

    assert res.status_code == 401


def test_devices_list_and_detail():
    list_res = client.get("/api/devices")
    assert list_res.status_code == 200

    devices = list_res.json()
    assert devices

    detail_res = client.get(f"/api/devices/{devices[0]['id']}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == devices[0]["id"]


def test_attachment_register_and_parse():
    create_res = client.post(
        "/api/attachments",
        json={
            "filename": "manual.pdf",
            "mimeType": "application/pdf",
            "attachmentType": "manual",
        },
    )
    assert create_res.status_code == 201

    attachment = create_res.json()
    assert attachment["parseStatus"] == "pending"

    parse_res = client.post(f"/api/attachments/{attachment['id']}/parse")
    assert parse_res.status_code == 200

    parsed = parse_res.json()
    assert parsed["id"] == attachment["id"]
    assert parsed["parseStatus"] == "parsed"
    assert parsed["attachmentType"] == "manual"


def test_reminders_list_and_patch():
    list_res = client.get("/api/reminders")
    assert list_res.status_code == 200

    reminders = list_res.json()
    assert reminders

    reminder_id = reminders[0]["id"]
    patch_res = client.patch(
        f"/api/reminders/{reminder_id}",
        json={"status": "done"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "done"


def test_fault_records_list_by_device():
    devices_res = client.get("/api/devices")
    assert devices_res.status_code == 200

    device_id = devices_res.json()[0]["id"]
    fault_res = client.get(f"/api/fault-records/by-device/{device_id}")
    assert fault_res.status_code == 200

    records = fault_res.json()
    assert isinstance(records, list)
    assert all(item["deviceId"] == device_id for item in records)


def test_agent_run_create_list_get_and_confirm():
    create_res = client.post(
        "/api/agent/runs",
        json={
            "inputText": "帮我用这些资料建设备档案",
            "intentHint": "create_device",
            "attachmentIds": [],
            "context": {},
            "userId": "user_home_a",
        },
    )
    assert create_res.status_code == 201

    run = create_res.json()
    run_id = run["id"]
    assert run["status"] == "failed"
    assert run["result"]["type"] == "error"
    assert run["result"]["error"]["code"] == "NO_ATTACHMENTS"

    list_res = client.get("/api/agent/runs")
    assert list_res.status_code == 200
    assert any(item["id"] == run_id for item in list_res.json())

    get_res = client.get(f"/api/agent/runs/{run_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == run_id

    confirm_res = client.post(
        f"/api/agent/runs/{run_id}/confirm",
        json={"action": "cancel_device_draft", "userId": "user_home_a"},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["id"] == run_id
    assert confirm_res.json()["status"] == "cancelled"
