"""Deterministic pattern-strength math. The LLM never computes statistics — this
is the only place sample sizes and won/lost ratios turn into a PatternStrength.
"""

from __future__ import annotations

from app.core.config import Settings
from app.models.enums import ConfidenceLevel, PatternStrength

# How much more common a factor must be in the lost cohort than the won cohort,
# as a fraction of deals, before it's treated as a differentiator rather than a
# characteristic that's just normal for the segment (e.g. "long sales cycles are
# common in both won and lost enterprise deals" -> not disproportionate).
DISPROPORTIONALITY_THRESHOLD = 0.25


def is_disproportionate(rate_lost: float, won_with_factor: int, lost_with_factor: int) -> bool:
    if won_with_factor == 0 and lost_with_factor >= 2:
        return True
    return rate_lost >= DISPROPORTIONALITY_THRESHOLD


def compute_strength(
    *,
    lost_with_factor: int,
    won_with_factor: int,
    total_lost: int,
    total_won: int,
    settings: Settings,
) -> tuple[PatternStrength, ConfidenceLevel] | None:
    """Returns None if there's no meaningful pattern to report at all."""

    if lost_with_factor == 0:
        return None

    sample_size = total_lost + total_won
    if sample_size < settings.pattern_min_sample_size:
        return None

    rate_lost = lost_with_factor / total_lost if total_lost else 0.0
    rate_won = won_with_factor / total_won if total_won else 0.0
    disproportion = rate_lost - rate_won

    if lost_with_factor == 1:
        return PatternStrength.ONE_OFF, ConfidenceLevel.LOW

    if not is_disproportionate(disproportion, won_with_factor, lost_with_factor):
        # Appears in both cohorts at similar rates -> likely a normal segment
        # characteristic, not a cause. Still worth surfacing, but hedged low.
        return PatternStrength.ONE_OFF, ConfidenceLevel.LOW

    if lost_with_factor >= settings.pattern_strong_threshold:
        return PatternStrength.STRONG_PATTERN, ConfidenceLevel.HIGH
    if lost_with_factor >= settings.pattern_recurring_threshold:
        return PatternStrength.RECURRING_PATTERN, ConfidenceLevel.HIGH
    return PatternStrength.EMERGING_PATTERN, ConfidenceLevel.MEDIUM
