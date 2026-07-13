"""SQLite engine + session management."""
from __future__ import annotations

from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings

_settings = get_settings()

# check_same_thread=False lets FastAPI's threadpool share the connection safely
# for our single-user local workload.
engine = create_engine(
    _settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    _settings.ensure_dirs()
    # Import models so SQLModel.metadata is populated before create_all.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(engine)

    # Alter/backfill existing tables (create_all won't touch them).
    from .migrations import run_migrations

    run_migrations()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
