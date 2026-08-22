import asyncio
import hmac
import logging
import os
import threading
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from dataclasses import dataclass
from functools import partial
from typing import TYPE_CHECKING, Annotated

import strawberry
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from strawberry.fastapi import GraphQLRouter
from strawberry.schema.config import StrawberryConfig

if TYPE_CHECKING:
    from .hasura import WriterResult

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

DEFAULT_DAYS = 7
MAX_DAYS = 31
DEFAULT_MAX_ACTIVITIES = 20
MAX_ACTIVITIES = 100
SECRET_HEADER = "X-Ondra-Secret"
AUTOMATIC_SYNC_DAYS = 2
AUTOMATIC_SYNC_MAX_ACTIVITIES = 10
AUTOMATIC_SYNC_INTERVAL_S = 24 * 60 * 60

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Settings:
    remote_schema_secret: str
    hasura_graphql_url: str
    hasura_admin_secret: str
    garmin_email: str | None = None
    garmin_password: str | None = None
    garth_dir: str = "/tmp/garth"
    garth_tokens_b64: str | None = None
    automatic_sync_enabled: bool = True

    @classmethod
    def from_environment(cls) -> "Settings":
        values = {
            "remote_schema_secret": os.environ.get("ONDRA_REMOTE_SCHEMA_SECRET", ""),
            "hasura_graphql_url": os.environ.get("HASURA_GRAPHQL_URL", ""),
            "hasura_admin_secret": os.environ.get(
                "ONDRA_HASURA_GRAPHQL_ADMIN_SECRET", ""
            ),
        }
        missing = [name for name, value in values.items() if not value]
        if missing:
            env_names = {
                "remote_schema_secret": "ONDRA_REMOTE_SCHEMA_SECRET",
                "hasura_graphql_url": "HASURA_GRAPHQL_URL",
                "hasura_admin_secret": "ONDRA_HASURA_GRAPHQL_ADMIN_SECRET",
            }
            missing_names = ", ".join(env_names[name] for name in missing)
            raise RuntimeError(
                f"Missing required environment variables: {missing_names}"
            )
        return cls(
            **values,
            garmin_email=os.environ.get("GARMIN_EMAIL") or None,
            garmin_password=os.environ.get("GARMIN_PASSWORD") or None,
            garth_dir=os.environ.get("ONDRA_GARTH_DIR", "/tmp/garth"),
            garth_tokens_b64=os.environ.get("GARTH_TOKENS_B64") or None,
            automatic_sync_enabled=os.environ.get(
                "ONDRA_AUTOMATIC_SYNC_ENABLED", "true"
            ).lower()
            not in {"0", "false", "no"},
        )


@strawberry.type
@dataclass
class SyncResult:
    activities_created: int = strawberry.field(name="activities_created")
    activities_updated: int = strawberry.field(name="activities_updated")
    sleep_created: int = strawberry.field(name="sleep_created")
    sleep_updated: int = strawberry.field(name="sleep_updated")
    hrv_created: int = strawberry.field(name="hrv_created")
    hrv_updated: int = strawberry.field(name="hrv_updated")
    readiness_created: int = strawberry.field(name="readiness_created")
    readiness_updated: int = strawberry.field(name="readiness_updated")
    streams_written: int = strawberry.field(name="streams_written")
    activities_failed: int = strawberry.field(name="activities_failed")
    errors: list[str] = strawberry.field(name="errors")


@strawberry.type
class Query:
    @strawberry.field(description="Service readiness marker.")
    def service(self) -> str:
        return "ondra"


_sync_lock = threading.Lock()


async def _run_sync(
    settings: Settings, *, days: int, max_activities: int
) -> "WriterResult":
    """Run one sync in a worker thread, rejecting concurrent syncs."""
    if not _sync_lock.acquire(blocking=False):
        raise RuntimeError("A Garmin synchronization is already running")
    try:
        from .sync import sync

        return await asyncio.to_thread(
            sync,
            settings,
            days=days,
            max_activities=max_activities,
        )
    finally:
        _sync_lock.release()


async def _automatic_sync_loop(settings: Settings) -> None:
    """Sync immediately on startup, then once every 24 hours."""
    while True:
        try:
            await _run_sync(
                settings,
                days=AUTOMATIC_SYNC_DAYS,
                max_activities=AUTOMATIC_SYNC_MAX_ACTIVITIES,
            )
            log.info("automatic Garmin synchronization completed")
        except RuntimeError as error:
            log.warning("automatic Garmin synchronization skipped: %s", error)
        except Exception:  # noqa: BLE001 -- a failed run must not stop the scheduler
            log.exception("automatic Garmin synchronization failed")
        await asyncio.sleep(AUTOMATIC_SYNC_INTERVAL_S)


@strawberry.type
class Mutation:
    @strawberry.mutation(
        name="syncActivities",
        description=(
            "Run one bounded sync. Omitted arguments use small defaults; values outside "
            "their documented positive bounds are rejected."
        ),
    )
    async def sync_activities(
        self,
        info: strawberry.Info,
        days: int = DEFAULT_DAYS,
        max_activities: Annotated[
            int, strawberry.argument(name="maxActivities")
        ] = DEFAULT_MAX_ACTIVITIES,
    ) -> SyncResult:
        """Run one bounded sync in a worker thread, rejecting overlap."""
        if not 1 <= days <= MAX_DAYS:
            raise ValueError(f"days must be between 1 and {MAX_DAYS}")
        if not 1 <= max_activities <= MAX_ACTIVITIES:
            raise ValueError(f"maxActivities must be between 1 and {MAX_ACTIVITIES}")
        request = info.context["request"]
        result = await _run_sync(
            request.app.state.settings,
            days=days,
            max_activities=max_activities,
        )
        return SyncResult(**result.__dict__)


schema = strawberry.Schema(
    query=Query, mutation=Mutation, config=StrawberryConfig(auto_camel_case=False)
)


@asynccontextmanager
async def _lifespan(_: FastAPI, *, settings: Settings) -> AsyncIterator[None]:
    task: asyncio.Task[None] | None = None
    if settings.automatic_sync_enabled:
        task = asyncio.create_task(
            _automatic_sync_loop(settings),
            name="automatic-garmin-sync",
        )
    yield
    if task is not None:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


def create_app(settings: Settings | None = None) -> FastAPI:
    resolved_settings = settings or Settings.from_environment()
    application = FastAPI(
        title="ondra",
        lifespan=partial(_lifespan, settings=resolved_settings),
    )
    application.state.settings = resolved_settings

    @application.middleware("http")
    async def verify_remote_schema_secret(request: Request, call_next):  # type: ignore[no-untyped-def]
        if request.url.path.rstrip("/") == "/graphql":
            supplied_secret = request.headers.get(SECRET_HEADER, "")
            if not hmac.compare_digest(
                supplied_secret, resolved_settings.remote_schema_secret
            ):
                return JSONResponse(status_code=401, content={"detail": "Unauthorized"})
        return await call_next(request)

    @application.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    application.include_router(GraphQLRouter(schema), prefix="/graphql")
    return application


app = create_app()
