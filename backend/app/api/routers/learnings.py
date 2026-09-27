import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.models.pattern import Pattern, PatternOccurrence
from app.schemas.api import PatternDetail, PatternOut

router = APIRouter(prefix="/api/learnings", tags=["learnings"])


@router.get("", response_model=list[PatternOut])
def list_learnings(
    db: Session = Depends(get_db), organization_id: uuid.UUID = Depends(get_current_org_id)
):
    patterns = (
        db.query(Pattern)
        .filter(Pattern.organization_id == organization_id)
        .order_by(Pattern.pattern_strength.desc(), Pattern.lost_count.desc())
        .all()
    )
    return patterns


@router.get("/{pattern_id}", response_model=PatternDetail)
def get_learning(
    pattern_id: uuid.UUID,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    pattern = db.get(Pattern, pattern_id)
    if pattern is None or pattern.organization_id != organization_id:
        raise HTTPException(status_code=404, detail="Pattern not found")
    occurrences = db.query(PatternOccurrence).filter(PatternOccurrence.pattern_id == pattern.id).all()
    return PatternDetail(
        **PatternOut.model_validate(pattern).model_dump(),
        occurrences=occurrences,
    )
