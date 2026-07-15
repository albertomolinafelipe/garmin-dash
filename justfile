# garmin-dash tasks — run `just <recipe>`

# production app at http://localhost:8000
up:
    docker compose up --build -d

# native hot-reload dev (no containers): FastAPI on :8000, Vite HMR on :5173.
# Requires the Nix dev shell — `direnv allow` (or `nix develop`) provides python + node.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    export DATA_DIR="${DATA_DIR:-./data}"
    mkdir -p "$DATA_DIR"
    ( cd web && npm install )
    uvicorn server.main:app --reload --port 8000 &
    backend=$!
    trap 'kill "$backend" 2>/dev/null || true' EXIT
    cd web && npm run dev

# containerized hot-reload dev (fallback if the Nix shell isn't set up)
dev-docker:
    docker compose build

# stop the docker stacks (prod + dev-docker), data is kept
down:
    docker compose down
