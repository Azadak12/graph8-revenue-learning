import uuid

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.graph8.base import Graph8Provider
from app.services.graph8.demo_provider import DemoGraph8Provider

_demo_singleton = DemoGraph8Provider()


def get_provider_for_org(session: Session, organization_id: uuid.UUID) -> Graph8Provider:
    """Non-FastAPI variant of api/deps.get_org_graph8_provider, for use in workers."""
    from app.models.organization import Graph8Connection
    from app.security.secrets import decrypt_secret

    connection = (
        session.query(Graph8Connection)
        .filter(Graph8Connection.organization_id == organization_id)
        .one_or_none()
    )
    api_key = None
    if connection and connection.encrypted_api_key_ref:
        api_key = decrypt_secret(connection.encrypted_api_key_ref)
    return get_graph8_provider(api_key=api_key)


def get_graph8_provider(*, api_key: str | None = None) -> Graph8Provider:
    """Return the provider for the current org.

    An org is in Live Mode only if it has its own Graph8 API key configured
    (via Settings -> Graph8Connection). Otherwise it gets the shared demo
    provider. Selection happens once per request in the dependency layer —
    nothing downstream needs to know which one it got.
    """
    settings = get_settings()
    key = api_key or settings.graph8_api_key
    if key:
        from app.services.graph8.live_provider import LiveGraph8Provider

        return LiveGraph8Provider(api_key=key)
    return _demo_singleton
