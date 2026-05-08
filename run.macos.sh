#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="$ROOT_DIR/backend/Pro_venv/bin/python"

if [ ! -f "$PYTHON_BIN" ]; then
  echo "backend/Pro_venv was not found. Run bash setup.macos.sh first."
  exit 1
fi

if [ ! -f "$ROOT_DIR/backend/.env" ]; then
  echo "backend/.env was not found. Creating it from backend/.env.example"
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
fi

echo "Starting ByteTalk backend and frontend..."
echo "Backend:  http://127.0.0.1:8000/api/health/"
echo "Frontend: http://127.0.0.1:3000/"
echo

(cd "$ROOT_DIR/backend" && "$PYTHON_BIN" manage.py runserver 127.0.0.1:8000) &
BACKEND_PID=$!

(cd "$ROOT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait
