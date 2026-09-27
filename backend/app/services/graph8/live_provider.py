"""LiveGraph8Provider: talks to the real Graph8 REST API.

Verified 2026-09-27 against a real Graph8 workspace's live OpenAPI spec
(`GET /openapi.json`, ~6MB, pulled directly with a real API key rather than
through the JS-rendered docs site) and a handful of live read-only calls. That
verification run found the account itself has no deals/contacts/companies yet
(a freshly-provisioned, empty workspace) -- so every code path below is
schema-verified but has not yet been exercised against a populated tenant.

CONFIRMED (from the live spec + live calls):
  - base URL https://be.graph8.com/api/v1, Bearer auth, org resolved from the key
  - responses wrap payload in `data`; lists paginate with page/limit/total/has_next/next_cursor
    (though some list endpoints, e.g. /deals/pipelines, return `pagination: null` instead)
  - rate limits: 50 req/s, 1000 req/min per org, `X-RateLimit-*` headers, 429 + Retry-After
  - `GET/POST /deals`, `GET/PATCH/DELETE /deals/{id}`, `GET/POST /deals/{id}/contacts`,
    `GET/POST /deals/{id}/notes`, `GET /deals/{id}/activities`, `GET /deals/{id}/history`,
    `GET /deals/pipelines`, `GET /deals/close-reasons`, `GET /companies/{id}` all exist as
    documented, real, schema-typed endpoints.
  - `DealResponse` has NO `outcome`/`segment`/`industry` field. Outcome is derived server-side
    and only exposed as a `GET /deals?outcome=won|lost|open` filter -- to classify a single
    deal fetched by id, this provider uses the documented `closed_lost_reason` field (present
    only on losses) and `close_date` (present once closed) instead.
  - `GET /deals/{id}/contacts` returns `data.contacts` (a nested object with a `contacts` list +
    `total`), NOT a bare list under `data` like other endpoints -- a real structural quirk.
  - Deal-contact role enum is exactly champion/decision_maker/influencer/blocker/coach/end_user,
    confirmed verbatim in the `ContactBrief`/`DealContact` schema docstrings.
  - `POST /tasks` body is `{title, description, due_date, assignee_id, priority (0-4),
    records: [{"type": "deal", "id": ...}, ...], ...}` -- linking via `records`, not a bare
    `deal_id` field.
  - `POST /deals/{id}/notes` body is just `{"content": "..."}` (deal-scoped, not a global
    `/notes` endpoint).
  - Webhook event catalog (`GET /webhooks/events`, live-fetched) has NO `deal.lost` event.
    The real Deals category is: deal.won, deal.created, deal.updated, deal.stage_changed,
    deal.deleted. A loss is therefore only observable as a deal.updated/deal.stage_changed
    delivery whose deal now has `closed_lost_reason` set -- see api/routers/webhooks.py.

STILL UNCONFIRMED (undiscoverable from the OpenAPI spec, which doesn't model delivery
headers) -- do not treat these as verified:
  - Exact webhook signature/timestamp header names (webhook_security.py's constants remain
    placeholders; `POST /webhooks` does return a per-webhook `secret` on creation, confirming
    a per-webhook, not a single global, signing secret).
  - There is no dedicated "meetings for this deal" or transcript-per-deal endpoint; meeting
    transcripts live under a separate top-level `/meeting-transcripts` resource whose linkage
    back to a specific deal was not established. `get_deal_bundle` below folds `/activities`
    and `/history` into evidence instead and leaves meeting transcripts as a documented gap.
  - No explicit company size/segment field was found; `_infer_segment` below is a heuristic
    over `employee_count`, not a Graph8-documented classification.
"""

from __future__ import annotations

from datetime import datetime

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.services.graph8.base import Graph8Provider
from app.services.graph8.schemas import (
    G8Contact,
    G8Deal,
    G8DealBundle,
    G8Meeting,
    G8Note,
    G8StageEvent,
)


class Graph8RateLimitError(Exception):
    pass


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _infer_segment(employee_count: str | None) -> str:
    """Heuristic only -- Graph8 does not expose a segment/company-size tier directly.

    `employee_count` on CompanyResponse is a free-form string (observed shapes were not
    populated in the verified account), so this parses leading digits defensively rather
    than assuming a fixed bucket format.
    """
    if not employee_count:
        return "mid_market"
    digits = "".join(ch for ch in employee_count if ch.isdigit())
    if not digits:
        return "mid_market"
    n = int(digits)
    if n >= 1000:
        return "enterprise"
    if n <= 50:
        return "smb"
    return "mid_market"


