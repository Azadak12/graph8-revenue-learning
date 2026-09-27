import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.schemas.api import OverviewSummary
from app.services.overview import build_overview

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("", response_model=OverviewSummary)
def get_overview(db: Session = Depends(get_db), organization_id: uuid.UUID = Depends(get_current_org_id)):
    return build_overview(db, organization_id=organization_id)
