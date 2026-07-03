# SQLite Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the FastAPI backend's in-memory singleton store with SQLite-backed persistence while keeping the current API contract and frontend-connected main flow stable.

**Architecture:** Introduce a SQLAlchemy and Alembic persistence layer under `apps/api/app/db/`, keep FastAPI routes thin, and replace `app.db.store` with a repository-backed facade so route and agent code continue to call a stable storage boundary. Local development uses a repo-local SQLite file, explicit migrations, and an explicit seed path wired into root scripts.

**Tech Stack:** FastAPI, SQLAlchemy 2.x, Alembic, SQLite, pytest, existing Node root scripts

---

## File Structure

**Create:**

- `apps/api/alembic.ini`
- `apps/api/alembic/env.py`
- `apps/api/alembic/script.py.mako`
- `apps/api/alembic/versions/20260703_000001_create_main_flow_tables.py`
- `apps/api/app/db/database.py`
- `apps/api/app/db/models.py`
- `apps/api/app/db/session.py`
- `apps/api/app/db/repositories/__init__.py`
- `apps/api/app/db/repositories/devices.py`
- `apps/api/app/db/repositories/attachments.py`
- `apps/api/app/db/repositories/reminders.py`
- `apps/api/app/db/repositories/fault_records.py`
- `apps/api/app/db/repositories/agent_runs.py`
- `apps/api/app/db/repositories/manual_chunks.py`
- `apps/api/app/db/repositories/seed_repository.py`
- `apps/api/app/db/seed_runtime.py`
- `apps/api/tests/conftest.py`
- `apps/api/tests/test_seed_runtime.py`

**Modify:**

- `apps/api/pyproject.toml`
- `apps/api/main.py`
- `apps/api/app/core/config.py`
- `apps/api/app/db/store.py`
- `apps/api/app/agent/graph.py`
- `apps/api/app/api/routes/devices.py`
- `apps/api/app/api/routes/attachments.py`
- `apps/api/app/api/routes/reminders.py`
- `apps/api/app/api/routes/fault_records.py`
- `apps/api/app/api/routes/agent_runs.py`
- `apps/api/tests/test_api_main_flow.py`
- `scripts/dev.mjs`
- `package.json`
- `apps/web/.env.example`
- `.gitignore`

**Test:**

- `apps/api/tests/test_api_main_flow.py`
- `apps/api/tests/test_warranty.py`
- `apps/api/tests/test_safety.py`
- `apps/api/tests/test_seed_runtime.py`

---

### Task 1: Add database dependencies and configuration

**Files:**
- Modify: `apps/api/pyproject.toml`
- Modify: `apps/api/app/core/config.py`
- Create: `apps/api/app/db/database.py`
- Create: `apps/api/app/db/session.py`

- [ ] **Step 1: Write the failing configuration test**

```python
# apps/api/tests/test_seed_runtime.py
from app.core.config import settings


def test_database_url_defaults_to_repo_local_sqlite():
    assert settings.DATABASE_URL == "sqlite:///./data/homecare-agent.db"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_seed_runtime.py::test_database_url_defaults_to_repo_local_sqlite -v`
Expected: FAIL because `Settings` has no `DATABASE_URL`.

- [ ] **Step 3: Add SQLAlchemy and settings support**

```toml
# apps/api/pyproject.toml
dependencies = [
    "fastapi>=0.110.0",
    "uvicorn[standard]>=0.29.0",
    "pydantic>=2.0",
    "langgraph>=0.0.30",
    "python-dotenv>=1.0.0",
    "pytest>=8.0",
    "httpx>=0.27.0",
    "sqlalchemy>=2.0",
    "alembic>=1.13",
]
```

```python
# apps/api/app/core/config.py
from dataclasses import dataclass, field
import os


@dataclass
class Settings:
    API_TITLE: str = "HomeCare Agent API"
    API_VERSION: str = "0.1.0"
    HOUSEHOLD_ID: str = "household_default"
    MOCK_AUTH: bool = True
    DATABASE_URL: str = field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./data/homecare-agent.db")
    )
```

```python
# apps/api/app/db/database.py
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()
```

```python
# apps/api/app/db/session.py
from __future__ import annotations

from collections.abc import Generator
from sqlalchemy.orm import Session

from app.db.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Run focused tests**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_seed_runtime.py::test_database_url_defaults_to_repo_local_sqlite -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/pyproject.toml apps/api/app/core/config.py apps/api/app/db/database.py apps/api/app/db/session.py apps/api/tests/test_seed_runtime.py
git commit -m "api: add sqlite database configuration"
```

