import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id, get_org_graph8_provider
from app.models.analysis import DealAnalysis
from app.models.deal import Deal, DealSnapshot
from app.models.enums import AnalysisStatus
from app.models.pattern import FutureDealWarning
from app.db.session import get_db
from app.schemas.api import DealDetail, DealListItem, FeedbackIn
from app.security.auth import get_current_user
from app.services.graph8.base import Graph8Provider
from app.services.investigations.feedback import submit_feedback
from app.services.investigations.orchestrator import run_investigation

router = APIRouter(prefix="/api/deals", tags=["deals"])


@router.get("", response_model=list[DealListItem])
def list_deals(
    outcome: str | None = None,
    segment: str | None = None,
    industry: str | None = None,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    query = db.query(Deal).filter(Deal.organization_id == organization_id)
    if outcome:
        query = query.filter(Deal.outcome == outcome)
    if segment:
        query = query.filter(Deal.segment == segment)
    if industry:
        query = query.filter(Deal.industry == industry)
    deals = query.order_by(Deal.closed_at.desc().nullslast()).all()

    items = []
    for deal in deals:
        analysis = (
            db.query(DealAnalysis)
            .filter(DealAnalysis.deal_id == deal.id, DealAnalysis.is_current == True)  # noqa: E712
            .one_or_none()
        )
        primary_category = None
        if analysis and analysis.primary_factor_id:
            from app.models.analysis import DealFactor

            factor = db.get(DealFactor, analysis.primary_factor_id)
            primary_category = factor.category.value if factor else None
        items.append(
            DealListItem(
                id=deal.id,
                name=deal.name,
                company_name=deal.company_name,
                industry=deal.industry,
                segment=deal.segment.value,
                amount=float(deal.amount),
                currency=deal.currency,
                outcome=deal.outcome.value,
                closed_at=deal.closed_at,
                analysis_status=analysis.status.value if analysis else None,
                primary_factor_category=primary_category,
                confidence=analysis.confidence.value if analysis else None,
            )
        )
    return items


def _get_deal_or_404(db: Session, organization_id: uuid.UUID, deal_id: uuid.UUID) -> Deal:
    deal = db.get(Deal, deal_id)
    if deal is None or deal.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.get("/{deal_id}", response_model=DealDetail)
def get_deal(
    deal_id: uuid.UUID,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    deal = _get_deal_or_404(db, organization_id, deal_id)
    analysis = (
        db.query(DealAnalysis)
        .filter(DealAnalysis.deal_id == deal.id, DealAnalysis.is_current == True)  # noqa: E712
        .one_or_none()
    )
    warnings = db.query(FutureDealWarning).filter(FutureDealWarning.deal_id == deal.id).all()
    stage_history = (
        db.query(DealSnapshot)
        .filter(DealSnapshot.deal_id == deal.id)
        .order_by(DealSnapshot.entered_at)
        .all()
    )
    return DealDetail(
        id=deal.id,
        name=deal.name,
        company_name=deal.company_name,
        industry=deal.industry,
        segment=deal.segment.value,
        amount=float(deal.amount),
        currency=deal.currency,
        outcome=deal.outcome.value,
        stage_name=deal.stage_name,
        owner_name=deal.owner_name,
        opened_at=deal.opened_at,
        closed_at=deal.closed_at,
        contacts=deal.contacts,
        stage_history=stage_history,
        analysis=analysis,
        warnings=warnings,
    )


@router.get("/{deal_id}/evidence")
def get_deal_evidence(
    deal_id: uuid.UUID,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    from app.models.analysis import DealEvidence

    deal = _get_deal_or_404(db, organization_id, deal_id)
    evidence = db.query(DealEvidence).filter(DealEvidence.deal_id == deal.id).all()
    return [
        {
            "id": str(e.id),
            "source_type": e.source_type.value,
            "source_external_id": e.source_external_id,
            "finding": e.finding,
            "excerpt": e.excerpt,
            "strength": e.strength.value,
        }
        for e in evidence
    ]


@router.post("/{deal_id}/reanalyze", response_model=DealDetail)
def reanalyze_deal(
    deal_id: uuid.UUID,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
    provider: Graph8Provider = Depends(get_org_graph8_provider),
):
    deal = _get_deal_or_404(db, organization_id, deal_id)
    run_investigation(db, organization_id=organization_id, provider=provider, graph8_deal_id=deal.graph8_deal_id)
    db.commit()
    return get_deal(deal_id, db=db, organization_id=organization_id)


@router.post("/{deal_id}/feedback")
def post_feedback(
    deal_id: uuid.UUID,
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
):
    deal = _get_deal_or_404(db, organization_id, deal_id)
    analysis = (
        db.query(DealAnalysis)
        .filter(DealAnalysis.deal_id == deal.id, DealAnalysis.is_current == True)  # noqa: E712
        .one_or_none()
    )
    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis found for this deal")

    feedback = submit_feedback(
        db,
        organization_id=organization_id,
        deal=deal,
        analysis=analysis,
        user_id=user.id,
        feedback_type=payload.feedback_type,
        selected_reason=payload.selected_reason,
        override_category=payload.override_category,
        was_seller_controllable=payload.was_seller_controllable,
        another_vendor_selected=payload.another_vendor_selected,
        comment=payload.comment,
    )
    db.commit()
    return {"id": str(feedback.id), "status": "recorded"}


@router.post("/{deal_id}/warnings/{warning_id}/ack")
def ack_warning(
    deal_id: uuid.UUID,
    warning_id: uuid.UUID,
    payload: dict,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    warning = db.get(FutureDealWarning, warning_id)
    if warning is None or warning.organization_id != organization_id or warning.deal_id != deal_id:
        raise HTTPException(status_code=404, detail="Warning not found")
    new_status = payload.get("status")
    if new_status not in ("acknowledged", "dismissed", "task_created"):
        raise HTTPException(status_code=400, detail="Invalid status")
    warning.status = new_status
    db.commit()
    return {"id": str(warning.id), "status": warning.status}
