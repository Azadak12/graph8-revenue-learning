"""Demo-only endpoints that drive the hackathon demo flow (§31 of the spec):
simulating a Graph8 `deal.won`/`deal.lost` webhook delivery for a seeded demo
deal, through the SAME async pipeline a real webhook would use, without needing
to fabricate a valid HMAC signature for the public /api/webhooks/graph8 route.

Not present in a production deployment for a Live-mode org.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.models.enums import WebhookProcessingStatus
from app.models.webhook_event import WebhookEvent
from app.seed.demo_deals import ACTIVE_DEALS, CLOSED_DEALS
from app.workers.queue import investigation_queue

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/deals")
def list_demo_source_deals():
    return {
        "data_source": "demo",
        "closed": [
            {"external_id": d["external_id"], "company_name": d["company_name"], "outcome": d["outcome"]}
            for d in CLOSED_DEALS
        ],
        "active": [
            {"external_id": d["external_id"], "company_name": d["company_name"]} for d in ACTIVE_DEALS
        ],
    }


@router.post("/simulate-close/{graph8_deal_id}")
def simulate_close(
    graph8_deal_id: str,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    source = next((d for d in CLOSED_DEALS if d["external_id"] == graph8_deal_id), None)
    if source is None:
        raise HTTPException(status_code=404, detail="Unknown demo deal id")

    event_type = "deal.won" if source["outcome"] == "won" else "deal.lost"
    event = WebhookEvent(
        organization_id=organization_id,
        external_event_id=f"demo-sim-{uuid.uuid4().hex}",
        event_type=event_type,
        graph8_deal_id=graph8_deal_id,
        payload={"event_type": event_type, "deal_id": graph8_deal_id, "simulated": True},
        received_at=datetime.now(timezone.utc),
        processing_status=WebhookProcessingStatus.PENDING,
    )
    db.add(event)
    db.commit()

    investigation_queue.enqueue("app.workers.jobs.process_webhook_event", str(event.id))

    return {"event_id": str(event.id), "event_type": event_type, "company_name": source["company_name"]}
