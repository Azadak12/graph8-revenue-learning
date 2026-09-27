"""DemoGraph8Provider: serves the seeded DEMO DATA set (app/seed/demo_deals.py).

Every deal/company here is fictional and labeled DEMO DATA in the UI (the API
tags responses with a `data_source: "demo"` marker consumed by the frontend).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.core.logging import get_logger
from app.seed.demo_deals import ACTIVE_DEALS, CLOSED_DEALS
from app.services.graph8.base import Graph8Provider
from app.services.graph8.schemas import (
    G8Contact,
    G8Deal,
    G8DealBundle,
    G8Meeting,
    G8Note,
    G8StageEvent,
)

logger = get_logger(__name__)


def _dt(days_ago: int | None) -> datetime | None:
    if days_ago is None:
        return None
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def _to_g8_deal(raw: dict) -> G8Deal:
    stage_history = raw.get("stage_history") or []
    last_stage = stage_history[-1] if stage_history else None
    return G8Deal(
        external_id=raw["external_id"],
        name=raw["name"],
        company_name=raw["company_name"],
        industry=raw["industry"],
        segment=raw["segment"],
        amount=float(raw["amount"]),
        currency=raw["currency"],
        pipeline_id="demo-pipeline",
        stage_id=last_stage[0] if last_stage else None,
        stage_name=last_stage[0] if last_stage else None,
        owner_name=raw.get("owner_name"),
        outcome=raw["outcome"],
        close_reason_raw=raw.get("close_reason_raw"),
        opened_at=_dt(raw.get("opened_days_ago")),
        closed_at=_dt(raw.get("closed_days_ago")),
    )


def _to_bundle(raw: dict) -> G8DealBundle:
    deal = _to_g8_deal(raw)
    contacts = [
        G8Contact(
            external_id=f"{raw['external_id']}-contact-{i}",
            name=name,
            title=title,
            role=role,
            engaged_at=_dt(engaged_days_ago),
        )
        for i, (name, title, role, engaged_days_ago) in enumerate(raw.get("contacts", []))
    ]
    stage_history = [
        G8StageEvent(
            stage_id=stage_name,
            stage_name=stage_name,
            entered_at=_dt(entered_days_ago),
            exited_at=_dt(exited_days_ago),
        )
        for stage_name, entered_days_ago, exited_days_ago in raw.get("stage_history", [])
    ]
    meetings = [
        G8Meeting(
            external_id=f"{raw['external_id']}-meeting-{i}",
            occurred_at=_dt(days_ago),
            summary=summary,
        )
        for i, (days_ago, summary) in enumerate(raw.get("meetings", []))
    ]
    notes = [
        G8Note(
            external_id=f"{raw['external_id']}-note-{i}",
            created_at=_dt(days_ago),
            body=body,
        )
        for i, (days_ago, body) in enumerate(raw.get("notes", []))
    ]
    return G8DealBundle(
        deal=deal,
        contacts=contacts,
        stage_history=stage_history,
        meetings=meetings,
        notes=notes,
        objections=raw.get("objections", []),
        requirements=raw.get("requirements", []),
        competitors=raw.get("competitors", []),
        pricing_notes=raw.get("pricing_notes", []),
    )


class DemoGraph8Provider(Graph8Provider):
    mode = "demo"

    def __init__(self) -> None:
        self._by_external_id = {d["external_id"]: d for d in CLOSED_DEALS + ACTIVE_DEALS}
        self._created_objects: list[dict] = []

    def get_deal_bundle(self, graph8_deal_id: str) -> G8DealBundle:
        raw = self._by_external_id.get(graph8_deal_id)
        if raw is None:
            raise KeyError(f"Unknown demo deal id: {graph8_deal_id}")
        return _to_bundle(raw)

    def list_closed_deals(self) -> list[G8Deal]:
        return [_to_g8_deal(d) for d in CLOSED_DEALS]

    def list_active_deals(self) -> list[G8Deal]:
        return [_to_g8_deal(d) for d in ACTIVE_DEALS]

    def create_task(
        self,
        *,
        graph8_deal_id: str,
        title: str,
        description: str,
        assignee_hint: str | None = None,
    ) -> str:
        object_id = f"demo-task-{uuid.uuid4().hex[:10]}"
        self._created_objects.append(
            {
                "type": "task",
                "id": object_id,
                "graph8_deal_id": graph8_deal_id,
                "title": title,
                "description": description,
                "assignee_hint": assignee_hint,
            }
        )
        logger.info("demo_graph8_task_created", object_id=object_id, deal_id=graph8_deal_id, title=title)
        return object_id

    def create_note(self, *, graph8_deal_id: str, body: str) -> str | None:
        object_id = f"demo-note-{uuid.uuid4().hex[:10]}"
        self._created_objects.append(
            {"type": "note", "id": object_id, "graph8_deal_id": graph8_deal_id, "body": body}
        )
        logger.info("demo_graph8_note_created", object_id=object_id, deal_id=graph8_deal_id)
        return object_id
