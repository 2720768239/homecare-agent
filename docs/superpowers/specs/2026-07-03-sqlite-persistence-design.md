# SQLite Persistence Design

## Goal

Replace the backend in-memory singleton store with real SQLite-backed persistence for the existing main flow, while keeping the current FastAPI route surface and frontend API contract stable.

This design covers:

- database session and configuration
- SQLAlchemy models for the current main-flow entities
- Alembic migrations
- seed-data initialization for local development
- repository-based replacement of the current in-memory CRUD layer
- test migration from in-memory state to temporary SQLite databases

This design does not cover:

- AI capability upgrades
- object storage or real file upload binaries
- auth redesign or JWT
- production deployment hardening

## Current State

The backend currently stores all state in the singleton `Store` defined in [apps/api/app/db/store.py](E:/cwh/project/homecare-agent/apps/api/app/db/store.py).

That store holds these collections in process memory:

- `devices`
- `attachments`
- `reminders`
- `faultRecords`
- `agentRuns`
- `manualChunks`

This design has two hard limits:

1. all data is lost on process restart
2. persistence behavior cannot be validated independently from process lifetime

The API routes are already wired and covered by backend tests for the main flow. That is useful here: the route surface is mostly correct already, so the migration should replace the persistence core without forcing frontend contract churn.

## Recommended Approach

Use `SQLAlchemy + Alembic + SQLite` for local development now, with the configuration shape kept portable enough to switch to Postgres later through `DATABASE_URL`.

Why this approach:

- it gives real persistence immediately
- SQLite keeps local setup simple for a frontend-oriented workflow
- SQLAlchemy fits the existing FastAPI architecture without forcing route redesign
- Alembic prevents schema drift once business logic starts to grow

Rejected alternatives:

- direct Postgres first: better production fidelity, worse local setup cost right now
- JSON-file persistence: simpler than a database, but weak on querying, migrations, and consistency

## Target Behavior

After this work:

1. backend data survives service restart in a local SQLite file
2. existing frontend-connected flows keep working without API contract changes
3. schema changes are tracked through migrations
4. local demo data can still be seeded intentionally
5. backend tests run against a temporary SQLite database, not the old singleton store

The local developer workflow should become:

```powershell
npm install
npm run dev
```

with the backend reading a SQLite database file from the workspace by default.

## Design Details

### 1. Database configuration

Add a real database configuration layer under `apps/api/app/db/`.

New responsibilities:

- `database.py`: create engine and session factory from `DATABASE_URL`
- `models.py`: SQLAlchemy ORM models
- `repositories/` or equivalent focused modules: entity CRUD operations

Default local setting:

```text
DATABASE_URL=sqlite:///./data/homecare-agent.db
```

The path should live inside the repo workspace so local development is self-contained.

The engine setup must support SQLite-specific flags such as `check_same_thread=False`.

### 2. Persistence boundary

Do not move ORM code into route handlers.

The current `store.py` is acting as a persistence boundary. Keep that boundary concept, but replace the implementation with database-backed repository access.

Expected structure:

- routes remain thin
- service logic stays in services where business rules exist
- repository functions handle reads and writes
- session lifecycle is injected or centrally resolved per request

This avoids a second refactor later when auth, AI workflows, or file storage are added.

### 3. First schema scope

The first migration should cover only the entities already used by the main flow:

- `devices`
- `attachments`
- `reminders`
- `fault_records`
- `agent_runs`
- `manual_chunks`

Field naming should favor Python/SQL conventions in the database layer, but response models should preserve the current API field names unless there is a proven mismatch.

Important constraint:

- the frontend contract should remain stable
- database normalization should not force a route rewrite in this iteration

That means some JSON/text columns are acceptable in v1 of persistence if they avoid premature schema complexity.

### 4. Seed strategy

The current seed data in [apps/api/app/db/seed.py](E:/cwh/project/homecare-agent/apps/api/app/db/seed.py) is valuable and should not be discarded.

The new seed behavior should be explicit:

- provide a seed command or startup hook that inserts the demo dataset when the database is empty
- avoid reseeding over existing local data
- keep reset behavior available for local demo use

Recommended behavior:

- first migration creates schema only
- a dedicated seed path inserts initial records
- tests control their own fixture data and do not depend on global seed state

### 5. Test migration

The backend tests should stop depending on process-global mutable state.

Test design changes:

- create a temporary SQLite database per test session or per test module
- override the app's database dependency for tests
- seed only the records needed by each test or a focused shared fixture

The existing API contract tests remain the primary regression harness. They should continue asserting the same route behavior while the storage implementation changes underneath.

### 6. Rollout order

The implementation should be incremental.

Recommended sequence:

1. introduce database config, base model metadata, and Alembic
2. create the first migration for the six main-flow tables
3. implement seed loading into SQLite
4. replace persistence for `devices`, `attachments`, and `reminders`
5. replace persistence for `fault_records`, `agent_runs`, and `manual_chunks`
6. remove or deprecate the in-memory singleton path after tests pass

This order keeps the most visible user flows stable earliest.

### 7. Compatibility with future Postgres

Even though SQLite is the first target, the code should avoid SQLite-only design decisions where the cost is low.

Keep these boundaries portable:

- read `DATABASE_URL` from config
- avoid raw SQL that assumes SQLite quirks
- keep Alembic as the schema authority
- avoid relying on implicit JSON mutation behavior

No Postgres support needs to be implemented in this task, but the migration path should stay open.

## Risks

1. The current in-memory store mixes persistence and some data shaping.
   Mitigation: move only persistence concerns first, and keep business-field shaping in service/repository helpers where needed.

2. Route tests may accidentally pass because of shared seed state assumptions.
   Mitigation: isolate database fixtures and make setup explicit in tests.

3. SQLite can hide concurrency and type issues that would appear later in Postgres.
   Mitigation: keep ORM models and migrations portable, and avoid SQLite-specific shortcuts unless required for local setup.

## Success Criteria

This task is complete when all of the following are true:

- the backend persists main-flow data in SQLite instead of the in-memory singleton store
- the existing frontend-connected flows continue working without contract regressions
- Alembic migrations exist and can recreate the schema from scratch
- demo seed data can populate a fresh local database
- backend tests run against SQLite and pass
