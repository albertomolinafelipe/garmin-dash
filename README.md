# garmin-dash

Local-only dashboard to pull, visualize, and annotate your Garmin **activities** and
**sleep**. FastAPI + SQLite backend, React + Mantine frontend, shipped as a single
Docker image. See [CLAUDE.md](./CLAUDE.md) for the full design.

## Quick start (Docker)

```bash
cp .env.example .env      # add your Garmin email + password
just up                   # or: docker compose up --build
```

Open http://localhost:8000 and click **Sync** to pull the last 30 days.

### Recipes (`just`)

| Recipe | What it does |
|--------|--------------|
| `just up`   | production app at http://localhost:8000 |
| `just dev`  | hot-reloading stack (backend reload + Vite HMR) at http://localhost:5173 |
| `just down` | stop everything (prod + dev); your `./data` is kept |

Your Garmin login happens once; the tokens are cached under `./data/garth` so
restarts don't need to log in again. All state (SQLite db, raw `.fit` files, tokens)
lives under `./data`.

## What it does

- **Sync** pulls recent activities (with the raw `.fit` saved to disk) and nightly
  sleep, upserting into SQLite. Re-syncing is safe: it only overwrites Garmin-sourced
  fields and never touches your annotations.
- **Annotate** each activity/sleep record with `feeling`, `rpe`, `mood`, `tags`, and
  free-text markdown `notes`. These are yours and survive every re-sync.
- Sleep page shows a stacked stage chart for the last 14 nights.

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/activities` | list (params: `limit`, `offset`, `activity_type`) |
| GET  | `/api/activities/{id}` | one activity |
| PATCH| `/api/activities/{id}` | update annotation fields |
| GET  | `/api/sleep` | list sleep records |
| PATCH| `/api/sleep/{id}` | update annotation fields |
| POST | `/api/sync` | pull from Garmin (params: `days`, `download_fits`) |

## Native dev (optional)

Backend (needs Python 3.12 — on NixOS use the project's dev shell):

```bash
pip install -r requirements.txt
DATA_DIR=./data uvicorn server.main:app --reload
```

Frontend (Vite dev server proxies `/api` → `localhost:8000`):

```bash
cd web && npm install && npm run dev
```

## Roadmap

- Export everything to Obsidian-compatible markdown (one `.md` per record).
- Daily health & body composition ingestion.
- Per-second time-series charts (re-parse the stored raw `.fit`).
