.PHONY: sync backfill backfill-dry sync-activities lint test

PYTHON ?= .venv/bin/python

# The CLI loads .env itself (garmin_sync.config.load_dotenv). Sourcing it here
# instead would corrupt secrets containing $ or #, which make expands or treats
# as a comment.
SYNC := cd sync && ../$(PYTHON) -m garmin_sync.cli

# Routine pull: recent activities (with full-resolution samples) plus the
# per-day sleep, HRV and readiness summaries.
sync:
	$(SYNC) sync $(ARGS)

# Activities only, when the daily endpoints are not worth the requests.
sync-activities:
	$(SYNC) sync --skip-daily $(ARGS)

# One-off: fetch samples for GPS activities recorded before this existed.
# Resumable -- rerun after a rate limit and it continues where it stopped.
# Delete this target with sync/garmin_sync once the migration is confirmed.
backfill:
	$(SYNC) backfill $(ARGS)

backfill-dry:
	$(SYNC) backfill --dry-run

lint:
	ruff check sync
	ruff format --check sync

test:
	cd sync && ../$(PYTHON) -m pytest tests -q
