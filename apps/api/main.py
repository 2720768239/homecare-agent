"""FastAPI application entry point for HomeCare Agent API v0.1."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    agent_runs,
    attachments,
    auth,
    devices,
    fault_records,
    reminders,
    settings,
)
from app.core.config import settings as app_settings

app = FastAPI(title=app_settings.API_TITLE, version=app_settings.API_VERSION)

# CORS middleware — allow all origins for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers with /api prefix
app.include_router(auth.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")
app.include_router(fault_records.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(agent_runs.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


@app.get("/health")
def health_check():
    return {"status": "ok", "service": app_settings.API_TITLE, "version": app_settings.API_VERSION}