### Task 2: Add Alembic and ORM models for the main-flow tables

**Files:**
- Create: `apps/api/alembic.ini`
- Create: `apps/api/alembic/env.py`
- Create: `apps/api/alembic/script.py.mako`
- Create: `apps/api/alembic/versions/20260703_000001_create_main_flow_tables.py`
- Create: `apps/api/app/db/models.py`

- [ ] **Step 1: Write the failing schema smoke test**

```python
# apps/api/tests/test_seed_runtime.py
from sqlalchemy import inspect

from app.db.database import engine


def test_main_flow_tables_exist_after_migration():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    assert {"devices", "attachments", "reminders", "fault_records", "agent_runs", "manual_chunks"} <= table_names
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_seed_runtime.py::test_main_flow_tables_exist_after_migration -v`
Expected: FAIL because the schema does not exist yet.

- [ ] **Step 3: Define ORM models and first migration**

```python
# apps/api/app/db/models.py
from __future__ import annotations

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class DeviceModel(Base):
    __tablename__ = "devices"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    household_id: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    brand: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String)
    purchase_date: Mapped[str | None] = mapped_column(String, nullable=True)
    warranty_months: Mapped[int | None] = mapped_column(Integer, nullable=True)
    warranty_expire_date: Mapped[str | None] = mapped_column(String, nullable=True)
    warranty_status: Mapped[str] = mapped_column(String, default="unknown")
    serial_number: Mapped[str | None] = mapped_column(String, nullable=True)
    purchase_channel: Mapped[str | None] = mapped_column(String, nullable=True)
    service_phone: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[str] = mapped_column(String)
    updated_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)
    updated_at: Mapped[str] = mapped_column(String)
```

```python
# apps/api/alembic/versions/20260703_000001_create_main_flow_tables.py
from alembic import op
import sqlalchemy as sa

revision = "20260703_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("household_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("brand", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=False),
        sa.Column("purchase_date", sa.String(), nullable=True),
        sa.Column("warranty_months", sa.Integer(), nullable=True),
        sa.Column("warranty_expire_date", sa.String(), nullable=True),
        sa.Column("warranty_status", sa.String(), nullable=False),
        sa.Column("serial_number", sa.String(), nullable=True),
        sa.Column("purchase_channel", sa.String(), nullable=True),
        sa.Column("service_phone", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("updated_by_user_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )
    op.create_table(
        "attachments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("household_id", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=True),
        sa.Column("agent_run_id", sa.String(), nullable=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("mime_type", sa.String(), nullable=False),
        sa.Column("file_type", sa.String(), nullable=False),
        sa.Column("attachment_type", sa.String(), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("parse_status", sa.String(), nullable=False),
        sa.Column("parse_summary", sa.Text(), nullable=True),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    op.create_table(
        "reminders",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("household_id", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("due_date", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("source_agent_run_id", sa.String(), nullable=True),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("updated_by_user_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )
    op.create_table(
        "fault_records",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("household_id", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("agent_run_id", sa.String(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("symptom", sa.Text(), nullable=False),
        sa.Column("risk_level", sa.String(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("service_script", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.String(), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.String(), nullable=False),
    )
    op.create_table(
        "agent_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("household_id", sa.String(), nullable=False),
        sa.Column("created_by_user_id", sa.String(), nullable=False),
        sa.Column("intent", sa.String(), nullable=False),
        sa.Column("user_input", sa.Text(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("device_id", sa.String(), nullable=True),
        sa.Column("current_node", sa.String(), nullable=True),
        sa.Column("waiting_for", sa.String(), nullable=True),
        sa.Column("result_type", sa.String(), nullable=True),
        sa.Column("result_json", sa.Text(), nullable=True),
        sa.Column("node_path_json", sa.Text(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("attachment_ids_json", sa.Text(), nullable=True),
        sa.Column("context_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.String(), nullable=False),
        sa.Column("updated_at", sa.String(), nullable=False),
    )
    op.create_table(
        "manual_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("device_id", sa.String(), nullable=False),
        sa.Column("attachment_id", sa.String(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("page_number", sa.Integer(), nullable=True),
        sa.Column("section", sa.String(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("manual_chunks")
    op.drop_table("agent_runs")
    op.drop_table("fault_records")
    op.drop_table("reminders")
    op.drop_table("attachments")
    op.drop_table("devices")
```

```python
# apps/api/alembic/env.py
from __future__ import annotations

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.database import Base
from app.db import models  # noqa: F401

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata
```

