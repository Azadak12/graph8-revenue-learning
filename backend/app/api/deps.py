from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.organization import User
from app.security.auth import get_current_user
from app.services.graph8.base import Graph8Provider
from app.services.graph8.factory import get_provider_for_org


def get_current_org_id(user: User = Depends(get_current_user)):
    return user.organization_id


def get_org_graph8_provider(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> Graph8Provider:
    return get_provider_for_org(db, user.organization_id)
