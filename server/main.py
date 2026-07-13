"""FastAPI app: JSON API under /api and the built React SPA at everything else."""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .db import init_db
from .routers import activities, sleep, sync

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="garmin-dash")


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(activities.router)
app.include_router(sleep.router)
app.include_router(sync.router)


# --- Serve the built SPA (mounted last so /api/* wins) ---
_settings = get_settings()
_static = _settings.static_dir
if _static.is_dir():
    app.mount(
        "/assets",
        StaticFiles(directory=_static / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}")
    def spa(full_path: str):  # noqa: ANN201
        # Client-side routing: always return index.html for non-API paths.
        candidate = _static / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static / "index.html")
