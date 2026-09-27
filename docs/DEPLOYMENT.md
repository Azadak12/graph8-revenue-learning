# Deployment

There are now two ways to deploy this app. Neither can be triggered from this
sandbox (no hosting credentials are available here) — you connect your own
account and it takes it from there.

## Option A (recommended): single Vercel project — `nextapp/`

`nextapp/` is a full Next.js port of both the FastAPI backend and the React
frontend, deployable as one Vercel project with no separate host needed. The
original `backend/` and `frontend/` directories are unchanged and still work
for local Docker Compose use (see Option B) — `nextapp/` is additive.

**What changed vs. the original stack, and why:**
- **Database**: SQLAlchemy/Alembic → Prisma, same Postgres schema (needs any
  Postgres — Vercel Postgres, Neon, Supabase, etc.).
- **Background jobs**: the original used RQ + Redis (a persistent worker
  process), which Vercel's serverless functions can't run. Webhook/investigation
  processing now runs **synchronously inside the API route** instead of being
  queued. This is simpler but means a slow LLM call could hit Vercel's function
  timeout (10s on Hobby, up to 300s on Pro) — move this to a real queue (e.g.
  Upstash + QStash) if you need it for high-volume production traffic.
- **Frontend**: copied into `nextapp/src` **unmodified** (same components,
  same `react-router-dom` client-side routing) and mounted inside a Next.js
  catch-all route, so none of the UI behavior changed — only where it's hosted.
- **Secrets encryption**: Python's Fernet → AES-256-GCM (Node's built-in
  `crypto`), same purpose (encrypting the Graph8 API key at rest).

### Steps

1. In Vercel: **New Project → Import** this repo.
2. Set **Root Directory** to `nextapp`.
3. Framework preset: Next.js (auto-detected).
4. Add a Postgres database (Vercel Postgres, Neon, or Supabase all work) and
   set its connection string as `DATABASE_URL`.
5. Add environment variables (see `nextapp/.env.example`):
   - `JWT_SECRET`, `SECRET_ENCRYPTION_KEY` — generate random values
   - `ANTHROPIC_API_KEY` — omit to run the deterministic demo extractor
   - `GRAPH8_API_KEY` / `GRAPH8_WEBHOOK_SECRET` — omit to run in Demo Mode
6. Deploy.
7. Run migrations and seed the demo data **once**, from your machine, pointed
   at the production `DATABASE_URL` (the initial migration is already
   committed under `nextapp/prisma/migrations/`):
   ```
   cd nextapp
   npm install
   DATABASE_URL="<your prod connection string>" npx prisma migrate deploy
   DATABASE_URL="<your prod connection string>" npm run seed
   ```
8. Log in with the seeded demo user: `demo@graph8.com` / `demo1234`.

## Option B: split deploy — Render (backend) + Vercel (frontend)

The original FastAPI + React stack, unchanged, split across two platforms.

### Backend + worker + Postgres + Redis → Render

A Render Blueprint is defined in `render.yaml` at the repo root. It provisions:

- `g8-postgres` — managed Postgres
- `g8-redis` — managed Redis
- `g8-backend` — the FastAPI web service (runs `alembic upgrade head` then `uvicorn`)
- `g8-worker` — the RQ worker (`python worker.py`)

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

### Frontend → Vercel

`frontend/vercel.json` configures the build and SPA routing fallback for
`react-router-dom`.

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
VPS deploy if you'd rather not use either option above.
