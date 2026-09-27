# Graph8 Revenue Learning — Architecture Plan

**Module:** Win/Loss Intelligence · *"Every deal teaches the next one."*

This document is the pre-build plan required before implementation: assumptions, confirmed vs.
unconfirmed Graph8 capabilities, data model, API contract, folder structure, and milestones.

---

## 1. Graph8 capabilities — confirmed vs. assumed

Graph8 (`graph8.com`) is a real GTM/revenue platform with a REST API, webhooks, and an MCP server.
Its public docs pages are mostly JS-rendered app shells, so only part of the reference was
fetchable. What follows is split explicitly into **confirmed** (quoted from fetched pages) and
**assumed** (a reasonable, clearly-labeled placeholder pending real API access).

### Confirmed (from `graph8.com/roles/developers` and `be.graph8.com/api/v1/docs`)

- Base URL: `https://be.graph8.com/api/v1`
- Auth: Bearer token in `Authorization` header. Org is resolved from the key server-side —
  **the client must never send `organization_id` and trust it; it's for our own tenant scoping only.**
- Rate limits: 50 req/s and 1,000 req/min per org, surfaced via `X-RateLimit-*` response headers,
  `429` responses carry `Retry-After`.
- Every response wraps payload in a `data` field; list responses paginate with
  `page`, `limit`, `total`, `has_next`, `next_cursor`.
- Resource surfaces exist for: Data (`/contacts` — contacts, companies, lists, fields, notes,
  tasks, deals), Signals (`/intent`), Studio (`/campaigns`), Engage (`/sequences`),
  Revenue (`/quotes` — quotes, **pipelines**, two-way CRM sync), Agents (`/workflows` — workflows,
  skills, **MCP**, repos).
- `/tasks/{task_id}/subtasks`, `/tasks/{task_id}/replies`, `/tasks/{task_id}/resolve`,
  `/tasks/{task_id}/snooze` confirmed to exist as real endpoints — i.e. **tasks with threaded
  replies are a real, documented mechanism**, which is what we use for salesperson clarification
  (spec §12) instead of inventing a notification API.
- Webhooks are signed with **HMAC-SHA256 over a timestamp + raw body**, and Graph8 rejects
  deliveries more than 5 minutes old. 37 webhook event types exist (exact names not enumerated in
  fetchable content).
- An OpenAPI 3.1 spec exists (`be.graph8.com/api/v1/openapi.json` / Swagger UI at
  `be.graph8.com/api/v1/docs`) — too large to fully retrieve via automated fetch in this session.

### Assumed / NOT confirmed — must be verified against the live OpenAPI spec before go-live

These are placeholders, isolated entirely behind `Graph8Client`/`Graph8Provider` so swapping them
later never touches business logic:

- Exact webhook event names (`deal.won`, `deal.lost`, `deal.stage_changed` — used because the
  product brief specifies them; not verified against the real 37 event types).
  - Signature/timestamp header names (assumed `X-Graph8-Signature` / `X-Graph8-Timestamp`).
- Exact `/deals` CRUD paths and field names (assumed `GET/POST /deals`, `GET /deals/{id}`,
  `GET /deals/{id}/contacts`, `GET /deals/{id}/activities`, `GET /pipelines`, `GET /pipelines/{id}/stages`).
- Deal-contact role enum (`champion`, `decision_maker`, `influencer`, `blocker`, `coach`,
  `end_user`) — used as specified in the brief; not verified.
- Meeting/transcript retrieval endpoint and shape (assumed under `/meetings`, transcript text may
  not be available for every meeting — code must treat it as optional).
- Whether MCP exposes a "create note/mention" tool vs. only tasks — brief says prefer a native
  bell-notification mechanism if documented; **none was found**, so **Graph8 tasks are the
  authoritative clarification mechanism**, with a note attached as a best-effort secondary channel.

**Action before production:** obtain a Graph8 developer account, pull the live OpenAPI JSON, and
update `backend/app/services/graph8/live_provider.py` + `webhook event enum` accordingly. Nothing
else in the codebase should need to change (see §4 adapter boundary).

---

## 2. Product philosophy (recap, enforced in code, not just prompts)

- Every AI conclusion carries an evidence list; the API refuses to persist a `DealFactor` without
  at least one linked `DealEvidence` row (or `UNKNOWN` / `confidence=LOW`).
- Won deals are a control group. The **pattern engine is deterministic Python**, not the LLM: it
  computes lost-vs-won ratios per factor per segment and assigns a `PatternStrength` enum. The LLM
  never invents statistics.
- Confidence is a first-class enum (`HIGH`/`MEDIUM`/`LOW`) plus `UNKNOWN` as a valid terminal
  state — the UI must be able to render "we don't know" as a legitimate, good outcome.
- Human correction is additive: `HumanFeedback` rows layer on top of `DealAnalysis`; the original
  AI output is never overwritten, only superseded (new `analysis_version`).
- No Graph8 write action happens without a human clicking "Approve" — enforced at the API layer,
  not just the UI (the endpoint that creates Graph8 tasks requires `RecommendationAction.status ==
  APPROVED` set by an authenticated user in the same request/prior step).

