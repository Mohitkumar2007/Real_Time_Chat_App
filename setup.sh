#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "=== ByteTalk setup ==="

if [ ! -f "backend/.env" ]; then
  echo "Creating backend/.env from backend/.env.example"
  cp "backend/.env.example" "backend/.env"
  read -r -p "Enter MongoDB URI [mongodb://localhost:27017/]: " MONGO_URI_INPUT
  MONGO_URI_INPUT="${MONGO_URI_INPUT:-mongodb://localhost:27017/}"
  sed -i "s|^MONGO_URI=.*|MONGO_URI=${MONGO_URI_INPUT}|" "backend/.env"
  echo "Saved MongoDB URI to backend/.env"
fi

PYTHON_BIN="backend/Pro_venv/Scripts/python.exe"

if [ ! -f "$PYTHON_BIN" ]; then
  echo "Creating Python virtual environment at backend/Pro_venv"
  python -m venv "backend/Pro_venv"
fi

echo "Installing backend dependencies..."
"$PYTHON_BIN" -m pip install --upgrade pip
"$PYTHON_BIN" -m pip install -r "backend/requirements.txt"

echo "Installing frontend dependencies..."
(cd frontend && npm install)

echo
echo "Setup complete."
echo "Make sure MongoDB is running before starting the app."
echo "Run ./run.sh or run.bat to start backend and frontend."
