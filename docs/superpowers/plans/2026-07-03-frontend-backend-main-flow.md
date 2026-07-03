# Frontend Backend Main Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the frontend main flow use the FastAPI backend by default in local development while preserving mock mode as an explicit fallback.

**Architecture:** Lock the backend contract first with focused API tests, then tighten the frontend API client so main-flow pages only rely on the real HTTP contract when integration mode is enabled. Keep the current in-memory backend and root dev orchestration, but change the default dev environment so the integrated path is the normal path.

**Tech Stack:** Next.js 14, Zustand, TypeScript, FastAPI, pytest, Node.js root dev scripts

---

## File Map

- Modify: `E:\cwh\project\homecare-agent\apps\api\tests\test_api_main_flow.py`
  Purpose: Regression tests for login, devices, attachments, reminders, and agent runs.
- Modify: `E:\cwh\project\homecare-agent\apps\api\main.py`
  Purpose: Expose the FastAPI app for test client coverage if route wiring adjustments are needed.
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\*.py`
  Purpose: Narrow contract fixes only if tests reveal mismatches in the confirmed main flows.
- Modify: `E:\cwh\project\homecare-agent\apps\web\lib\api-client.ts`
  Purpose: Make real-backend mode the authoritative main-flow implementation and remove placeholder or broad-fallback behavior from confirmed flows.
- Modify: `E:\cwh\project\homecare-agent\apps\web\store\auth-store.ts`
  Purpose: Keep login error handling aligned with backend responses if contract tests reveal mismatches.
- Modify: `E:\cwh\project\homecare-agent\apps\web\store\conversation-store.ts`
  Purpose: Keep agent-run error handling aligned with real backend responses if contract tests reveal mismatches.
- Modify: `E:\cwh\project\homecare-agent\scripts\dev.mjs`
  Purpose: Set local integrated development to real-backend mode by default while preserving port fallback.
- Modify: `E:\cwh\project\homecare-agent\apps\web\.env.example`
  Purpose: Document the updated default local integration behavior clearly.

### Task 1: Add backend contract tests for main flows

**Files:**
- Create: `E:\cwh\project\homecare-agent\apps\api\tests\test_api_main_flow.py`
- Test: `E:\cwh\project\homecare-agent\apps\api\main.py`

- [ ] **Step 1: Write the failing tests**

```python
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def test_login_success():
    res = client.post("/api/auth/login", json={"username": "home_a", "password": "123456"})
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["userId"] == "user_home_a"
    assert data["token"].startswith("mock-token-")


def test_login_invalid_credentials():
    res = client.post("/api/auth/login", json={"username": "home_a", "password": "wrong"})
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
        json={"filename": "manual.pdf", "mimeType": "application/pdf", "attachmentType": "manual"},
    )
    assert create_res.status_code == 201
    attachment = create_res.json()

    parse_res = client.post(f"/api/attachments/{attachment['id']}/parse")
    assert parse_res.status_code == 200
    parsed = parse_res.json()
    assert parsed["id"] == attachment["id"]
    assert parsed["parseStatus"] in {"parsed", "failed"}


def test_reminders_list_and_patch():
    list_res = client.get("/api/reminders")
    assert list_res.status_code == 200
    reminders = list_res.json()
    assert reminders

    reminder_id = reminders[0]["id"]
    patch_res = client.patch(f"/api/reminders/{reminder_id}", json={"status": "done"})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "done"


