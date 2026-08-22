#!/usr/bin/env bash
# Log in to Garmin locally and push the resulting garth tokens as the
# GARTH_TOKENS_B64 secret for the linked Nhost project. Run from the repo root.
set -euo pipefail

cd "$(dirname "$0")"

if [[ -z "${SEED_GARTH_IN_NIX:-}" ]]; then
	exec nix develop --command env SEED_GARTH_IN_NIX=1 bash "$0" "$@"
fi

# Load the Nhost CLI endpoint overrides used by this staging workspace.
set -a
# shellcheck disable=SC1091
source .env
set +a

TOKEN_DIR="$(mktemp -d)"
trap 'rm -rf "$TOKEN_DIR"' EXIT

read -rp "Garmin email: " GARMIN_EMAIL
read -rsp "Garmin password: " GARMIN_PASSWORD
echo
export GARMIN_EMAIL GARMIN_PASSWORD TOKEN_DIR

python - <<'PY'
import os
import garth

garth.login(os.environ["GARMIN_EMAIL"], os.environ["GARMIN_PASSWORD"])
garth.save(os.environ["TOKEN_DIR"])
print("Garmin login OK; tokens dumped.")
PY

BLOB="$(
	python - <<'PY'
import base64, json, os, pathlib
d = pathlib.Path(os.environ["TOKEN_DIR"])
payload = {name: (d / name).read_text()
           for name in ("oauth1_token.json", "oauth2_token.json")}
print(base64.b64encode(json.dumps(payload).encode()).decode())
PY
)"

if nhost secrets create GARTH_TOKENS_B64 "$BLOB" 2>/dev/null; then
	echo "Created GARTH_TOKENS_B64 secret."
else
	nhost secrets update GARTH_TOKENS_B64 "$BLOB"
	echo "Updated GARTH_TOKENS_B64 secret."
fi

echo "Done. Redeploy/restart ondra to pick up the new tokens."
