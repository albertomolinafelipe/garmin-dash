# garmin-dash tasks — run `just <recipe>`

# production app at http://localhost:8000
up:
    docker compose up --build

# hot-reloading dev stack (backend reload + Vite HMR) at http://localhost:5173
dev:
    docker compose build
    docker compose -f docker-compose.dev.yml up

# stop everything (prod + dev), data is kept
down:
    docker compose down
    docker compose -f docker-compose.dev.yml down
