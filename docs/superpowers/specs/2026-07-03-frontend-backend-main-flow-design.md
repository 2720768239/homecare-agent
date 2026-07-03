# Frontend Backend Main Flow Design

## Goal

Connect the frontend main flow to the FastAPI backend so local development uses real HTTP calls instead of `apps/web/lib/mock-backend.ts` for the core user journey.

This design covers only these flows:

- login
- device list and device detail
- attachment registration and parsing
- reminders list and status update
- agent run start, read, and confirm

This design explicitly does not include:

- replacing the backend in-memory store with a database
- real file upload or object storage
- real export behavior
- non-core mock utilities that do not block the main flow

## Current State

The repository already has a split-path client in [apps/web/lib/api-client.ts](E:\cwh\project\homecare-agent\apps\web\lib\api-client.ts) controlled by `NEXT_PUBLIC_USE_MOCK`.

When mock mode is disabled, the frontend already calls these backend routes:

- `/api/auth/login`
- `/api/devices`
- `/api/attachments`
- `/api/reminders`
- `/api/agent/runs`
- `/api/settings`

The backend already exposes those routes from [apps/api/main.py](E:\cwh\project\homecare-agent\apps\api\main.py) and related route modules.

The remaining problem is not the absence of an API surface. The problem is that the frontend still treats real-backend mode as partial support:

- some frontend behavior still assumes mock-only utilities exist
- some client methods use placeholders or broad fallbacks
- local development still defaults to mock behavior unless explicitly switched
- there is not yet a regression test set that locks the core frontend/backend contract

## Recommended Approach

Keep dual-mode support, but make the main local development path use the real backend by default.

Why this approach:

- it achieves real local integration now
- it preserves the existing mock layer for demos and isolated UI work
- it keeps edits focused on the main data boundary instead of forcing a repo-wide mock removal

Rejected alternatives:

- Full mock removal now: cleaner long-term, but broader than needed for this task
- Startup-script-only env override: too implicit and leaves contract drift in the code

## Target Behavior

Running `npm run dev` from the repo root should start web and API together, and the frontend main flow should use the running FastAPI backend automatically.

The following user journey must work end-to-end against FastAPI:

1. Log in from the frontend.
2. View device list.
3. Open a device detail page.
4. Create and parse an attachment.
5. View and update reminders.
6. Start an agent run and confirm the result when confirmation is required.

The backend may still use seeded in-memory data. Data reset on restart is acceptable for this iteration.

## Design Details

### 1. Frontend API boundary

The frontend should have one authoritative data boundary: [apps/web/lib/api-client.ts](E:\cwh\project\homecare-agent\apps\web\lib\api-client.ts).

Changes:

- keep `mock-backend.ts` as an optional implementation, but do not let page-level code depend on it directly
- tighten the real-backend branches so each main-flow method has a concrete backend contract
- remove placeholder returns in main-flow code paths
- avoid broad fallbacks such as substituting unrelated route data for missing domain data unless the UI explicitly expects that translation

For this task, "main-flow complete" means the pages can render and mutate through the API client without reaching into mock-only helpers.

### 2. Local development default

Repo-root development should prefer real integration mode.

Changes:

- update the root dev orchestration so the web process receives `NEXT_PUBLIC_USE_MOCK=false`
- continue injecting the resolved backend base URL so port fallback still works
- keep `.env.example` and local env semantics clear: mock remains possible, but it is no longer the default path for integrated local development

This keeps the user-facing workflow simple:

```powershell
npm install
npm run dev
```

### 3. Backend contract gaps

The backend route surface is mostly present, so the work should focus on contract alignment instead of adding broad new domains.

Expected backend-side changes are limited to:

- adjusting response shapes if a frontend main-flow page expects a different field shape than the backend currently returns
- filling missing core route behavior only where the frontend main flow would otherwise fail
- keeping route handlers thin and pushing behavior into existing store or service layers if any logic change is needed

Non-core endpoints such as export remain out of scope unless they block one of the five confirmed flows.

### 4. Main-flow fallback policy

Fallbacks should be explicit and narrow.

Allowed:

- keep mock mode behind the existing feature flag
- return `undefined` on entity-detail `404` where the page already handles missing records

Not allowed in the main flow:

- substituting unrelated resources for missing domain endpoints
- returning static placeholders for real-backend mode
- silently reading mock data in real-backend mode

### 5. Testing and verification

The contract needs backend tests first, then integrated runtime verification.

Test additions should cover:

- login success and invalid credentials
- device list and detail fetch
- attachment register and parse
- reminder list and patch
- agent run create, fetch, list, and confirm

Verification after implementation:

- run the backend pytest suite
- run the web build if the frontend changes affect compilation paths
- run `npm run dev` from the repo root and verify the frontend uses FastAPI rather than mock mode

## Implementation Boundaries

Do this now:

- make local integrated development default to real backend mode
- align the frontend main-flow client to real backend contracts
- add focused tests for the backend contract that supports the main flow
- verify the flow against the running local stack

Do not do this now:

- database integration
- auth redesign
- file storage redesign
- route additions for secondary features that are not used by the confirmed main flow

## Risks

1. The frontend type expectations may be slightly broader than the backend seeded data currently supports.
   Mitigation: verify each main-flow page against the concrete API responses and patch only the mismatches.

2. Some UI branches may implicitly rely on mock timing or mock-only fields.
   Mitigation: remove those assumptions only where they affect the confirmed flows, and keep the mock path intact behind the flag.

3. Port fallback can hide bad assumptions about the backend base URL.
   Mitigation: keep backend URL injection inside the root dev script and verify the actual runtime URL pair before completion.

## Success Criteria

This task is complete when all of the following are true:

- repo-root `npm run dev` starts both services and points the frontend at FastAPI automatically
- the confirmed five frontend flows use real backend requests instead of `mock-backend.ts`
- backend tests cover the main contract surface
- local verification confirms the app works against the running FastAPI service
