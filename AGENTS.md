# Repository Guidelines

## Project Structure & Module Organization

- `apps/web/`: Next.js 14 PWA frontend with TypeScript, Tailwind CSS, and Zustand. Routes live in `app/`, reusable UI in `components/`, state stores in `store/`, shared helpers and seed/mock data in `lib/`, and static assets in `public/`.
- `apps/api/`: FastAPI backend. `main.py` is the entry point; routes are in `app/api/routes/`, Pydantic contracts in `app/schemas.py`, config in `app/core/`, in-memory data in `app/db/`, agent graph code in `app/agent/`, and domain logic in `app/services/`.
- `apps/api/tests/`: pytest backend tests.
- `docs/v0.1/`: product, design, technical, execution, and test-case documents.

## Build, Test, and Development Commands

Run frontend commands from `apps/web/`:

- `npm install`: install frontend dependencies.
- `npm run dev`: start the local Next.js server at `http://localhost:3000`.
- `npm run build`: create a production build.
- `npm run lint`: run Next.js lint checks.

Run backend commands from `apps/api/`:

- `python -m venv .venv` and `.venv\Scripts\Activate.ps1`: create and activate a Windows virtual environment.
- `pip install -e .`: install the API package and dependencies.
- `uvicorn main:app --reload --port 8000`: run the API at `http://localhost:8000`.
- `pytest`: run backend tests from `apps/api/tests/`.

## Coding Style & Naming Conventions

Use TypeScript strict mode and prefer the `@/*` path alias. Name React components in `PascalCase`, Zustand stores as `*-store.ts`, route files as `page.tsx`, and utility modules with concise domain names such as `warranty.ts` or `api-client.ts`. Prefer Tailwind utilities for styling.

Python code should use type hints, Pydantic models for API contracts, and service modules for reusable business rules. Keep route handlers thin.

## Testing Guidelines

Backend tests use pytest. Add tests under `apps/api/tests/` with filenames like `test_warranty.py`; test functions should start with `test_`. Cover service rules before route wiring. For frontend changes, run `npm run build`; add screenshots when UI behavior changes.

## Commit & Pull Request Guidelines

Git history currently only establishes `first commit`, so use short imperative messages with an optional scope, for example `web: add reminder filters` or `api: validate warranty periods`.

Pull requests should describe the user-facing change, list validation commands, call out mock versus real behavior, link related issues or docs, and include screenshots for visible frontend changes.

## Security & Configuration Tips

Copy `.env.example` for local settings and never commit secrets. v0.1 uses mock auth, mock file handling, and in-memory backend data by default; document any change that introduces real external services or persistence.
