"""Seed runtime and database configuration tests."""

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.db.database import Base, engine
from app.db.models import DeviceModel
from app.db.seed_runtime import seed_if_empty


def test_database_url_defaults_to_repo_local_sqlite():
    assert settings.DATABASE_URL.endswith("data/homecare-agent.db")


def test_main_flow_tables_exist_after_migration():
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    assert {"devices", "attachments", "reminders", "fault_records", "agent_runs", "manual_chunks"} <= table_names


@pytest.fixture
def db_session():
    test_engine = create_engine(
        "sqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    SessionLocal = sessionmaker(bind=test_engine, autoflush=False, autocommit=False, future=True)
    with SessionLocal() as db:
        yield db


def test_seed_runtime_populates_devices(db_session):
    seed_if_empty(db_session)
    rows = db_session.execute(select(DeviceModel)).scalars().all()
    assert rows
