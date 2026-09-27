"""Tenant-scoping helpers.

Every query against a TenantScoped model must go through here (or filter
organization_id explicitly inline) — routers and services never issue a raw
`session.query(Model)` / `select(Model)` without this filter applied.
"""

from __future__ import annotations

import uuid

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.db.base import TenantScoped


def tenant_select(model: type[TenantScoped], organization_id: uuid.UUID) -> Select:
    return select(model).where(model.organization_id == organization_id)


def get_tenant_scoped_or_404(
    session: Session, model: type[TenantScoped], organization_id: uuid.UUID, object_id: uuid.UUID
):
    obj = session.get(model, object_id)
    if obj is None or obj.organization_id != organization_id:
        return None
    return obj
