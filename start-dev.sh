#!/usr/bin/env bash
# Start both backend and frontend dev servers
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

cleanup() { kill $(jobs -p) 2>/dev/null; }
trap cleanup EXIT INT TERM

echo "Starting Backend (port 8000)..."
cd "$PROJECT_DIR/backend"
python -m uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

echo "Starting Frontend (port 5173)..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers."

wait
