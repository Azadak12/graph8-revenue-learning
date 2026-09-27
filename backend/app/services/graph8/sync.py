"""Shared Deal upsert logic used by both the investigation engine (closed deals)
and the future-warning engine (open deals)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.deal import Deal, DealContact, DealSnapshot
from app.models.enums import DealOutcome, DealSegment
from app.services.graph8.base import Graph8Provider
from app.services.graph8.schemas import G8DealBundle


def sync_deal(
    session: Session, organization_id: uuid.UUID, provider: Graph8Provider, graph8_deal_id: str
) -> tuple[Deal, G8DealBundle]:
    bundle = provider.get_deal_bundle(graph8_deal_id)
    g8_deal = bundle.deal

    deal = (
        session.query(Deal)
        .filter(Deal.organization_id == organization_id, Deal.graph8_deal_id == graph8_deal_id)
        .one_or_none()
    )
    if deal is None:
        deal = Deal(organization_id=organization_id, graph8_deal_id=graph8_deal_id)
        session.add(deal)

    deal.name = g8_deal.name
    deal.company_name = g8_deal.company_name
    deal.industry = g8_deal.industry
    deal.segment = DealSegment(g8_deal.segment)
    deal.amount = g8_deal.amount
    deal.currency = g8_deal.currency
    deal.pipeline_id = g8_deal.pipeline_id
    deal.stage_id = g8_deal.stage_id
    deal.stage_name = g8_deal.stage_name
    deal.owner_name = g8_deal.owner_name
    deal.outcome = DealOutcome(g8_deal.outcome)
    deal.close_reason_raw = g8_deal.close_reason_raw
    deal.opened_at = g8_deal.opened_at
    deal.closed_at = g8_deal.closed_at
    deal.synced_at = datetime.now(timezone.utc)
    session.flush()

    session.query(DealSnapshot).filter(DealSnapshot.deal_id == deal.id).delete()
    session.query(DealContact).filter(DealContact.deal_id == deal.id).delete()
    for stage in bundle.stage_history:
        session.add(
            DealSnapshot(
                deal_id=deal.id,
                stage_id=stage.stage_id,
                stage_name=stage.stage_name,
                entered_at=stage.entered_at,
                exited_at=stage.exited_at,
            )
        )
    for contact in bundle.contacts:
        session.add(
            DealContact(
                deal_id=deal.id,
                name=contact.name,
                title=contact.title,
                role=contact.role,
                engaged_at=contact.engaged_at,
            )
        )
    session.flush()
    return deal, bundle
