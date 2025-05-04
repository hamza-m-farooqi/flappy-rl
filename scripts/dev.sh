#!/usr/bin/env sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/.." && pwd)"

cleanup() {
  jobs -p | xargs -r kill
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"
uv run python -m src.main &

cd "${ROOT_DIR}/web"
npm run dev &

wait
