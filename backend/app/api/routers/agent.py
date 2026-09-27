import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_org_id
from app.db.session import get_db
from app.models.audit import AgentRun
from app.schemas.api import AgentAskIn, AgentAskOut
from app.security.auth import get_current_user
from app.services.agents.revenue_learning_agent import ask

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.post("/ask", response_model=AgentAskOut)
def ask_agent(
    payload: AgentAskIn,
    db: Session = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_org_id),
    user=Depends(get_current_user),
):
    answer, sources, suggested_actions = ask(db, organization_id=organization_id, question=payload.question)
    db.add(
        AgentRun(
            organization_id=organization_id,
            user_id=user.id,
            question=payload.question,
            answer=answer,
            tools_used={"sources": sources},
        )
    )
    db.commit()
    return AgentAskOut(answer=answer, sources=sources, suggested_actions=suggested_actions)
