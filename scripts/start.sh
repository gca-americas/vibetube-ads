#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo "  🎬 Initializing Vibetube Ads Telemetry Platform "
echo "=================================================="

# 1. Pre-populate BigQuery telemetry if not already seeded
if command -v python3 &>/dev/null; then
  python3 "$SCRIPT_DIR/init_bigquery.py" || true
fi

echo ""
echo "Starting Vibetube Ad Server..."
cd "$ROOT_DIR/ad_server"
go build -o vibetube-ad-server
./vibetube-ad-server &
AD_SERVER_PID=$!

echo "Starting Ad Ops Control Center (Frontend)..."
cd "$ROOT_DIR/ad_ops_control_center/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "  🎬 Vibetube Ads Running Locally:"
echo "  👉 Control Center UI : http://localhost:3000"
echo "  👉 Ad Server API     : http://localhost:8080"
echo "=================================================="
echo ""

# Trap Ctrl+C (SIGINT) to kill background processes
trap "echo 'Shutting down Vibetube services...'; kill $AD_SERVER_PID $FRONTEND_PID 2>/dev/null" EXIT

# Wait for background jobs to finish
wait
