import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantScoped, TimestampMixin, UUIDPk
from app.models.enums import (
    ConfidenceLevel,
    Department,
    FactorCategory,
    PatternStatus,
    PatternStrength,
)


class Pattern(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "patterns"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[FactorCategory] = mapped_column(nullable=False, index=True)
    segment_definition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    lost_count: Mapped[int] = mapped_column(Integer, default=0)
    won_count: Mapped[int] = mapped_column(Integer, default=0)
    sample_size: Mapped[int] = mapped_column(Integer, default=0)
    pattern_strength: Mapped[PatternStrength] = mapped_column(default=PatternStrength.ONE_OFF)
    confidence: Mapped[ConfidenceLevel] = mapped_column(default=ConfidenceLevel.LOW)
    status: Mapped[PatternStatus] = mapped_column(default=PatternStatus.ACTIVE, index=True)
    narrative: Mapped[str] = mapped_column(Text, nullable=False)
    first_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    occurrences: Mapped[list["PatternOccurrence"]] = relationship(
        back_populates="pattern", cascade="all, delete-orphan"
    )
    recommendations: Mapped[list["Recommendation"]] = relationship(back_populates="pattern")


class PatternOccurrence(Base, UUIDPk):
    __tablename__ = "pattern_occurrences"

    pattern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patterns.id"), nullable=False, index=True
    )
    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    deal_factor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16), nullable=False)

    pattern: Mapped["Pattern"] = relationship(back_populates="occurrences")


class Recommendation(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "recommendations"

    pattern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patterns.id"), nullable=False, index=True
    )
    department: Mapped[Department] = mapped_column(nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="proposed", index=True)

    pattern: Mapped["Pattern"] = relationship(back_populates="recommendations")
    actions: Mapped[list["RecommendationAction"]] = relationship(
        back_populates="recommendation", cascade="all, delete-orphan"
    )


class RecommendationAction(Base, UUIDPk, TimestampMixin):
    __tablename__ = "recommendation_actions"

    recommendation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("recommendations.id"), nullable=False, index=True
    )
    action_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="proposed", index=True)
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    graph8_object_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    graph8_object_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    recommendation: Mapped["Recommendation"] = relationship(back_populates="actions")


class FutureDealWarning(Base, UUIDPk, TenantScoped, TimestampMixin):
    __tablename__ = "future_deal_warnings"

    deal_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    pattern_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patterns.id"), nullable=False, index=True
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    similarity_basis: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)
