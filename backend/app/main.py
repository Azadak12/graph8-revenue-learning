from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routers import agent, auth, deals, demo, learnings, overview, recommendations, reps, settings, webhooks
from app.core.config import get_settings
from app.core.logging import configure_logging

settings_ = get_settings()
configure_logging(settings_.environment)

app = FastAPI(title=settings_.app_name)

cors_kwargs: dict = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if settings_.environment == "development":
    # The frontend dev server's port isn't fixed (e.g. Claude Code's preview tooling
    # assigns an ephemeral port per session), so allow any localhost/127.0.0.1 origin
    # in development rather than trying to keep an explicit allowlist in sync.
    cors_kwargs["allow_origin_regex"] = r"^https?://(localhost|127\.0\.0\.1):\d+$"
else:
    cors_kwargs["allow_origins"] = settings_.cors_origins

app.add_middleware(CORSMiddleware, **cors_kwargs)

app.include_router(auth.router)
app.include_router(deals.router)
app.include_router(learnings.router)
app.include_router(recommendations.router)
app.include_router(reps.router)
app.include_router(overview.router)
app.include_router(agent.router)
app.include_router(settings.router)
app.include_router(webhooks.router)
app.include_router(demo.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings_.app_name}