- [ ] **Step 4: Run migration and schema test**

Run: `cd apps/api; ..\.venv\Scripts\python.exe -m alembic upgrade head`
Expected: migration applies successfully

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_seed_runtime.py::test_main_flow_tables_exist_after_migration -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/alembic.ini apps/api/alembic apps/api/app/db/models.py apps/api/tests/test_seed_runtime.py
git commit -m "api: add sqlite schema and migrations"
```

### Task 3: Add seed runtime and root migration and seed commands

**Files:**
- Create: `apps/api/app/db/repositories/seed_repository.py`
- Create: `apps/api/app/db/seed_runtime.py`
- Modify: `apps/api/main.py`
- Modify: `package.json`
- Modify: `scripts/dev.mjs`
- Modify: `apps/web/.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing seed test**

```python
# apps/api/tests/test_seed_runtime.py
from sqlalchemy import select

from app.db.models import DeviceModel


def test_seed_runtime_populates_devices(db_session):
    from app.db.seed_runtime import seed_if_empty

    seed_if_empty(db_session)
    rows = db_session.execute(select(DeviceModel)).scalars().all()
    assert rows
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_seed_runtime.py::test_seed_runtime_populates_devices -v`
Expected: FAIL because `seed_if_empty` does not exist.

- [ ] **Step 3: Implement explicit seed runtime and root commands**

```python
# apps/api/app/db/seed_runtime.py
from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import DeviceModel
from app.db.repositories.seed_repository import insert_seed_dataset


def seed_if_empty(db: Session) -> None:
    count = db.execute(select(func.count()).select_from(DeviceModel)).scalar_one()
    if count == 0:
        insert_seed_dataset(db)
        db.commit()
```

```json
// package.json
{
  "scripts": {
    "db:migrate": "cd apps/api && .venv\\Scripts\\python.exe -m alembic upgrade head",
    "db:seed": "cd apps/api && .venv\\Scripts\\python.exe -m app.db.seed_runtime",
    "dev": "node scripts/dev.mjs"
  }
}
```

```js
// scripts/dev.mjs
import { spawnSync } from "node:child_process";

function runChecked(command, args, options = {}) {
  const result = spawnSync(
    command,
    args,
    Object.assign({ stdio: "inherit", shell: isWindows }, options),
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runChecked(pythonCommand, ["-m", "alembic", "upgrade", "head"], { cwd: apiDir });
runChecked(pythonCommand, ["-m", "app.db.seed_runtime"], { cwd: apiDir });
```

```gitignore
# .gitignore
apps/api/data/
```

- [ ] **Step 4: Run seed and root script checks**

Run: `npm.cmd run db:migrate`
Expected: schema is upgraded to head

Run: `npm.cmd run db:seed`
Expected: seed command exits successfully and inserts demo rows if the database is empty

Run: `node --check scripts/dev.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/db/repositories/seed_repository.py apps/api/app/db/seed_runtime.py apps/api/main.py package.json scripts/dev.mjs apps/web/.env.example .gitignore apps/api/tests/test_seed_runtime.py
git commit -m "api: add sqlite seed runtime and root db commands"
```

### Task 4: Replace device, attachment, and reminder persistence with repositories

**Files:**
- Create: `apps/api/app/db/repositories/devices.py`
- Create: `apps/api/app/db/repositories/attachments.py`
- Create: `apps/api/app/db/repositories/reminders.py`
- Modify: `apps/api/app/db/store.py`
- Modify: `apps/api/app/api/routes/devices.py`
- Modify: `apps/api/app/api/routes/attachments.py`
- Modify: `apps/api/app/api/routes/reminders.py`

- [ ] **Step 1: Write focused route regression tests**

```python
# apps/api/tests/test_api_main_flow.py
def test_devices_list_and_detail():
    list_res = client.get("/api/devices")
    assert list_res.status_code == 200
    devices = list_res.json()
    assert devices
    detail_res = client.get(f"/api/devices/{devices[0]['id']}")
    assert detail_res.status_code == 200


def test_attachment_register_and_parse():
    create_res = client.post("/api/attachments", json={"filename": "manual.pdf", "mimeType": "application/pdf", "attachmentType": "manual"})
    assert create_res.status_code == 201
    parse_res = client.post(f"/api/attachments/{create_res.json()['id']}/parse")
    assert parse_res.status_code == 200


def test_reminders_list_and_patch():
    reminder_id = client.get("/api/reminders").json()[0]["id"]
    patch_res = client.patch(f"/api/reminders/{reminder_id}", json={"status": "done"})
    assert patch_res.status_code == 200
```