class LiveGraph8Provider(Graph8Provider):
    mode = "live"

    def __init__(self, api_key: str, base_url: str | None = None) -> None:
        settings = get_settings()
        self._client = httpx.Client(
            base_url=base_url or settings.graph8_base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15.0,
        )

    @retry(
        retry=retry_if_exception_type(Graph8RateLimitError),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        stop=stop_after_attempt(5),
    )
    def _get(self, path: str, params: dict | None = None) -> dict:
        response = self._client.get(path, params=params)
        if response.status_code == 429:
            raise Graph8RateLimitError(response.headers.get("Retry-After"))
        response.raise_for_status()
        return response.json()

    def _company_industry_and_segment(self, company_id: str | int | None) -> tuple[str, str]:
        if not company_id:
            return "Unknown", "mid_market"
        try:
            payload = self._get(f"/companies/{company_id}")["data"]
        except httpx.HTTPStatusError:
            return "Unknown", "mid_market"
        return payload.get("industry") or "Unknown", _infer_segment(payload.get("employee_count"))

    def _parse_deal(self, payload: dict, *, outcome_hint: str | None = None) -> G8Deal:
        industry, segment = self._company_industry_and_segment(payload.get("company_id"))

        closed_lost_reason = payload.get("closed_lost_reason")
        close_date = _parse_dt(payload.get("close_date"))
        if outcome_hint:
            outcome = outcome_hint
        elif closed_lost_reason:
            outcome = "lost"
        elif close_date:
            outcome = "won"
        else:
            outcome = "open"

        return G8Deal(
            external_id=str(payload["id"]),
            name=payload.get("name") or "",
            company_name=payload.get("company_name") or "",  # not on DealResponse; best effort
            industry=industry,
            segment=segment,
            amount=float(payload.get("amount") or 0),
            currency=payload.get("currency") or "USD",
            pipeline_id=payload.get("pipeline_id"),
            stage_id=payload.get("stage_id"),
            stage_name=payload.get("stage_name"),
            owner_name=payload.get("owner_name"),
            outcome=outcome,
            close_reason_raw=closed_lost_reason,
            opened_at=_parse_dt(payload.get("created_at")),
            closed_at=close_date,
        )

    def get_deal_bundle(self, graph8_deal_id: str) -> G8DealBundle:
        deal_payload = self._get(f"/deals/{graph8_deal_id}")["data"]
        deal = self._parse_deal(deal_payload)

        contacts_data = self._get(f"/deals/{graph8_deal_id}/contacts").get("data", {})
        contacts = [
            G8Contact(
                external_id=str(c.get("person_id") or c.get("id")),
                name=c.get("name") or "",
                title=c.get("title"),
                role=c.get("role") or "unknown",
                engaged_at=_parse_dt(c.get("created_at")),
            )
            for c in contacts_data.get("contacts", [])
        ]

        # No dedicated stage-history endpoint was found; /history is the closest documented
        # analogue but is untyped (`additionalProperties: true`) in the live spec, so this is
        # parsed defensively across a few plausible key names rather than a fixed schema.
        history_items = self._get(f"/deals/{graph8_deal_id}/history").get("data", {})
        if isinstance(history_items, dict):
            history_items = history_items.get("items", [])
        stage_history = []
        for h in history_items or []:
            if not isinstance(h, dict):
                continue
            stage_name = h.get("stage_name") or h.get("to_stage") or h.get("stage")
            entered_at = _parse_dt(h.get("entered_at") or h.get("created_at") or h.get("changed_at"))
            if not stage_name or not entered_at:
                continue
            stage_history.append(
                G8StageEvent(
                    stage_id=str(h.get("stage_id") or stage_name),
                    stage_name=stage_name,
                    entered_at=entered_at,
                    exited_at=_parse_dt(h.get("exited_at")),
                )
            )

        activities_items = self._get(f"/deals/{graph8_deal_id}/activities").get("data", {})
        if isinstance(activities_items, dict):
            activities_items = activities_items.get("items", [])
        # Folded into `meetings` as the closest available evidence source -- Graph8 has no
        # dedicated per-deal meetings/transcript endpoint (see module docstring).
        meetings = []
        for a in activities_items or []:
            if not isinstance(a, dict):
                continue
            summary = a.get("summary") or a.get("description") or a.get("type") or ""
            if not summary:
                continue
            meetings.append(
                G8Meeting(
                    external_id=str(a.get("id", "")),
                    occurred_at=_parse_dt(a.get("occurred_at") or a.get("created_at")),
                    summary=summary,
                )
            )

        notes_data = self._get(f"/deals/{graph8_deal_id}/notes").get("data", {})
        note_items = notes_data.get("notes", notes_data) if isinstance(notes_data, dict) else notes_data
        notes = [
            G8Note(
                external_id=str(n.get("id", "")),
                created_at=_parse_dt(n.get("created_at")),
                body=n.get("content") or n.get("body") or "",
            )
            for n in (note_items or [])
            if isinstance(n, dict)
        ]

        return G8DealBundle(
            deal=deal, contacts=contacts, stage_history=stage_history, meetings=meetings, notes=notes,
        )

    def _list_deals_by_outcome(self, outcome: str) -> list[G8Deal]:
        deals: list[G8Deal] = []
        cursor: str | None = None
        while True:
            params = {"outcome": outcome, "limit": 100}
            if cursor:
                params["cursor"] = cursor
            payload = self._get("/deals", params=params)
            deals.extend(self._parse_deal(d, outcome_hint=outcome) for d in payload.get("data", []))
            pagination = payload.get("pagination") or {}
            if not pagination.get("has_next"):
                break
            cursor = pagination.get("next_cursor")
        return deals

    def list_closed_deals(self) -> list[G8Deal]:
        return self._list_deals_by_outcome("won") + self._list_deals_by_outcome("lost")

    def list_active_deals(self) -> list[G8Deal]:
        return self._list_deals_by_outcome("open")

    def create_task(
        self,
        *,
        graph8_deal_id: str,
        title: str,
        description: str,
        assignee_hint: str | None = None,
    ) -> str:
        payload: dict = {
            "title": title,
            "description": description,
            "records": [{"type": "deal", "id": graph8_deal_id}],
        }
        if assignee_hint:
            payload["assignee_id"] = assignee_hint
        response = self._client.post("/tasks", json=payload)
        response.raise_for_status()
        return str(response.json()["data"]["id"])

    def create_note(self, *, graph8_deal_id: str, body: str) -> str | None:
        try:
            response = self._client.post(f"/deals/{graph8_deal_id}/notes", json={"content": body})
            response.raise_for_status()
            return str(response.json()["data"].get("id", ""))
        except httpx.HTTPStatusError:
            return None
