"""RQ job bodies. Each job owns its own DB session -- never reuses a request-scoped
session across the queue boundary."""

from __future__ import annotations

import uuid

from app.core.logging import get_logger
from app.db.session import SessionLocal
from app.models.enums import WebhookProcessingStatus
from app.models.webhook_event import WebhookEvent
from app.services.graph8.factory import get_provider_for_org
from app.services.investigations.orchestrator import run_investigation

logger = get_logger(__name__)


def process_webhook_event(webhook_event_id: str) -> None:
    session = SessionLocal()
    try:
        event = session.get(WebhookEvent, uuid.UUID(webhook_event_id))
        if event is None:
            logger.error("webhook_event_not_found", webhook_event_id=webhook_event_id)
            return

        event.processing_status = WebhookProcessingStatus.PROCESSING
        event.attempts += 1
        session.commit()

        try:
            provider = get_provider_for_org(session, event.organization_id)
            run_investigation(
                session,
                organization_id=event.organization_id,
                provider=provider,
                graph8_deal_id=event.graph8_deal_id,
            )
            event.processing_status = WebhookProcessingStatus.COMPLETED
            session.commit()
        except Exception as exc:  # noqa: BLE001
            logger.exception("webhook_event_processing_failed", webhook_event_id=webhook_event_id)
            event.processing_status = WebhookProcessingStatus.FAILED
            event.error = str(exc)[:2000]
            session.commit()
    finally:
        session.close()
