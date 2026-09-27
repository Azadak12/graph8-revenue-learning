import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantScoped, TimestampMixin, UUIDPk
from app.models.enums import ContactRole, DealOutcome, DealSegment


class Deal(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "deals"

    graph8_deal_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[str] = mapped_column(String(100), nullable=False)
    segment: Mapped[DealSegment] = mapped_column(nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    pipeline_id: Mapped[str] = mapped_column(String(255), nullable=True)
    stage_id: Mapped[str] = mapped_column(String(255), nullable=True)
    stage_name: Mapped[str] = mapped_column(String(255), nullable=True)
    owner_name: Mapped[str] = mapped_column(String(255), nullable=True)
    outcome: Mapped[DealOutcome] = mapped_column(default=DealOutcome.OPEN, index=True)
    close_reason_raw: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    stage_snapshots: Mapped[list["DealSnapshot"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )
    contacts: Mapped[list["DealContact"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan"
    )


class DealSnapshot(Base, UUIDPk):
    __tablename__ = "deal_snapshots"

    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True
    )
    stage_id: Mapped[str] = mapped_column(String(255), nullable=False)
    stage_name: Mapped[str] = mapped_column(String(255), nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    deal: Mapped["Deal"] = relationship(back_populates="stage_snapshots")


class DealContact(Base, UUIDPk):
    __tablename__ = "deal_contacts"

    deal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deals.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[ContactRole] = mapped_column(default=ContactRole.UNKNOWN)
    engaged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    deal: Mapped["Deal"] = relationship(back_populates="contacts")
