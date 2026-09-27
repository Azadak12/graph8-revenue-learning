# Graph8 Revenue Learning — Win/Loss Intelligence

*"Every deal teaches the next one."*

A revenue intelligence module for [Graph8](https://graph8.com) that turns every closed deal — **won
and lost** — into organizational memory: evidence-backed investigations, statistically-honest
won-vs-lost pattern detection, department-owned recommendations, human approval before any write
back to Graph8, and contextual warnings on active deals that resemble deals the organization has
already lost before.

**🔗 Live demo:** _[link added after deploy]_ · **Login:** `demo@graph8.com` / `demo1234`

---

## The problem

CRMs are very good at recording *that* a deal was won or lost. They are almost never good at
turning that history into something the organization actually learns from. In practice:

- A rep loses a deal to a competitor's missing feature. Three months later, a different rep in a
  different region loses an almost identical deal to the same gap — and nobody connects the two.
- "Lost — pricing" gets typed into a dropdown and never looked at again. Nobody asks whether that
  pricing objection is a one-off, or the fifth time this quarter the same packaging issue has come up
  in the same segment.
- Won deals are treated as the end of the story, when they're actually the control group: if
  something shows up equally often in **wins**, it isn't what caused the losses.
- When someone tries to dig in manually, it means combing through call notes and CRM activity by
  hand — slow enough that it almost never happens, so the same mistakes repeat.

The result: revenue teams re-litigate the same root causes every quarter without ever building
institutional memory, and the departments who could actually fix the recurring issue (Product,
Pricing, Security, Legal) rarely even hear about it in a form they can act on.

## The solution

This module sits on top of Graph8 and closes that loop automatically:

```
Deal closes (won/lost) in Graph8
        │  webhook
        ▼
Evidence gathering  ──  stage history, stakeholders, meeting notes, objections
        │
        ▼
AI extraction  ──  a structured-output LLM call identifies candidate factors,
        │           grounded in the evidence — never a bare guess
        ▼
Deterministic comparison  ──  plain Python checks this factor against every
        │                     other won/lost deal in the same segment: is this
        │                     a real pattern, or does it show up in wins too?
        ▼
Department-owned recommendation  ──  "Product: evaluate SCIM support";
        │                            "Sales: confirm the buying committee earlier"
        ▼
Human approval  ──  a person clicks approve; only then does a Graph8 task get created
        ▼
Future deal warning  ──  an active deal that looks like the pattern gets flagged,
                          before it repeats the same mistake
```

Every claim in the product is either backed by a cited piece of evidence you can click into, or
explicitly labeled low-confidence / unknown. The system is built to say **"we don't have enough
evidence to know"** rather than force a conclusion — that's treated as a correct outcome, not a
failure. See [Product philosophy](#product-philosophy) below for why that matters.

## How it works — feature by feature

### Overview
The executive entry point: "What are we learning from our deals?" — a plain-language summary of
the strongest patterns detected so far, an overall won/lost ratio, and a **"Needs quick attention"**
panel that surfaces two kinds of urgent items: deals stuck waiting on a rep to answer a clarifying
question, and recurring, seller-controllable coaching findings for individual reps (e.g. "Priya
should work on discovery — seen in 2 lost deals"), each linking straight to the deals behind it.

### Deals
Every closed (and open) deal, with a computed primary factor and confidence level. Selecting a deal
opens a full investigation:
- **Stage timeline** — how long the deal spent in each pipeline stage, and which stage it closed in
- **What happened** — a hedged, evidence-grounded summary ("appears to have been lost primarily due
  to...", never "definitely caused by")
- **Why we think this happened** — the primary and secondary factors, each with an expandable "why do
  we think this?" showing the actual evidence (meeting notes, activity records) behind it
- **Stakeholders** — who was involved and their role (champion, decision maker, blocker, etc.)
- **Correction** — a rep can answer a short clarification form or correct the AI's read entirely; the
  original AI analysis is preserved in audit history, never overwritten

Buyer-side losses (a budget freeze, an internal reorg) are explicitly tagged as **not preventable**
and routed to Leadership, not blamed on the sales rep.

### Learnings
The organizational intelligence center: patterns detected by comparing the lost cohort against the
won cohort for the same segment, each labeled by strength (**one-off** / **emerging** / **recurring**
/ **strong**) and confidence, with a won/lost ratio bar and a full list of the deals behind it. A
pattern only gets flagged as real once it clears a minimum sample size and shows up
disproportionately more in losses than in wins — a factor that appears equally in both cohorts is
correctly treated as a normal segment characteristic, not a cause.

### Recommendations
Patterns become department-owned actions — Product, Pricing, Sales, Sales Engineering, Leadership —
each with a specific recommended action and a **"Create Graph8 task"** button. Nothing is written to
Graph8 automatically: a human has to click approve, and every approval is audit-logged (who, when,
what Graph8 object was created).

### Ask Revenue Learning
A conversational interface over the same structured database — "Why are we losing enterprise
deals?", "What are successful deals doing differently?", "Which active deals should we watch?" — that
answers from the already-computed patterns rather than re-deriving statistics from raw text on every
question.

### Settings
Graph8 connection management (Demo Mode vs. Live Mode, API key entry — encrypted at rest, never
echoed back) and a **Demo console** that simulates Graph8 delivering a `deal.won` / `deal.lost`
webhook for a seeded deal, driving the exact same async pipeline a real webhook would use, so you can
watch the whole investigation run live.

## Product philosophy

- **Evidence first.** No conclusion is persisted without at least one linked evidence record, or an
  explicit `UNKNOWN` / low-confidence state.
- **Won deals are the control group.** The pattern engine is plain, deterministic Python — never the
  LLM — precisely so a factor that's just as common in wins can't be miscast as a cause of losses.
- **Hedged language, always.** "Appears to have," "was associated with," "may have contributed" —
  never "definitely caused," unless the evidence genuinely supports certainty.
- **Human correction is additive.** A rep's correction layers on top of the AI's original read; the
  original is kept in audit history, never silently overwritten.
- **No Graph8 write without a human clicking approve.** Enforced at the API layer, not just the UI.
- **No fabricated statistics.** Sample sizes, win rates, and pattern strength are computed in code
  from real rows in the database — the LLM only ever extracts and explains, never counts.

## Demo data

The live demo runs against 20 seeded, clearly-labeled **fictional** deals (8 won, 12 lost) with
deliberate, realistic patterns built in: a SCIM/identity-provisioning gap recurring in enterprise
financial-services losses (and absent from every comparable win), decision-makers engaging early in
wins vs. late in losses, mid-market pricing/packaging friction, a buyer-side budget freeze correctly
*not* blamed on the seller, and one deal with genuinely insufficient evidence, correctly left
`UNKNOWN` rather than forced to a conclusion.

## Architecture & tech stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Tailwind CSS (Vite) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via SQLAlchemy + Alembic migrations |
| Async jobs | Redis + RQ (webhook → queue → worker, never inline) |
| AI | Anthropic Claude with strict structured tool-use output (falls back to a deterministic offline extractor when no API key is set, so the full pipeline works without credentials) |
| Auth | JWT, bcrypt-hashed passwords |
| Secrets | Fernet-encrypted Graph8 API keys at rest |

Full data model, API contract, and the Graph8 adapter design are documented in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Multi-tenant by design
Every business table is scoped by `organization_id`. Demo Mode and Live Mode are just two
implementations of one `Graph8Provider` interface — switching an organization to a real Graph8
account changes nothing else in the codebase.

## Graph8 integration status

Graph8 is a real GTM/revenue platform. Its REST API (`https://be.graph8.com/api/v1`, bearer auth,
`X-RateLimit-*` headers, `data`-enveloped responses), rate limits, and `/tasks` resource (used as the
mechanism for salesperson clarification) were **confirmed** directly against its live OpenAPI spec.
A few specifics were **not** confirmed and are explicitly marked `UNCONFIRMED` in
`backend/app/services/graph8/live_provider.py` and `webhook_security.py` — isolated behind the
provider interface so only that one file needs to change once verified:

- Exact webhook signature/timestamp header names (HMAC-SHA256 scheme is confirmed; header names
  aren't documented in the public spec)
- Meeting/transcript retrieval is not exposed as a per-deal endpoint in Graph8's API; the adapter
  folds `/activities` and `/history` into evidence instead and documents the gap rather than
  inventing an endpoint

Notably, integrating against the real spec corrected several assumptions from the original brief:
there is **no** `deal.lost` webhook event (only `deal.won`, `deal.updated`, `deal.stage_changed`,
etc.) — a loss is only observable as an update carrying a `closed_lost_reason` — and deal outcome is
a query filter (`GET /deals?outcome=lost`), not a field on the deal object itself. The code handles
both correctly.

## AI extraction: real LLM vs. offline fallback

`backend/app/services/investigations/llm/factory.py` picks the extractor per request:

- **`ANTHROPIC_API_KEY` set** → calls Claude with a forced tool-use call (`record_deal_analysis`),
  validated against a strict Pydantic schema. The intended production path.
- **Not set** → a deterministic extractor replays the seed data's ground truth (and returns an honest
  `UNKNOWN` for anything without one), so the entire pipeline — persistence, pattern engine,
  recommendations, UI — runs fully offline with zero API credentials required.

## Getting started

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
docker compose exec backend python -m app.seed.run_seed
```

- Frontend: http://localhost:5173
- Backend health check: http://localhost:8000/api/health
- Login: `demo@graph8.com` / `demo1234`

### Local, without Docker

Requires Postgres and Redis running locally (`brew install postgresql@16 redis` on macOS).

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+psycopg://<user>@localhost:5432/revenue_learning"
export REDIS_URL="redis://localhost:6379/0"
createdb revenue_learning
alembic upgrade head
python -m app.seed.run_seed
uvicorn app.main:app --reload --port 8000   # terminal 1
python worker.py                             # terminal 2

# Frontend
cd frontend
npm install
cp .env.example .env   # point VITE_API_BASE_URL at your backend
npm run dev
```

## Repository layout

```
backend/app/
  api/                FastAPI routers (thin controllers)
  core/               config, logging
  db/                 session, tenant-scoping base
  models/             SQLAlchemy models
  schemas/            Pydantic request/response + the strict LLM output schema
  services/
    graph8/             Graph8Provider interface, Demo/Live providers, webhook verification
    investigations/     evidence orchestration, LLM extractor(s), clarification, feedback
    evidence/            raw Graph8 bundle -> bounded evidence-bundle normalization
    patterns/            deterministic won/lost pattern engine
    recommendations/     rule-based recommendations + approval-gated Graph8 actions
    reps/                per-rep coaching insight engine
    warnings/            future-deal warning matching
    agents/              Ask Revenue Learning agent + MCP client boundary
  workers/            RQ job entrypoints
  security/           auth (JWT), secret encryption
  seed/               demo dataset + seed script
frontend/src/
  api/, components/, features/{overview,deals,learnings,recommendations,agent,settings}/, hooks/, types/
docs/
  ARCHITECTURE.md     full data model, API contract, Graph8 confirmed/unconfirmed detail log
```

## Known simplifications / non-goals

- Single demo tenant with one seeded user; RBAC roles exist in the data model but aren't yet enforced
  per-endpoint beyond authentication.
- `LiveGraph8Provider` webhook signature specifics remain unverified placeholders (see above) —
  intentional, not an oversight, per the brief's instruction to flag rather than invent.
- The MCP agent boundary is a defined interface, not a live connection — no Graph8 MCP server is
  reachable from this environment.
- Explicitly out of scope: a full CRM, forecasting, autonomous destructive Graph8 writes, and
  fabricated win-probability scores.

## License

MIT
