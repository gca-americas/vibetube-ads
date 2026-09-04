#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo "  🎬 Initializing Vibetube Ads Telemetry Platform "
echo "=================================================="

# 1. Resolve Google Cloud Project ID
if [ -z "$GCP_PROJECT_ID" ]; then
  export GCP_PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${DEVSHELL_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
fi
if [ -n "$GCP_PROJECT_ID" ]; then
  export GOOGLE_CLOUD_PROJECT="$GCP_PROJECT_ID"
fi

# 2. Pre-populate BigQuery telemetry if not already seeded
if command -v python3 &>/dev/null; then
  python3 "$SCRIPT_DIR/init_bigquery.py" || true
fi

# 3. Ensure frontend dependencies are installed (specifically checking for vite binary)
if [ ! -f "$ROOT_DIR/ad_ops_control_center/frontend/node_modules/.bin/vite" ]; then
  echo ""
  echo "Installing frontend dependencies (including devDependencies)..."
  (cd "$ROOT_DIR/ad_ops_control_center/frontend" && npm install --include=dev)
fi

# 4. Build static production bundle so Ad Server can serve the UI directly on port 8080
if [ ! -d "$ROOT_DIR/ad_ops_control_center/frontend/dist" ]; then
  echo ""
  echo "Building frontend bundle for port 8080 serving..."
  (cd "$ROOT_DIR/ad_ops_control_center/frontend" && npm run build)
fi

echo ""
echo "Starting Vibetube Ad Server..."
cd "$ROOT_DIR/ad_server"
go build -o vibetube-ad-server .
./vibetube-ad-server &
AD_SERVER_PID=$!

echo "Starting Ad Ops Control Center (Frontend)..."
cd "$ROOT_DIR/ad_ops_control_center/frontend"
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!

echo ""
echo "=================================================="
echo "  🎬 Vibetube Ads Running Successfully!"
echo ""
echo "  👉 Cloud Shell Web Preview:"
echo "     - Default Preview (Port 8080): http://localhost:8080"
echo "     - Vite Dev Server (Port 3000): http://localhost:3000"
echo "     (Click 'Web Preview' in the Cloud Shell top-right toolbar)"
echo ""
echo "  ℹ️  Servers are actively running. Press Ctrl+C to stop."
echo "=================================================="
echo ""

# Trap Ctrl+C (SIGINT) to kill background processes
trap "echo ''; echo 'Shutting down Vibetube services...'; kill $AD_SERVER_PID $FRONTEND_PID 2>/dev/null" EXIT

# Wait for background jobs to finish
wait
