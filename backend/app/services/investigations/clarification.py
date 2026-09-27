"""Creates the Graph8 clarification task when an analysis needs human input.

Graph8 tasks (with threaded replies) are the CONFIRMED, documented mechanism we
rely on here (see docs/ARCHITECTURE.md §1) -- we do not invent a notification API.
"""

from __future__ import annotations

from app.models.analysis import DealAnalysis
from app.models.deal import Deal
from app.services.graph8.base import Graph8Provider

CLARIFICATION_QUESTIONS = """\
1. What was the main reason? (Pricing / Missing capability / Competitor / Security-compliance / \
Budget-timing / Buyer cancelled internally / Stakeholder issue / Other)
2. Was another vendor selected? (Yes / No / Unknown)
3. Could we realistically have done something differently? (Yes / No / Unsure)
4. Optional comment.

Reply on this task with your answers, or use the "Correct analysis" action in Revenue Learning."""


def create_clarification_task(provider: Graph8Provider, deal: Deal, analysis: DealAnalysis) -> str:
    title = "Help Revenue Learning understand why this deal was lost" if deal.outcome.value == "lost" else \
        "Help Revenue Learning understand this deal's outcome"
    description = (
        "We couldn't confidently determine the primary reason from the available deal evidence.\n\n"
        f"Current summary: {analysis.summary}\n\n"
        "Please answer these short questions:\n\n" + CLARIFICATION_QUESTIONS
    )
    return provider.create_task(
        graph8_deal_id=deal.graph8_deal_id,
        title=title,
        description=description,
        assignee_hint=deal.owner_name,
    )