def test_agent_run_create_list_get_and_confirm():
    create_res = client.post(
        "/api/agent/runs",
        json={
            "inputText": "帮我看看空气净化器保修到什么时候",
            "intentHint": "warranty_check",
            "attachmentIds": [],
            "context": {},
            "userId": "user_home_a",
        },
    )
    assert create_res.status_code == 201
    run = create_res.json()
    run_id = run["id"]

    list_res = client.get("/api/agent/runs")
    assert list_res.status_code == 200
    assert any(item["id"] == run_id for item in list_res.json())

    get_res = client.get(f"/api/agent/runs/{run_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == run_id

    if run["status"] == "waiting_confirmation":
        confirm_res = client.post(
            f"/api/agent/runs/{run_id}/confirm",
            json={"action": "cancel_device_draft", "userId": "user_home_a"},
        )
        assert confirm_res.status_code == 200
        assert confirm_res.json()["id"] == run_id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest tests/test_api_main_flow.py -v`
Expected: FAIL because the new test file does not exist yet or reveals current contract mismatches.

- [ ] **Step 3: Write the minimal implementation**

```python
"""Main-flow API contract tests."""
```

Create the file exactly as defined in Step 1, then run the test suite to learn the real mismatches before changing production code.

- [ ] **Step 4: Run test to verify the concrete failures**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest tests/test_api_main_flow.py -v`
Expected: Targeted failures that identify route or contract mismatches in the confirmed main flows.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_api_main_flow.py
git commit -m "test: add main flow api contract coverage"
```

### Task 2: Fix backend contract mismatches revealed by tests

**Files:**
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\auth.py`
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\devices.py`
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\attachments.py`
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\reminders.py`
- Modify: `E:\cwh\project\homecare-agent\apps\api\app\api\routes\agent_runs.py`
- Test: `E:\cwh\project\homecare-agent\apps\api\tests\test_api_main_flow.py`

- [ ] **Step 1: Keep the failing test as the driver**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest tests/test_api_main_flow.py -v`
Expected: FAIL with a specific route or response-shape mismatch.

- [ ] **Step 2: Implement the smallest backend fix for the first failing contract**

```python
# Example pattern only for the touched route:
@router.get("", response_model=list[Device])
def list_devices():
    return store.list_devices()
```

Apply only the route or response-shape changes required by the failing assertion. Do not redesign unrelated domains.

- [ ] **Step 3: Re-run the focused test after each fix**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest tests/test_api_main_flow.py -v`
Expected: The previously failing assertion passes, or the next concrete mismatch is exposed.

- [ ] **Step 4: Run the full backend suite once the contract test passes**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest -v`
Expected: PASS for existing service tests and the new contract test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/api/routes apps/api/tests/test_api_main_flow.py
git commit -m "api: align main flow contracts"
```

### Task 3: Make the frontend real-backend path authoritative for main flows

**Files:**
- Modify: `E:\cwh\project\homecare-agent\apps\web\lib\api-client.ts`
- Modify: `E:\cwh\project\homecare-agent\apps\web\store\auth-store.ts`
- Modify: `E:\cwh\project\homecare-agent\apps\web\store\conversation-store.ts`

- [ ] **Step 1: Write the failing integration expectations**

Use the existing API contract from Task 2 as the expected behavior for these methods in `api-client.ts`:

```ts
api.login(username, password)
api.listDevices()
api.getDevice(id)
api.registerAttachment(input, userId)
api.parseAttachment(id)
api.listReminders()
api.patchReminder(id, patch, userId)
api.listAgentRuns()
api.getAgentRun(id)
api.startAgentRun(input)
api.confirmAgentRun(runId, input)
```

The failing condition to look for is any real-backend branch that still returns placeholders, unrelated fallback data, or assumes mock-only behavior.

- [ ] **Step 2: Run a focused frontend build or type check to surface integration failures**

Run: `cd E:\cwh\project\homecare-agent; npm run build`
Expected: FAIL if the real-backend path changes expose compile-time issues.

- [ ] **Step 3: Implement the minimal client changes**

```ts
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
```

Then update the main-flow methods so real-backend mode:

- never reads `mock-backend.ts` implicitly
- does not return placeholder export or unrelated fault-record fallback for confirmed flows
- propagates backend errors in a shape the stores can display

- [ ] **Step 4: Re-run the frontend build**

Run: `cd E:\cwh\project\homecare-agent; npm run build`
Expected: PASS, or a concrete compile/runtime-contract issue to fix next.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api-client.ts apps/web/store/auth-store.ts apps/web/store/conversation-store.ts
git commit -m "web: use real api for main flow"
```

### Task 4: Make repo-root local dev default to integrated mode

**Files:**
- Modify: `E:\cwh\project\homecare-agent\scripts\dev.mjs`
- Modify: `E:\cwh\project\homecare-agent\apps\web\.env.example`

- [ ] **Step 1: Write the failing behavior statement**

Current local integrated dev is incomplete because `scripts/dev.mjs` injects only `NEXT_PUBLIC_API_BASE_URL` and still allows the frontend to stay on implicit mock mode.

- [ ] **Step 2: Verify the current script behavior**

Run: `cd E:\cwh\project\homecare-agent; node --check scripts/dev.mjs`
Expected: PASS syntax check, but current runtime behavior still defaults to mock mode.

- [ ] **Step 3: Implement the minimal script and env changes**

```js
env: {
  ...process.env,
  NEXT_PUBLIC_USE_MOCK: "false",
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
}
```

Also update `.env.example` so the documented default local integrated path matches the root dev script behavior.

- [ ] **Step 4: Re-check the script**

Run: `cd E:\cwh\project\homecare-agent; node --check scripts/dev.mjs`
Expected: PASS with the new environment injection preserved.

- [ ] **Step 5: Commit**

```bash
git add scripts/dev.mjs apps/web/.env.example
git commit -m "chore: default local dev to real api"
```

### Task 5: Verify the integrated stack end to end

**Files:**
- Verify: `E:\cwh\project\homecare-agent\apps\api\tests\test_api_main_flow.py`
- Verify: `E:\cwh\project\homecare-agent\apps\web\lib\api-client.ts`
- Verify: `E:\cwh\project\homecare-agent\scripts\dev.mjs`

- [ ] **Step 1: Run the backend test suite**

Run: `cd E:\cwh\project\homecare-agent\apps\api; .venv\Scripts\python.exe -m pytest -v`
Expected: PASS

- [ ] **Step 2: Run the frontend build**

Run: `cd E:\cwh\project\homecare-agent; npm run build`
Expected: PASS

- [ ] **Step 3: Start the integrated local stack**

Run: `cd E:\cwh\project\homecare-agent; npm run dev`
Expected: The script starts web and API together and prints the actual local URLs.

- [ ] **Step 4: Confirm runtime targets**

Check:

- frontend URL responds
- backend URL responds
- backend docs at `/docs` respond
- the frontend is using FastAPI mode, not implicit mock mode

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: connect frontend main flow to backend"
```

## Self-Review

- Spec coverage: The plan covers backend contract tests, route alignment, frontend client tightening, local dev default changes, and verification.
- Placeholder scan: No `TODO` or deferred implementation markers remain in task instructions.
- Type consistency: The plan uses the existing API-client method names and the current backend route structure.