- [ ] **Step 2: Run focused tests to capture failures after storage switch**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_api_main_flow.py -k "devices or attachment or reminders" -v`
Expected: FAIL after the old in-memory paths are disconnected.

- [ ] **Step 3: Implement repository-backed CRUD and store facade**

```python
# apps/api/app/db/repositories/devices.py
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import DeviceModel


def list_devices(db: Session, household_id: str) -> list[DeviceModel]:
    return db.execute(
        select(DeviceModel).where(DeviceModel.household_id == household_id)
    ).scalars().all()
```

```python
# apps/api/app/db/store.py
from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.repositories import attachments, devices, reminders


class Store:
    def list_devices(self, db: Session) -> list[dict]:
        return [devices.to_schema(row) for row in devices.list_devices(db, settings.HOUSEHOLD_ID)]
```

```python
# apps/api/app/api/routes/devices.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.store import store


@router.get("", response_model=list[Device])
def list_devices(db: Session = Depends(get_db)):
    return store.list_devices(db)
```

- [ ] **Step 4: Run focused tests**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_api_main_flow.py -k "devices or attachment or reminders" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/db/repositories/devices.py apps/api/app/db/repositories/attachments.py apps/api/app/db/repositories/reminders.py apps/api/app/db/store.py apps/api/app/api/routes/devices.py apps/api/app/api/routes/attachments.py apps/api/app/api/routes/reminders.py apps/api/tests/test_api_main_flow.py
git commit -m "api: move core CRUD routes to sqlite repositories"
```

### Task 5: Replace fault record, agent run, and manual chunk persistence

**Files:**
- Create: `apps/api/app/db/repositories/fault_records.py`
- Create: `apps/api/app/db/repositories/agent_runs.py`
- Create: `apps/api/app/db/repositories/manual_chunks.py`
- Modify: `apps/api/app/db/store.py`
- Modify: `apps/api/app/agent/graph.py`
- Modify: `apps/api/app/api/routes/fault_records.py`
- Modify: `apps/api/app/api/routes/agent_runs.py`

- [ ] **Step 1: Extend failing tests around agent and fault-record flows**

```python
# apps/api/tests/test_api_main_flow.py
def test_fault_records_list_by_device():
    device_id = client.get("/api/devices").json()[0]["id"]
    fault_res = client.get(f"/api/fault-records/by-device/{device_id}")
    assert fault_res.status_code == 200


def test_agent_run_create_list_get_and_confirm():
    create_res = client.post("/api/agent/runs", json={"inputText": "帮我用这些资料建设备档案", "intentHint": "create_device", "attachmentIds": [], "context": {}, "userId": "user_home_a"})
    assert create_res.status_code == 201
    run_id = create_res.json()["id"]
    assert client.get(f"/api/agent/runs/{run_id}").status_code == 200
    assert client.post(f"/api/agent/runs/{run_id}/confirm", json={"action": "cancel_device_draft", "userId": "user_home_a"}).status_code == 200
```

- [ ] **Step 2: Run focused tests to verify failures**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_api_main_flow.py -k "fault_records or agent_run" -v`
Expected: FAIL while `run_agent`, `confirm_agent_run`, or fault-record lookup still depend on the old store shape.

- [ ] **Step 3: Replace remaining store operations and thread database access through agent code**

```python
# apps/api/app/db/repositories/agent_runs.py
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AgentRunModel


def upsert_agent_run(db: Session, payload: dict) -> None:
    row = db.get(AgentRunModel, payload["id"])
    if row is None:
        row = AgentRunModel(**payload)
        db.add(row)
    else:
        for key, value in payload.items():
            setattr(row, key, value)
    db.commit()
```

```python
# apps/api/app/agent/graph.py
from app.db.database import SessionLocal
from app.db.store import store


def run_agent(
    user_input: str,
    device_id: Optional[str] = None,
    attachment_ids: Optional[list[str]] = None,
    user_id: str = "user_home_a",
    intent_hint: Optional[str] = None,
) -> dict:
    with SessionLocal() as db:
        initial_state: AgentState = {
            "user_input": user_input,
            "device_id": device_id,
            "attachment_ids": attachment_ids or [],
            "user_id": user_id,
            "intent_hint": intent_hint,
            "node_path": [],
            "status": "running",
            "result": None,
            "_ctx": {},
            "waiting_for": None,
            "error_message": None,
        }
        final_state = compiled_graph.invoke(initial_state)
        run_payload = {
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
            "createdAt": _now_iso(),
            "updatedAt": _now_iso(),
        }
        store.upsert_agent_run(db, run_payload)
        return store.get_agent_run(db, run_payload["id"])
