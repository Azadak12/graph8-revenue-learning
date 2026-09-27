"""Seeds one demo organization, one demo user, a demo Graph8Connection, and runs
the full investigation pipeline over all 20 seeded closed deals so the Overview /
Learnings / Recommendations pages have real (demo) data immediately -- without
requiring 20 manual "simulate close" clicks first.

Each deal is processed in its own fresh DB session, deliberately mirroring how
the RQ worker processes one webhook event per job in production (workers/jobs.py)
rather than reusing one long-lived session across the whole batch -- reusing a
single session across 20 sequential upsert-heavy operations was found to leave
stale ORM identity-map state after the bulk delete/recreate in
services/graph8/sync.py, which produced under-counted (but not visibly broken)
pattern statistics. One session per deal avoids that class of bug entirely.

Run with:  python -m app.seed.run_seed
Idempotent: safe to re-run; it reuses the existing demo org/user if present.
"""

from __future__ import annotations

import uuid

from app.core.logging import configure_logging, get_logger
from app.db.session import SessionLocal
from app.models.deal import Deal
from app.models.enums import ConnectionMode, ConnectionStatus, UserRole
from app.models.organization import Graph8Connection, Organization, User
from app.seed.demo_deals import ACTIVE_DEALS, CLOSED_DEALS
from app.security.auth import hash_password
from app.services.graph8.demo_provider import DemoGraph8Provider
from app.services.graph8.sync import sync_deal
from app.services.investigations.orchestrator import run_investigation
from app.services.patterns.engine import refresh_patterns_for_segment
from app.services.recommendations.engine import refresh_recommendations
from app.services.warnings.engine import refresh_future_warnings

DEMO_ORG_NAME = "Acme Revenue Team (Demo)"
DEMO_USER_EMAIL = "demo@graph8.com"
DEMO_USER_PASSWORD = "demo1234"

provider = DemoGraph8Provider()


def _ensure_org_and_user() -> uuid.UUID:
    session = SessionLocal()
    try:
        org = session.query(Organization).filter(Organization.name == DEMO_ORG_NAME).one_or_none()
        if org is None:
            org = Organization(name=DEMO_ORG_NAME)
            session.add(org)
            session.flush()

        connection = (
            session.query(Graph8Connection).filter(Graph8Connection.organization_id == org.id).one_or_none()
        )
        if connection is None:
            session.add(
                Graph8Connection(
                    organization_id=org.id, mode=ConnectionMode.DEMO, status=ConnectionStatus.CONNECTED
                )
            )

        user = session.query(User).filter(User.email == DEMO_USER_EMAIL).one_or_none()
        if user is None:
            session.add(
                User(
                    organization_id=org.id,
                    email=DEMO_USER_EMAIL,
                    name="Demo Admin",
                    role=UserRole.ADMIN,
                    hashed_password=hash_password(DEMO_USER_PASSWORD),
                )
            )
        session.commit()
        return org.id
    finally:
        session.close()


def run() -> None:
    configure_logging("development")
    logger = get_logger(__name__)

    org_id = _ensure_org_and_user()
    logger.info("seed_org_ready", org_id=org_id)

    for deal_raw in CLOSED_DEALS:
        session = SessionLocal()
        try:
            logger.info("seed_analyzing_deal", company=deal_raw["company_name"])
            run_investigation(
                session,
                organization_id=org_id,
                provider=provider,
                graph8_deal_id=deal_raw["external_id"],
            )
            session.commit()
        finally:
            session.close()

    # Final full pass over every (industry, segment) combination, each in its own
    # fresh session, so pattern/recommendation counts reflect the complete dataset.
    session = SessionLocal()
    try:
        distinct_segments = (
            session.query(Deal.industry, Deal.segment)
            .filter(Deal.organization_id == org_id)
            .distinct()
            .all()
        )
    finally:
        session.close()

    for industry, segment in distinct_segments:
        session = SessionLocal()
        try:
            refresh_patterns_for_segment(session, organization_id=org_id, industry=industry, segment=segment)
            session.commit()
        finally:
            session.close()

    session = SessionLocal()
    try:
        refresh_recommendations(session, organization_id=org_id)
        session.commit()
    finally:
        session.close()

    for deal_raw in ACTIVE_DEALS:
        session = SessionLocal()
        try:
            sync_deal(session, org_id, provider, deal_raw["external_id"])
            session.commit()
        finally:
            session.close()

    session = SessionLocal()
    try:
        refresh_future_warnings(session, organization_id=org_id, provider=provider)
        session.commit()
    finally:
        session.close()

    logger.info(
        "seed_complete", org_id=org_id, login_email=DEMO_USER_EMAIL, login_password=DEMO_USER_PASSWORD
    )
    print(f"\nDemo org ready. Log in with:\n  email:    {DEMO_USER_EMAIL}\n  password: {DEMO_USER_PASSWORD}\n")


if __name__ == "__main__":
    run()
