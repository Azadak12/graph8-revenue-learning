import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantScoped, TimestampMixin, UUIDPk
from app.models.enums import (
    AnalysisStatus,
    ConfidenceLevel,
    Department,
    EvidenceSourceType,
    EvidenceStrength,
    FactorCategory,
    FactorType,
    Preventability,
)


class DealAnalysis(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "deal_analyses"

    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    analysis_version: Mapped[int] = mapped_column(nullable=False, default=1)
    prompt_version: Mapped[str] = mapped_column(String(32), nullable=False)
    model_identifier: Mapped[str] = mapped_column(String(64), nullable=False)
    taxonomy_version: Mapped[str] = mapped_column(String(32), nullable=False)

    outcome: Mapped[str] = mapped_column(String(16), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    primary_factor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("deal_factors.id", use_alter=True, name="fk_deal_analyses_primary_factor_id"),
        nullable=True,
    )
    confidence: Mapped[ConfidenceLevel] = mapped_column(default=ConfidenceLevel.UNKNOWN)
    human_confirmation_required: Mapped[bool] = mapped_column(default=False)
    status: Mapped[AnalysisStatus] = mapped_column(default=AnalysisStatus.PENDING, index=True)
    is_current: Mapped[bool] = mapped_column(default=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    factors: Mapped[list["DealFactor"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
        foreign_keys="DealFactor.deal_analysis_id",
    )


class DealFactor(Base, UUIDPk, TenantScoped):
    __tablename__ = "deal_factors"

    deal_analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deal_analyses.id"), nullable=False, index=True
    )
    category: Mapped[FactorCategory] = mapped_column(nullable=False, index=True)
    specific_issue: Mapped[str] = mapped_column(String(512), nullable=False)
    factor_type: Mapped[FactorType] = mapped_column(nullable=False)
    confidence: Mapped[ConfidenceLevel] = mapped_column(default=ConfidenceLevel.UNKNOWN)
    preventability: Mapped[Preventability] = mapped_column(default=Preventability.UNKNOWN)
    department: Mapped[Department] = mapped_column(nullable=False)
    is_primary: Mapped[bool] = mapped_column(default=False)

    analysis: Mapped["DealAnalysis"] = relationship(
        back_populates="factors", foreign_keys=[deal_analysis_id]
    )
    evidence: Mapped[list["DealEvidence"]] = relationship(back_populates="factor")


class DealEvidence(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "deal_evidence"

    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deal_analyses.id"), nullable=True, index=True
    )
    factor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deal_factors.id"), nullable=True, index=True
    )
    source_type: Mapped[EvidenceSourceType] = mapped_column(nullable=False)
    source_external_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_timestamp: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finding: Mapped[str] = mapped_column(String(512), nullable=False)
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    strength: Mapped[EvidenceStrength] = mapped_column(default=EvidenceStrength.MODERATE)

    factor: Mapped["DealFactor | None"] = relationship(back_populates="evidence")


class HumanFeedback(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "human_feedback"

    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deal_analyses.id"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    feedback_type: Mapped[str] = mapped_column(String(32), nullable=False)
    selected_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    override_category: Mapped[FactorCategory | None] = mapped_column(nullable=True)
    was_seller_controllable: Mapped[bool | None] = mapped_column(nullable=True)
    another_vendor_selected: Mapped[bool | None] = mapped_column(nullable=True)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