```

```python
# apps/api/app/api/routes/agent_runs.py
@router.get("", response_model=list[AgentRun])
def list_runs(db: Session = Depends(get_db)):
    return store.list_agent_runs(db)
```

- [ ] **Step 4: Run focused tests**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_api_main_flow.py -k "fault_records or agent_run" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/db/repositories/fault_records.py apps/api/app/db/repositories/agent_runs.py apps/api/app/db/repositories/manual_chunks.py apps/api/app/db/store.py apps/api/app/agent/graph.py apps/api/app/api/routes/fault_records.py apps/api/app/api/routes/agent_runs.py apps/api/tests/test_api_main_flow.py
git commit -m "api: persist agent runs and fault records in sqlite"
```

### Task 6: Move tests to isolated SQLite fixtures and remove process-global reset assumptions

**Files:**
- Create: `apps/api/tests/conftest.py`
- Modify: `apps/api/tests/test_api_main_flow.py`
- Modify: `apps/api/main.py`
- Modify: `apps/api/app/db/store.py`

- [ ] **Step 1: Write the failing fixture-based test setup**

```python
# apps/api/tests/conftest.py
from fastapi.testclient import TestClient


def test_client_fixture_smoke(client: TestClient):
    assert client is not None
```

- [ ] **Step 2: Run the suite to verify the old global-reset approach breaks**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest apps/api/tests/test_api_main_flow.py -v`
Expected: FAIL until fixtures provide a migrated and seeded temporary database.

- [ ] **Step 3: Add dependency overrides and per-test SQLite fixtures**

```python
# apps/api/tests/conftest.py
from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base
from app.db.session import get_db
from app.db.seed_runtime import seed_if_empty
from main import app


@pytest.fixture
def client(tmp_path: Path):
    db_path = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_path}", future=True, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with TestingSessionLocal() as db:
        seed_if_empty(db)

    def override_get_db():
        with TestingSessionLocal() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
```

```python
# apps/api/tests/test_api_main_flow.py
def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "home_a", "password": "home123456"})
    assert res.status_code == 200
```

- [ ] **Step 4: Run backend suite**

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest -v`
Expected: PASS for the full backend test suite

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/conftest.py apps/api/tests/test_api_main_flow.py apps/api/main.py apps/api/app/db/store.py
git commit -m "test: isolate api tests with sqlite fixtures"
```

### Task 7: Final cleanup, verification, and developer workflow polish

**Files:**
- Modify: `apps/api/main.py`
- Modify: `apps/api/app/db/store.py`
- Modify: `package.json`
- Modify: `scripts/dev.mjs`
- Modify: `apps/web/.env.example`
- Modify: `docs/superpowers/specs/2026-07-03-sqlite-persistence-design.md` (only if behavior changed)

- [ ] **Step 1: Remove deprecated startup reseed behavior**

```python
# apps/api/main.py
app = FastAPI(title=app_settings.API_TITLE, version=app_settings.API_VERSION)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": app_settings.API_TITLE, "version": app_settings.API_VERSION}
```

Delete the old startup hook:

```python
@app.on_event("startup")
def startup_seed():
    from app.db.store import store
    store.reset()
```

- [ ] **Step 2: Remove obsolete in-memory-only methods once nothing calls them**

```python
# apps/api/app/db/store.py
class Store:
    """Database-backed storage facade for API routes and agent flows."""
```

Expected result:

- no `_db` dict
- no threading lock
- no `reset()` that reseeds memory

- [ ] **Step 3: Run full verification**

Run: `npm.cmd run db:migrate`
Expected: PASS

Run: `npm.cmd run db:seed`
Expected: PASS

Run: `.\apps\api\.venv\Scripts\python.exe -m pytest -v`
Expected: PASS

Run: `npm.cmd run build`
Expected: PASS

Run: `node --check scripts/dev.mjs`
Expected: PASS

Run: `npm.cmd run dev`
Expected: frontend and backend start together, backend uses SQLite, and `/health` responds with status 200

- [ ] **Step 4: Commit**

```bash
git add apps/api/main.py apps/api/app/db/store.py package.json scripts/dev.mjs apps/web/.env.example docs/superpowers/specs/2026-07-03-sqlite-persistence-design.md
git commit -m "chore: finalize sqlite persistence workflow"
```
