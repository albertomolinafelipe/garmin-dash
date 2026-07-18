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
      process.py             # ingest step: seed name + auto subtype (discrete from edit)
      fit.py                 # .fit parsing (summary/laps only)
    routers/
      activities.py            # list/get + PATCH annotations + GET food suggestions
      exercises.py             # GET/PUT the strength exercise catalog (exercises.yaml)
      sleep.py                 # list/get
      sync.py                  # POST /api/sync
  web/                       # React + Vite + TS + Mantine SPA
    src/
    package.json
    vite.config.ts
```

### Data model (SQLite)

- Three families of columns per activity (see Processing vs annotation below):
  - **synced** — from Garmin, overwritten on each process/sync (metrics, fit_path).
  - **seeded-once** — machine-decided at first ingest, then user-editable and never
    clobbered by re-processing: `name`, and the running `subtype` for the unambiguous
    cases (`running→road`, `treadmill_running→treadmill`).
  - **annotation** — purely user-owned, never touched by processing.
- `activities`: garmin_activity_id (unique), start_time, sport/type, duration,
  distance, avg/max HR, elevation gain, calories, avg pace/power, fit_path (raw file
  on disk) [synced]; `name`, `subtype` [seeded-once] + annotation fields (see
  Annotations): `feeling`, `effort`, `food_during[]`, `food_after[]`, `caffeine`,
  `strength_exercises[]` (JSON list of `{exercise, sets, reps, weight}`, weight null =
  bodyweight).
- `sleep`: calendar_date (unique), start/end, total, deep/light/rem/awake, avg HRV,
  resting HR, sleep score, … (no annotation fields yet).
- Processing/sync is **idempotent**: upsert by garmin id / date; seed name/subtype on
  first insert; never clobber seeded or annotation fields afterward.

### Processing vs annotation — two discrete, separate steps

Every activity goes through two clearly separated phases. Keep the code paths distinct
(a processing/ingest step vs. the annotation PATCH surface).

1. **Processing (ingest).** Runs when an activity is first pulled from the Garmin API,
   and is re-runnable. Deterministic, idempotent, machine-only. It writes the **synced**
   metrics from the API / `.fit` summary (overwritten on re-process) and **seeds** the
   fields the machine can decide once: `name` (from Garmin) and the running `subtype`
   when unambiguous (`running→road`, `treadmill_running→treadmill`). Processing must
   **never** touch anything the user has entered.
2. **Annotation (edit).** The human layer, done later per activity on the detail page.
   Seeded fields (`name`) stay editable and are **not** clobbered by re-processing;
   annotation fields are user-owned and never overwritten.

The user is not actively syncing right now, but the design must keep these two steps
discrete regardless.

### Annotations

The activity detail page is the annotation surface. It must: let the user **edit the
name**, and have **no "back" button** and **no manual "annotated" toggle**.

Required annotation fields depend on the activity **category** (taxonomy lives in
`web/src/activityTypes.ts`):

- **Running** (road / trail / treadmill / mountain):
  - `subtype` — auto-set in processing for road & treadmill. **trail_running** is
    ambiguous, so the user must choose **trail** or **mountain**.
  - `feeling` — 1–5, shown as five faces (sad → happy).
  - `effort` — 1–5 (how hard I tried).
  - `food_during`, `food_after` — each a **creatable multi-select**: no options at
    first; typing a new value adds it, and previously-used values are suggested so the
    vocabulary converges (type "oat…" → suggest "oatmeal"). Suggestions are the distinct
    set of foods used across all activities (a learned vocabulary served by the API);
    both fields share the same suggestion list.
  - `caffeine` — `yes` / `no` / `residual`.
- **Climbing**: `subtype` must be set by hand — `rope` / `boulder` / `board`.
- **Strength**: `feeling` + `effort` (1–5), plus an optional **workout log**
  (`strength_exercises`): a list of compact `{exercise, sets, reps, weight}` rows
  (weight blank = bodyweight). Exercise names are suggested from a **user-editable
  catalog** stored as a plain YAML file (`DATA_DIR/exercises.yaml`, top-level
  `exercises:` list of `{name, categories?}` where `categories` is free-form tags —
  a string or list, e.g. `[push, calisthenics]`), served by `routers/exercises.py` and
  edited raw in the **Settings** page. The catalog is the strength analogue of the
  learned food vocabulary, but managed by hand rather than derived from usage. Only
  `feeling`/`effort` count toward completeness; the workout log is optional.
- Other categories: no required fields yet.

**Completeness is derived, not stored.** An activity **needs annotation** when any
required field for its category is missing, and flips to **done** once all are filled.
This drives the Overview "needs annotation" panel (no manual flag). Historical activities
before **2026-07-13** are grandfathered as done so they don't flood the panel — this
supersedes the old `annotated` boolean + date backfill (reconcile that column in code
when implementing).

All annotation fields map 1:1 to the future Obsidian markdown frontmatter.

### Config (env / `.env`)

`GARMIN_EMAIL`, `GARMIN_PASSWORD`, `DATA_DIR` (default `/data`). Garth token cache
and the strength exercise catalog (`exercises.yaml`) live under `DATA_DIR` so re-login
isn't needed every start; keep it out of any future
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
