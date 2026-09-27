import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.models.enums import ConnectionMode, ConnectionStatus
from app.models.organization import Graph8Connection
from app.schemas.api import Graph8ConnectionIn, Graph8ConnectionOut
from app.security.secrets import encrypt_secret

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/graph8-connection", response_model=Graph8ConnectionOut)
def get_connection(db: Session = Depends(get_db), organization_id: uuid.UUID = Depends(get_current_org_id)):
    connection = (
        db.query(Graph8Connection).filter(Graph8Connection.organization_id == organization_id).one_or_none()
    )
    if connection is None:
        return Graph8ConnectionOut(mode="demo", status="not_configured", graph8_org_id=None, last_sync_at=None)
    return Graph8ConnectionOut(
        mode=connection.mode.value,
        status=connection.status.value,
        graph8_org_id=connection.graph8_org_id,
        last_sync_at=connection.last_sync_at,
    )


@router.post("/graph8-connection", response_model=Graph8ConnectionOut)
def set_connection(
    payload: Graph8ConnectionIn,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
):
    connection = (
        db.query(Graph8Connection).filter(Graph8Connection.organization_id == organization_id).one_or_none()
    )
    if connection is None:
        connection = Graph8Connection(organization_id=organization_id)
        db.add(connection)

    connection.encrypted_api_key_ref = encrypt_secret(payload.api_key)
    connection.mode = ConnectionMode.LIVE
    connection.status = ConnectionStatus.CONNECTED
    db.commit()
    return Graph8ConnectionOut(
        mode=connection.mode.value,
        status=connection.status.value,
        graph8_org_id=connection.graph8_org_id,
        last_sync_at=connection.last_sync_at,
    )
