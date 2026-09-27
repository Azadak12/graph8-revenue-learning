import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id, get_org_graph8_provider
from app.db.session import get_db
from app.models.pattern import Recommendation, RecommendationAction
from app.schemas.api import ActionProposeIn, RecommendationOut
from app.security.auth import get_current_user
from app.services.graph8.base import Graph8Provider
from app.services.recommendations.actions import approve_and_execute_action, propose_action

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


@router.get("", response_model=list[RecommendationOut])
def list_recommendations(
    department: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    query = db.query(Recommendation).filter(Recommendation.organization_id == organization_id)
    if department:
        query = query.filter(Recommendation.department == department)
    if status:
        query = query.filter(Recommendation.status == status)
    return query.order_by(Recommendation.priority.asc()).all()


@router.post("/{recommendation_id}/actions")
def propose_recommendation_action(
    recommendation_id: uuid.UUID,
    payload: ActionProposeIn,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    recommendation = db.get(Recommendation, recommendation_id)
    if recommendation is None or recommendation.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    action = propose_action(db, recommendation_id=recommendation_id, action_type=payload.action_type)
    db.commit()
    return {"id": str(action.id), "status": action.status}


@router.post("/actions/{action_id}/approve")
def approve_recommendation_action(
    action_id: uuid.UUID,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
    provider: Graph8Provider = Depends(get_org_graph8_provider),
):
    action = db.get(RecommendationAction, action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="Action not found")
    recommendation = db.get(Recommendation, action.recommendation_id)
    if recommendation.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Action not found")

    action = approve_and_execute_action(
        db,
        organization_id=organization_id,
        action=action,
        approved_by_user_id=user.id,
        provider=provider,
    )
    db.commit()
    return {
        "id": str(action.id),
        "status": action.status,
        "graph8_object_type": action.graph8_object_type,
        "graph8_object_id": action.graph8_object_id,
    }
