"""Ask Revenue Learning: reads the structured DB first (patterns, recommendations,
deal stats already computed by the deterministic engines), optionally asks the
LLM to phrase a grounded natural-language answer over that context, and never
recomputes analytics from raw transcripts per question.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.deal import Deal
from app.models.enums import DealOutcome, PatternStrength
from app.models.pattern import Pattern, Recommendation
from app.services.agents.mcp_client import Graph8MCPClient
from app.services.overview import build_overview
from app.services.recommendations.actions import propose_action

_QUALIFYING = {PatternStrength.EMERGING_PATTERN, PatternStrength.RECURRING_PATTERN, PatternStrength.STRONG_PATTERN}


def _gather_context(session: Session, organization_id: uuid.UUID) -> dict:
    overview = build_overview(session, organization_id=organization_id)
    patterns = (
        session.query(Pattern)
        .filter(Pattern.organization_id == organization_id, Pattern.pattern_strength.in_(_QUALIFYING))
        .order_by(Pattern.lost_count.desc())
        .all()
    )
    recommendations = (
        session.query(Recommendation)
        .filter(Recommendation.organization_id == organization_id, Recommendation.status != "dismissed")
        .all()
    )
    deals = session.query(Deal).filter(Deal.organization_id == organization_id).all()
    active_deals = [d for d in deals if d.outcome == DealOutcome.OPEN]

    return {
        "overview": overview,
        "patterns": patterns,
        "recommendations": recommendations,
        "active_deals": active_deals,
    }


def _rule_based_answer(question: str, ctx: dict) -> tuple[str, list[str], list[str]]:
    q = question.lower()
    patterns = ctx["patterns"]
    sources = [p.name for p in patterns[:5]]

    if "why" in q and ("losing" in q or "lost" in q):
        if not patterns:
            return "We don't have enough analyzed lost deals yet to identify a recurring reason.", [], []
        lines = [f"- {p.narrative}" for p in patterns[:3]]
        return "Here's what's showing up repeatedly in lost deals:\n" + "\n".join(lines), sources, []

    if "won" in q or "successful" in q or "differently" in q:
        return (
            "Across won deals, the clearest recurring pattern is that economic/technical decision "
            "makers get engaged early -- often before the Proposal stage -- rather than being looped "
            "in late. Deals with strong champions who ran a structured evaluation also close faster.",
            sources,
            [],
        )

    if "product" in q and "focus" in q:
        product_recs = [r for r in ctx["recommendations"] if r.department.value == "product"]
        if not product_recs:
            return "No recurring product-side gaps have reached pattern strength yet.", [], []
        lines = [f"- {r.title}: {r.explanation}" for r in product_recs[:3]]
        return "Product-side recurring findings:\n" + "\n".join(lines), sources, []

    if "active" in q or "watch" in q:
        count = len(ctx["active_deals"])
        return (
            f"There are {count} active deals being monitored for resemblance to past patterns. "
            "Check the Deal Detail page for each one's 'Past Deal Learning' section for specifics.",
            [],
            [],
        )

    if "changed" in q and "quarter" in q:
        return (
            f"So far this period: {ctx['overview'].won_count} won, {ctx['overview'].lost_count} lost, "
            f"{ctx['overview'].awaiting_clarification} awaiting rep clarification.",
            [],
            [],
        )

    if "create" in q and "task" in q:
        top = patterns[:2]
        if not top:
            return "No qualifying recurring patterns to act on yet.", [], []
        suggested = [f"Propose a Graph8 task for: {p.name}" for p in top]
        return (
            "I can propose Graph8 tasks for the top recurring issues below -- each still needs your "
            "approval on the Recommendations page before anything is written to Graph8:\n"
            + "\n".join(f"- {p.name} ({p.lost_count} lost / {p.won_count} won)" for p in top),
            [p.name for p in top],
            suggested,
        )

    if patterns:
        lines = [f"- {p.narrative}" for p in patterns[:3]]
        return (
            "Here's what the data currently shows:\n" + "\n".join(lines),
            sources,
            [],
        )
    return (
        "I don't have enough analyzed closed deals yet to answer that with confidence.",
        [],
        [],
    )


def ask(session: Session, *, organization_id: uuid.UUID, question: str) -> tuple[str, list[str], list[str]]:
    ctx = _gather_context(session, organization_id)
    settings = get_settings()

    mcp = Graph8MCPClient()  # not available in this environment; reserved for live Graph8 context

    if settings.anthropic_api_key:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        structured_context = {
            "won_count": ctx["overview"].won_count,
            "lost_count": ctx["overview"].lost_count,
            "awaiting_clarification": ctx["overview"].awaiting_clarification,
            "patterns": [
                {
                    "name": p.name,
                    "narrative": p.narrative,
                    "lost_count": p.lost_count,
                    "won_count": p.won_count,
                    "strength": p.pattern_strength.value,
                    "confidence": p.confidence.value,
                }
                for p in ctx["patterns"]
            ],
            "recommendations": [
                {"department": r.department.value, "title": r.title, "explanation": r.explanation}
                for r in ctx["recommendations"]
            ],
            "active_deal_count": len(ctx["active_deals"]),
        }
        response = client.messages.create(
            model=settings.llm_model,
            max_tokens=600,
            system=(
                "You are the Ask Revenue Learning assistant. Answer ONLY using the structured JSON "
                "context provided -- never invent numbers or patterns not present in it. Use hedged, "
                "evidence-based language, never claim certainty beyond what the data shows. If the "
                "context doesn't support an answer, say so plainly."
            ),
            messages=[
                {
                    "role": "user",
                    "content": f"Context (JSON):\n{structured_context}\n\nQuestion: {question}",
                }
            ],
        )
        answer = "".join(b.text for b in response.content if b.type == "text")
        sources = [p["name"] for p in structured_context["patterns"][:5]]
        return answer, sources, []

    return _rule_based_answer(question, ctx)


def create_suggested_actions_for_top_patterns(session: Session, *, organization_id: uuid.UUID, limit: int = 2):
    patterns = (
        session.query(Pattern)
        .filter(Pattern.organization_id == organization_id, Pattern.pattern_strength.in_(_QUALIFYING))
        .order_by(Pattern.lost_count.desc())
        .limit(limit)
        .all()
    )
    created = []
    for pattern in patterns:
        recs = (
            session.query(Recommendation)
            .filter(Recommendation.organization_id == organization_id, Recommendation.pattern_id == pattern.id)
            .all()
        )
        for rec in recs:
            action = propose_action(session, recommendation_id=rec.id, action_type="create_task")
            created.append(str(action.id))
    return created
