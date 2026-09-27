"""Real, signature-verified Graph8 webhook ingestion.

Fast-ack pattern: verify, dedupe, persist, enqueue, return 202 -- no LLM/investigation
work happens inline in this request. See services/graph8/webhook_security.py for
what's confirmed vs. assumed about Graph8's signing scheme.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.session import get_db
from app.models.enums import WebhookProcessingStatus
from app.models.organization import Graph8Connection
from app.models.webhook_event import WebhookEvent
from app.services.graph8.webhook_security import (
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    WebhookVerificationError,
    verify_signature,
)
from app.workers.queue import investigation_queue

logger = get_logger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Graph8 resolves the org from the API key server-side for outbound calls; for
# INBOUND webhooks it must tell us which org a delivery belongs to somehow.
# UNCONFIRMED: assumed to be a `organization_id`/`account_id` field in the
# payload, or a per-org webhook URL/secret. This handler supports the latter:
# each org's Graph8Connection stores its own webhook secret lookup key.


@router.post("/graph8", status_code=202)
async def graph8_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_graph8_signature: str | None = Header(default=None, alias=SIGNATURE_HEADER),
    x_graph8_timestamp: str | None = Header(default=None, alias=TIMESTAMP_HEADER),
):
    settings = get_settings()
    raw_body = await request.body()

    if settings.graph8_webhook_secret:
        if not x_graph8_signature or not x_graph8_timestamp:
            raise HTTPException(status_code=401, detail="Missing signature headers")
        try:
            verify_signature(
                raw_body=raw_body,
                timestamp=x_graph8_timestamp,
                signature=x_graph8_signature,
                secret=settings.graph8_webhook_secret,
            )
        except WebhookVerificationError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
    else:
        logger.warning("webhook_signature_check_skipped_no_secret_configured")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    # UNCONFIRMED payload shape -- adjust field names once the real event schema is known.
    external_event_id = payload.get("event_id") or payload.get("id")
    event_type = payload.get("event_type") or payload.get("type")
    graph8_deal_id = payload.get("deal_id") or payload.get("data", {}).get("deal_id")
    organization_hint = payload.get("organization_id") or payload.get("account_id")

    if not external_event_id or not event_type or not graph8_deal_id:
        raise HTTPException(status_code=400, detail="Missing required webhook fields")

    connection = None
    if organization_hint:
        connection = db.execute(
            select(Graph8Connection).where(Graph8Connection.graph8_org_id == str(organization_hint))
        ).scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="No organization mapped to this Graph8 account")

    event = WebhookEvent(
        organization_id=connection.organization_id,
        external_event_id=str(external_event_id),
        event_type=event_type,
        graph8_deal_id=str(graph8_deal_id),
        payload=payload,
        received_at=datetime.now(timezone.utc),
        processing_status=WebhookProcessingStatus.PENDING,
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # Duplicate delivery of an event we've already stored -- idempotent no-op.
        return {"status": "duplicate_ignored"}

    # CONFIRMED (GET /webhooks/events on a live account, 2026-09-27): Graph8's real Deals
    # event catalog is deal.won / deal.created / deal.updated / deal.stage_changed /
    # deal.deleted -- there is NO deal.lost event. A loss is only observable as a
    # deal.updated or deal.stage_changed delivery for a deal that now has
    # `closed_lost_reason` set. We enqueue on all three and let run_investigation's
    # no-op-on-open-deal guard (services/investigations/orchestrator.py) filter out
    # deliveries that don't actually represent a closed deal, rather than trying to
    # infer that from the webhook payload alone.
    if event_type in ("deal.won", "deal.updated", "deal.stage_changed"):
        investigation_queue.enqueue("app.workers.jobs.process_webhook_event", str(event.id))

    return {"status": "accepted", "event_id": str(event.id)}


@router.get("/events/{event_id}")
def get_webhook_event_status(event_id: uuid.UUID, db: Session = Depends(get_db)):
    event = db.get(WebhookEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return {
        "id": str(event.id),
        "event_type": event.event_type,
        "graph8_deal_id": event.graph8_deal_id,
        "processing_status": event.processing_status.value,
        "error": event.error,
    }