---

## 3. Vertical slice scope for this build

Full spec is a multi-quarter product. This build delivers the **complete demo vertical slice**
end-to-end in Demo Mode, with production-shaped architecture (multi-tenant, async, versioned,
adapter-isolated) so Live Mode is a swap-in, not a rewrite:

- ✅ Full data model, migrations, multi-tenant scoping
- ✅ Demo Graph8 provider with seeded 20-deal dataset telling the SCIM / early-DM / mid-market
  pricing story
- ✅ Webhook ingestion endpoint (signature verify + idempotency + queue), works against demo
  provider's simulated events
- ✅ Async investigation worker: evidence bundle → structured LLM extraction → factor/evidence
  persistence
- ✅ Deterministic pattern engine (won/lost comparison, sample-size thresholds, pattern strength)
- ✅ Recommendation engine (department-tagged, human-approval-gated Graph8 task creation)
- ✅ Human feedback / clarification loop (Graph8 task creation stub + correction UI)
- ✅ Future deal warnings via structured similarity
- ✅ Full React UI: Overview, Deals, Deal Detail, Learnings, Recommendations, Ask Revenue Learning
  (rule-based + LLM over structured DB, no live MCP dependency), Settings
- 🧩 Live Graph8 adapter: interface + REST client scaffold implemented against confirmed
  endpoints/auth; event-name/webhook specifics marked `# UNCONFIRMED` and gated behind
  `GRAPH8_API_KEY` — not exercised against a real tenant in this session (no credentials available)
- 🧩 MCP agent integration: service boundary + tool-call abstraction built; actual MCP tool
  invocation stubbed behind the same provider interface, since it requires a live Graph8 MCP
  connection this session does not have

---

## 4. High-level architecture

```
Graph8  --webhook(deal.won/lost)-->  /api/webhooks/graph8  --(verify+store+ack 202)-->  Postgres(webhook_events)
                                                                          |
                                                                          v
                                                                     Redis queue (RQ)
                                                                          |
                                                                          v
                                                      investigation_worker (async)
                                                        1. Graph8Provider.fetch_deal_bundle()
                                                        2. evidence normalization
                                                        3. LLM structured extraction (factors)
                                                        4. persist DealAnalysis/DealFactor/DealEvidence
                                                        5. pattern_engine.refresh(segment)
                                                        6. recommendation_engine.refresh(pattern)
                                                        7. future_warning_engine.refresh_active_deals()
                                                          |
                                                          v
                                                     Postgres (source of truth)
                                                          ^
                                                          |
FastAPI REST API  <---------------------------------------
      ^
      |
React SPA (Overview / Deals / Learnings / Recommendations / Ask / Settings)
      |
      v
"Ask Revenue Learning" agent: reads structured DB first; falls back to Graph8Provider/MCP
for live context; never recomputes analytics from raw transcripts per-question.
```

Adapter boundary: **all** Graph8 access goes through `Graph8Provider` (abstract base class) with
`DemoGraph8Provider` and `LiveGraph8Provider` implementations, selected once at app startup based
on `GRAPH8_API_KEY` presence. Business logic (investigation, patterns, recommendations) depends
only on the provider interface and our own ORM models — never on Demo/Live specifics.

---

## 5. Data model

See `backend/app/models/` for the SQLAlchemy source of truth. Summary (all tables carry
`organization_id`, indexed, and are never queryable without a tenant filter applied by the
repository layer):

- **Organization** — id, name, created_at
- **User** — id, organization_id, email, name, role (enum: admin/rev_leader/manager/rep/read_only), created_at
- **Graph8Connection** — id, organization_id, mode (demo/live), encrypted_api_key_ref, status, graph8_org_id, last_sync_at
- **WebhookEvent** — id, organization_id, external_event_id, event_type, graph8_deal_id, payload (JSONB), received_at, processing_status (enum), error, unique(organization_id, external_event_id)
- **Deal** — id, organization_id, graph8_deal_id, name, company_name, industry, segment (enum: enterprise/mid_market/smb), amount, currency, pipeline_id, stage_id, owner_id/name, outcome (enum: open/won/lost), created_at, closed_at, synced_at
- **DealSnapshot** — id, deal_id, stage_id, stage_name, entered_at, exited_at (stage-timeline history)
- **DealContact** — id, deal_id, name, title, role (enum: champion/decision_maker/influencer/blocker/coach/end_user/unknown), engaged_at
- **DealEvidence** — id, organization_id, deal_id, analysis_id (nullable), source_type (enum), source_external_id, source_timestamp, finding, excerpt, strength (enum: weak/moderate/strong), created_at
- **DealAnalysis** — id, organization_id, deal_id, analysis_version, prompt_version, model_identifier, taxonomy_version, outcome, summary, primary_factor_id (FK), confidence (enum incl. UNKNOWN), human_confirmation_required, status (enum: pending/processing/completed/needs_clarification/failed), created_at, completed_at
- **DealFactor** — id, organization_id, deal_analysis_id, category (enum taxonomy §9), specific_issue, factor_type (primary/secondary), confidence, preventability (enum), department (enum), is_primary
- **HumanFeedback** — id, organization_id, deal_id, analysis_id, user_id, feedback_type (enum: clarification/correction), selected_reason, override_category, was_seller_controllable, comment, created_at
- **Pattern** — id, organization_id, name, category, segment_definition (JSONB), lost_count, won_count, sample_size, pattern_strength (enum: one_off/emerging/recurring/strong), confidence, status (active/resolved), first_detected_at, last_detected_at
- **PatternOccurrence** — id, pattern_id, deal_id, deal_factor_id, outcome
- **Recommendation** — id, organization_id, pattern_id, department, title, explanation, recommended_action, priority (enum), status (enum: proposed/approved/actioned/dismissed)
- **RecommendationAction** — id, recommendation_id, action_type (create_task/create_note), status (proposed/approved/created/failed), approved_by_user_id, approved_at, graph8_object_type, graph8_object_id, created_at
- **FutureDealWarning** — id, organization_id, deal_id, pattern_id, explanation, similarity_basis (JSONB), status (open/acknowledged/dismissed), created_at
- **AgentRun** — id, organization_id, user_id, question, answer, tools_used (JSONB), created_at
- **AuditLog** — id, organization_id, actor_user_id, action, entity_type, entity_id, metadata (JSONB), created_at

