# garmin-dash

Local-only web app (single Docker image) to **pull, visualize, and annotate** Garmin
activities and sleep. The point is to *extend* what Garmin already stores: pull the
official data, then let the user add their own notes/ratings/fields on top. Later, the
data will be exportable to Obsidian-compatible markdown.

**Audience of this file:** coding agents. Read it before making changes. Keep it current.

---

## Product goals

1. Pull activities (`.fit`) and sleep from Garmin into a local store.
2. Show them in a clean dashboard (charts, tables, detail views).
3. Let the user **annotate / extend** each record with custom fields (feeling, RPE,
   mood, tags, free-text notes — exact set TBD, see Annotations).
4. (Later) Export everything to markdown files for an Obsidian vault.

Single user. Local network only. No auth/multi-tenancy needed.

---

## Confirmed decisions (source of truth — do not silently change)

| Area            | Decision |
|-----------------|----------|
| Storage         | **SQLite** is the source of truth. (Overrides an earlier "markdown-as-database, no DB" design — that is deprecated.) |
| Markdown        | Obsidian markdown export is a **later, separate feature**, not the primary store. |
| Garmin access   | [`python-garminconnect`](https://github.com/cyberjunky/python-garminconnect) (email/password + token cache via `garth`). Not the official partner API. |
| Data scope (v1) | **Activities** (`.fit`) and **Sleep**. Daily health / body composition are out of scope for v1. |
| FIT storage     | Store **summary/lap metrics only** in the DB. Keep the **raw `.fit` file on disk** for full fidelity / later re-parse. Do **not** load per-second time-series into the DB. |
| Backend         | **Python + FastAPI**, serves both the JSON API and the built SPA (single process). |
| Frontend        | **React + Vite + TypeScript**, using **Mantine** as the component library (+ `@mantine/charts` for viz) so we don't hand-build UI. |
| Packaging       | **One Docker image**, multi-stage: node build → python runtime. |

If the user asks to change any of these, update this table in the same change.

---

## Architecture

```
┌──────────────────────────── Docker image ────────────────────────────┐
│  FastAPI (uvicorn, single process)                                    │
│   ├─ /api/*        JSON API (activities, sleep, annotations, sync)     │
│   ├─ /*            serves built React SPA (static files)              │
│   ├─ garmin client  (python-garminconnect + garth token cache)        │
│   └─ SQLite         via SQLAlchemy / SQLModel                         │
└───────────────────────────────────────────────────────────────────────┘
     volumes:  /data  → sqlite db + raw .fit files + garth token cache
```

### Suggested layout
```
garmin-dash/
  CLAUDE.md
  Dockerfile                 # multi-stage: web build → python runtime
  docker-compose.yml         # convenience run with the /data volume
  .env.example
  requirements.txt
  server/                    # FastAPI app (python)
    main.py                  # app factory, static mount, routers
    config.py                # env: GARMIN_EMAIL, GARMIN_PASSWORD, DATA_DIR, ...
    db.py                    # SQLite engine/session
    models.py                # SQLModel tables (Activity, Sleep, ...)
    schemas.py               # API request/response models
    garmin/
      client.py              # login + token cache (garth), thin wrappers
      sync.py                # pull → download .fit → parse summary → upsert
      fit.py                 # .fit parsing (summary/laps only)
    routers/
      activities.py            # list/get + PATCH annotations
      sleep.py                 # list/get + PATCH annotations
      sync.py                  # POST /api/sync
  web/                       # React + Vite + TS + Mantine SPA
    src/
    package.json
    vite.config.ts
```

### Data model (SQLite)
- Two column families per record: **synced** (from Garmin, overwritten on each sync)
  and **annotation** (user-owned, **never** overwritten by sync). Keep them clearly
  separated so re-syncing is safe.
- `activities`: garmin_activity_id (unique), start_time, sport/type, duration,
  distance, avg/max HR, elevation gain, calories, avg pace/power, fit_path (raw file
  on disk), … + annotation fields.
- `sleep`: calendar_date (unique), start/end, total, deep/light/rem/awake, avg HRV,
  resting HR, sleep score, … + annotation fields.
- Sync is **idempotent**: upsert by garmin id / date; seed annotation fields empty on
  first insert; never clobber them afterward.

### Annotations (extend-on-top) — set TBD
Placeholder candidates: `feeling`, `rpe`, `mood`, `tags[]`, `notes` (markdown body).
Finalize with the user before building the editor. These map 1:1 to the future
markdown frontmatter for the Obsidian export.

### Config (env / `.env`)
`GARMIN_EMAIL`, `GARMIN_PASSWORD`, `DATA_DIR` (default `/data`). Garth token cache
lives under `DATA_DIR` so re-login isn't needed every start; keep it out of any future
exported vault.

---

## Later / not yet
- Obsidian markdown export (one `.md` per record, flat YAML frontmatter = synced +
  annotation fields, body = notes).
- Daily health & body composition ingestion.
- Per-second time-series charts (re-parse the stored raw `.fit` on demand).

---

## Environment notes
Host is **NixOS**: no global `python`/`pip`. **Docker daemon is up** (`podman` absent) —
the Docker image is the primary run path. `garth` must be pinned explicitly in
`requirements.txt` (not pulled transitively by `garminconnect`). See project memory
`garmin-dash-env` for details.
