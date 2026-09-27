import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.schemas.api import RepPerformanceOut
from app.services.reps.engine import build_rep_performance

router = APIRouter(prefix="/api/reps", tags=["reps"])


@router.get("", response_model=list[RepPerformanceOut])
def list_rep_performance(
    db: Session = Depends(get_db), organization_id: uuid.UUID = Depends(get_current_org_id)
):
    return build_rep_performance(db, organization_id=organization_id)
