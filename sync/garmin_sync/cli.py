"""Command line entry point: `sync` for routine use, `backfill` for the one-off."""

from __future__ import annotations

import argparse
import logging
import sys
import time

from . import db
from .config import ConfigError, Settings
from .garmin import GarminAuthError, GarminRateLimitError, login
from .pull import Report, download_samples, sync_activities, sync_daily

log = logging.getLogger("garmin_sync")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="garmin-sync")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="log every request"
    )
    commands = parser.add_subparsers(dest="command", required=True)

    sync_cmd = commands.add_parser("sync", help="pull recent Garmin data")
    sync_cmd.add_argument(
        "--limit", type=int, default=20, help="activities to examine (default 20)"
    )
    sync_cmd.add_argument(
        "--days", type=int, default=7, help="days of sleep/HRV/readiness (default 7)"
    )
    sync_cmd.add_argument(
        "--force",
        action="store_true",
        help="re-download activities already stored",
    )
    sync_cmd.add_argument(
        "--skip-daily",
        action="store_true",
        help="activities only; skip sleep, HRV and readiness",
    )

    backfill_cmd = commands.add_parser(
        "backfill", help="one-off: fetch samples for existing GPS activities"
    )
    backfill_cmd.add_argument(
        "--limit", type=int, default=None, help="stop after N activities"
    )
    backfill_cmd.add_argument(
        "--dry-run",
        action="store_true",
        help="list what would be fetched and exit",
    )

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(message)s",
    )

    try:
        settings = Settings.from_env()
    except ConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        if args.command == "sync":
            return _run_sync(settings, args)
        return _run_backfill(settings, args)
    except (GarminAuthError, GarminRateLimitError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\ninterrupted; completed activities are saved", file=sys.stderr)
        return 130


def _run_sync(settings: Settings, args: argparse.Namespace) -> int:
    client = login(settings)
    report = Report()
    with db.connect(settings.database_url) as conn:
        sync_activities(
            conn, client, settings, limit=args.limit, force=args.force, report=report
        )
        if not args.skip_daily:
            sync_daily(conn, client, settings, days=args.days, report=report)
    return _finish(report)


def _run_backfill(settings: Settings, args: argparse.Namespace) -> int:
    """Fetch full-resolution samples for activities that predate them.

    Deliberately narrow: it reads candidates from the database, writes only
    activity_samples, and touches exactly one column on activities
    (samples_synced_at). Activity summaries and annotations are never written.
    """
    with db.connect(settings.database_url) as conn:
        pending = db.activities_needing_samples(conn, limit=args.limit)
        if not pending:
            print("nothing to backfill: every GPS activity already has samples")
            return 0

        print(f"{len(pending)} activities to backfill")
        if args.dry_run:
            for _, garmin_activity_id in pending:
                print(f"  would fetch {garmin_activity_id}")
            return 0

        client = login(settings)
        report = Report()
        for index, (activity_id, garmin_activity_id) in enumerate(pending, start=1):
            try:
                samples = download_samples(client, garmin_activity_id)
                if not samples:
                    report.errors.append(f"activity {garmin_activity_id}: no samples")
                    conn.rollback()
                else:
                    report.samples += db.replace_samples(conn, activity_id, samples)
                    report.activities += 1
                    conn.commit()
                print(
                    f"[{index}/{len(pending)}] {garmin_activity_id}: "
                    f"{len(samples)} samples",
                    flush=True,
                )
            except KeyboardInterrupt:
                conn.rollback()
                raise
            except Exception as exc:  # noqa: BLE001 - tolerate one bad activity
                conn.rollback()
                report.errors.append(f"activity {garmin_activity_id} failed: {exc}")
                print(f"[{index}/{len(pending)}] {garmin_activity_id}: {exc}")
            time.sleep(settings.request_delay_s)
    return _finish(report)


def _finish(report: Report) -> int:
    print(report.summary())
    for message in report.errors:
        print(f"  {message}", file=sys.stderr)
    return 1 if report.errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
