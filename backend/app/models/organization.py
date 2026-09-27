import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPk
from app.models.enums import ConnectionMode, ConnectionStatus, UserRole


class Organization(Base, UUIDPk, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    graph8_connection: Mapped["Graph8Connection | None"] = relationship(
        back_populates="organization", uselist=False
    )


class User(Base, UUIDPk, TimestampMixin):
    __tablename__ = "users"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(default=UserRole.REP)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="users")


class Graph8Connection(Base, UUIDPk, TimestampMixin):
    __tablename__ = "graph8_connections"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, unique=True
    )
    mode: Mapped[ConnectionMode] = mapped_column(default=ConnectionMode.DEMO)
    status: Mapped[ConnectionStatus] = mapped_column(default=ConnectionStatus.NOT_CONFIGURED)
    encrypted_api_key_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    graph8_org_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    last_sync_at: Mapped[str | None] = mapped_column(String(64), nullable=True)

    organization: Mapped["Organization"] = relationship(back_populates="graph8_connection")
