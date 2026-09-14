# garmin-nhost

A personal training dashboard: Garmin activities synced into Nhost (Postgres +
Hasura), annotated and planned through a React dashboard.

<img src="screenshot1.png"/>
<img src="screenshot2.png"/>
<img src="screenshot3.png"/>

## Layout

| Path                | What it is                                              |
| ------------------- | ------------------------------------------------------- |
| `dashboard/`        | React + Vite SPA, deployed as an Nhost Run service       |
| `nhost/migrations/` | Postgres migrations (`nhost.toml` is the project config) |
| `nhost/metadata/`   | Hasura table metadata and permissions                    |
| `flake.nix`         | Dev shell pinning the Nhost CLI, Node and Docker client  |

There is no sync service in the repo. It previously ran as an Nhost Run service
(`ondra`) that Hasura called through a remote schema; Garmin rate-limits made
that unworkable and it was removed. The ingestion contract it used is documented
under [Rebuilding the sync](#rebuilding-the-sync) so it can be rebuilt as a CLI.

## Getting started

Everything runs inside the Nix dev shell:

```sh
nix develop            # nhost-cli, node 22, docker client
nhost up               # local Postgres + Hasura + Auth on local.*.nhost.run
cd dashboard && npm ci && npm run dev
```

`nhost up` needs ports 443/80 free — it fails with `port is already allocated`
if another local stack is bound to them.

Copy `.env.example` → `.env` and `.secrets.example` → `.secrets` at the repo
root, and `dashboard/.env.example` → `dashboard/.env`.

### Dashboard commands

```sh
npm run dev         # vite dev server
npm run typecheck   # tsc -b
npm test            # vitest
npm run build       # tsc -b && vite build
npm run codegen     # regenerate src/graphql/generated.ts from the live schema
```

`codegen` introspects a running Hasura, so `nhost up` must be running:

```sh
HASURA_GRAPHQL_ENDPOINT=https://local.graphql.local.nhost.run/v1 \
HASURA_GRAPHQL_ADMIN_SECRET=<from .secrets> \
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run codegen
```

`generated.ts` is committed; `npm run codegen:check` fails if it drifts from
`operations.graphql`.

### Deploying

Pushing to `main` with changes under `dashboard/**` builds a multi-arch image to
GHCR and runs `nhost run config-deploy` (`.github/workflows/dashboard.yml`).
Schema changes are **not** deployed by CI — apply those yourself:

```sh
nhost config apply --subdomain <subdomain>   # nhost.toml
# migrations + metadata: via the Nhost dashboard or CLI
```

## Data model

### Synced from Garmin

Written by the sync, read-only in the dashboard.

- **`activities`** — one row per Garmin activity, keyed by `garmin_activity_id`.
  Mixes synced columns with user-owned annotation columns (see below).
- **`activity_streams`** — one row per activity, `payload` jsonb holding the
  downsampled HR / elevation / GPS series.
- **`sleep`**, **`daily_hrv`**, **`training_readiness`** — one row per
  `calendar_date`.

### User-owned

- **`activities`** annotation columns — `name`, `subtype`, `feeling`, `effort`,
  `food_during`, `food_after`, `caffeine`, `weather`, `notes`, `focus`,
  `hard_tries`, `strength_exercises`. **The sync must never overwrite these.**
- **`day_plans`** — a dated free-text intention, optional `sport`.
- **`week_objectives`** — a measurable weekly target (`metric` ∈ distance,
  elevation, duration, sessions) diffed against real activity totals.
- **`week_notes`** — one note per ISO week, `week` is the primary key.
- **`sports`** — lookup table backing the `sport` foreign keys. Adding a sport
  is an `INSERT`, not a migration.
- **`races`**, **`exercises`**, **`food_options`** (a view).

ISO weeks are stored as `'2026-W03'` text, CHECK-constrained. They sort
lexicographically in chronological order, which the calendar relies on.

## Rebuilding the sync

The old service pulled from Garmin with `garminconnect` + `garth`, parsed FIT
files with `fitdecode`, and wrote to Hasura over GraphQL. A CLI only needs the
Hasura admin secret and a Garmin session — the FastAPI/Strawberry layer and the
remote-schema wiring exist only because it had to be callable from Hasura.

### Write contract

Upsert with `on_conflict` against these constraints, and **restrict
`update_columns` to synced columns** so re-syncing never clobbers annotations:

| Table                 | Constraint                                       |
| --------------------- | ------------------------------------------------ |
| `activities`          | `activities_garmin_activity_id_key`              |
| `activity_streams`    | `activity_streams_activity_id_key`               |
| `sleep`               | `sleep_calendar_date_key`                        |
| `daily_hrv`           | `daily_hrv_calendar_date_key`                    |
| `training_readiness`  | `training_readiness_calendar_date_timestamp_key` |

Synced columns for `activities`: `activity_type`, `start_time`, `duration_s`,
`distance_m`, `avg_hr`, `max_hr`, `elevation_gain_m`, `calories`,
`avg_speed_mps`, `avg_power_w`, `start_lat`, `start_lng`, `synced_at`.

`start_lat` doubles as the dashboard's "has GPS" flag — the calendar only offers
a hover preview when it is non-null.

### Stream payload

`activity_streams.payload` is currently:

```jsonc
{
  "hr":        [{ "t": 0, "v": 132 }],   // t = seconds elapsed from start
  "elevation": [{ "t": 0, "v": 1840 }],  // v = metres
  "track":     [{ "lat": 42.6, "lng": 0.7 }]
}
```

Series are downsampled independently — HR and elevation bucket-averaged to 400
points, track uniformly thinned to 800.

**Worth changing when you rebuild.** Two known limitations follow from that
shape:

1. **No distance per sample.** Elevation can only be plotted against time, so
   profiles stretch on climbs and compress on descents. FIT `record` messages
   carry a cumulative `distance` field that the old parser never read.
2. **`track` points have no `t`.** Because track and elevation are thinned
   separately they cannot be joined afterwards, so the detail page approximates
   the hovered map marker by *fraction* of the way through the route.

Emitting one unified, once-downsampled record array fixes both:

```jsonc
{ "records": [{ "t": 0, "d": 0, "alt": 1840, "hr": 132, "lat": 42.6, "lng": 0.7 }] }
```

Consumers: `dashboard/src/lib/queries.ts` (`ActivityStreamPayload`),
`pages/ActivityDetail.tsx` (chart + map) and
`components/calendar/elevation-sparkline.tsx`.

## Notes

- **Auth** is passwordless email OTP with signup disabled; users are provisioned
  manually. Local OTP mail needs templates in `nhost/emails/<locale>/` — Auth
  returns a 500 (`template not found`) if the directory is empty.
- **Map tiles** come from Stadia Maps (`lib/map-tiles.ts`). Stadia serves
  `localhost` unauthenticated but returns 401 tiles elsewhere, so allowlist the
  deployed domain on the Stadia account or set `VITE_STADIA_API_KEY`. CARTO is
  deliberately unused: it now stamps "API KEY REQUIRED" onto keyless tiles while
  still returning HTTP 200, so the failure is silent.
- **The 3D terrain view** needs `VITE_MAPTILER_KEY`; it renders a message when
  absent.
