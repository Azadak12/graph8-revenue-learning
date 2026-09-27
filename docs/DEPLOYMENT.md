# Deployment

This repo ships config for two managed platforms. Neither can be triggered from
this sandbox (no hosting credentials are available here) — you connect your
own account and it takes it from there.

## Backend + worker + Postgres + Redis → Render

A Render Blueprint is defined in `render.yaml` at the repo root. It provisions:

- `g8-postgres` — managed Postgres
- `g8-redis` — managed Redis
- `g8-backend` — the FastAPI web service (runs `alembic upgrade head` then `uvicorn`)
- `g8-worker` — the RQ worker (`python worker.py`)

### Steps

1. Push this branch to GitHub (already done if you're reading this from the repo).
2. In the Render dashboard: **New → Blueprint**, point it at this repo, select
   the branch, and Render reads `render.yaml` automatically.
3. Render generates `JWT_SECRET` and `SECRET_ENCRYPTION_KEY` for you and wires
   `DATABASE_URL`/`REDIS_URL` from the provisioned services automatically.
4. Set the remaining secrets in the Render dashboard (they're intentionally
   left blank in `render.yaml` — `sync: false`):
   - `ANTHROPIC_API_KEY` — omit to run the deterministic demo extractor
   - `GRAPH8_API_KEY` / `GRAPH8_WEBHOOK_SECRET` — omit to run in Demo Mode
   - `CORS_ORIGINS` — JSON array of allowed origins, e.g.
     `["https://your-app.vercel.app"]`
5. Deploy. Note the backend's public URL (e.g. `https://g8-backend.onrender.com`).

## Frontend → Vercel

`frontend/vercel.json` configures the build and SPA routing fallback for
`react-router-dom`.

### Steps

1. In Vercel: **New Project → Import** this repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite (auto-detected). Build command / output directory
   are set in `frontend/vercel.json`.
4. Add an environment variable:
   - `VITE_API_BASE_URL` = the Render backend URL from the step above
5. Deploy. Once live, add the Vercel URL to the backend's `CORS_ORIGINS`.

## Local / self-hosted alternative

`docker-compose.yml` at the repo root runs the full stack (Postgres, Redis,
backend, worker, frontend behind nginx) on a single host — use it as-is for a
VPS deploy if you'd rather not split across Render/Vercel.
