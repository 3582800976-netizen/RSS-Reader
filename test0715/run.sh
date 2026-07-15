#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

PORT=6789
HOST=127.0.0.1

free_port() {
  local pids
  pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Port ${PORT} is in use (PID: ${pids}), stopping old process..."
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 0.8
    pids="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
      sleep 0.3
    fi
  fi
}

free_port

echo "==> [1/4] Python venv + dependencies"
python3 -m venv backend/.venv
# shellcheck disable=SC1091
source backend/.venv/bin/activate
pip install -q -r backend/requirements.txt

echo "==> [2/4] Frontend install + build"
cd frontend
if command -v npm >/dev/null 2>&1; then
  npm install
  npm run build
else
  echo "ERROR: npm not found. Please install Node.js / npm." >&2
  exit 1
fi
cd "$ROOT"

echo "==> [3/4] Ensure data directory"
mkdir -p data

echo "==> [4/4] Start server at http://${HOST}:${PORT}"
export PYTHONPATH="$ROOT/backend"
exec uvicorn app.main:app --host "$HOST" --port "$PORT" --app-dir "$ROOT/backend"