Full column-level definitions with types/constraints live in the SQLAlchemy models
(`backend/app/models/*.py`) and the Alembic migration — this doc is the summary, the code is the
source of truth per §35.

---

## 6. API contract (summary — see `backend/app/api/` routers for full request/response schemas)

```
POST   /api/webhooks/graph8                      verify, store, enqueue, 202 fast-ack
GET    /api/organizations/me                     current org + connection mode

GET    /api/deals?outcome=&segment=&industry=&cursor=      paginated deal list
GET    /api/deals/{id}                           deal + latest analysis + evidence + factors
GET    /api/deals/{id}/warnings                  future-deal warnings for an active deal
POST   /api/deals/{id}/warnings/{warning_id}/ack {status: acknowledged|dismissed|task_created}
POST   /api/deals/{id}/reanalyze                 force re-run (new analysis_version)

GET    /api/deals/{id}/evidence                  evidence cards for "why do we think this"

POST   /api/deals/{id}/feedback                  HumanFeedback (clarification answer or correction)

GET    /api/learnings                            list Patterns (won/lost comparison, strength, confidence)
GET    /api/learnings/{pattern_id}                pattern detail + occurrences + evidence rollup

GET    /api/recommendations?department=&status=  grouped by department
POST   /api/recommendations/{id}/actions          propose RecommendationAction
POST   /api/recommendations/actions/{id}/approve  human approval -> triggers Graph8 write (async)

GET    /api/overview                              executive summary payload for Overview page

POST   /api/agent/ask                             {question} -> {answer, sources[], suggested_actions[]}

GET    /api/settings/graph8-connection
POST   /api/settings/graph8-connection            configure API key (write-only, never echoed back)
```

All endpoints require an authenticated session; `organization_id` is derived server-side from the
authenticated user, never accepted from the client body/query.

---

## 7. Folder structure

```
graph8-revenue-learning/
  docs/
    ARCHITECTURE.md
  backend/
    app/
      api/                 # FastAPI routers (thin controllers)
      core/                # config, logging, settings
      db/                  # session, base, tenant-scoping helpers
      models/               # SQLAlchemy models
      schemas/              # Pydantic request/response + structured-output schemas
      repositories/         # tenant-scoped data access
      services/
        graph8/             # Graph8Provider ABC, Demo/Live providers, webhook verification
        investigations/      # evidence bundling + orchestration
        evidence/             # normalization helpers
        patterns/             # deterministic pattern engine
        recommendations/      # recommendation + Graph8 action execution
        agents/               # Ask Revenue Learning agent
      workers/              # RQ job entrypoints
      security/             # auth, RBAC, encryption helpers
      seed/                 # demo dataset + seed script
      tests/
    alembic/
    pyproject.toml / requirements.txt
    Dockerfile
  frontend/
    src/
      api/
      components/
      features/
        overview/ deals/ learnings/ recommendations/ agent/ settings/
      hooks/
      types/
      utils/
    Dockerfile
  docker-compose.yml
  .env.example
  README.md
```

---

## 8. Milestones (this session)

1. Repo scaffold, Docker Compose (Postgres, Redis, backend, worker, frontend), env config
2. Data model + Alembic migration + tenant-scoping base
3. Demo Graph8 provider + seed script (20 deals, deliberate patterns)
4. Investigation engine (evidence bundle, structured LLM extraction, persistence)
5. Pattern engine (deterministic won/lost comparison)
6. Recommendation engine + human-approval-gated action execution (stubbed Graph8 write in demo mode)
7. Webhook endpoint + idempotency + RQ worker wiring
8. REST API surface for all pages
9. React UI: Overview, Deals, Deal Detail, Learnings, Recommendations, Ask, Settings
10. Human feedback / clarification loop + future warnings
11. README, seed instructions, demo script
