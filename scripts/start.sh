#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Parse optional arguments
FOREGROUND=0
for arg in "$@"; do
  case $arg in
    --stop)
      "$SCRIPT_DIR/stop.sh"
      exit 0
      ;;
    --status)
      "$SCRIPT_DIR/status.sh"
      exit 0
      ;;
    --foreground|-f)
      FOREGROUND=1
      ;;
  esac
done

echo "=================================================="
echo "  🎬 Initializing Vibetube Ads Telemetry Platform "
echo "=================================================="

# Check if services are already running via PID file or ports
ALREADY_RUNNING=0
if [ -f "$ROOT_DIR/.pids/ad_server.pid" ]; then
  OLD_PID=$(cat "$ROOT_DIR/.pids/ad_server.pid" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    ALREADY_RUNNING=1
  fi
fi

if [ "$ALREADY_RUNNING" -eq 0 ] && command -v lsof &>/dev/null; then
  if lsof -ti :8080 &>/dev/null && lsof -ti :3000 &>/dev/null; then
    ALREADY_RUNNING=1
  fi
fi

if [ "$ALREADY_RUNNING" -eq 1 ]; then
  echo ""
  echo "ℹ️  Vibetube Ads services are already active!"
  "$SCRIPT_DIR/status.sh"
  echo "To restart services, run: ./scripts/stop.sh && ./scripts/start.sh"
  exit 0
fi

# 1. Resolve Google Cloud Project ID
if [ -z "$GCP_PROJECT_ID" ]; then
  export GCP_PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-${DEVSHELL_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}}"
fi
if [ -n "$GCP_PROJECT_ID" ]; then
  export GOOGLE_CLOUD_PROJECT="$GCP_PROJECT_ID"
fi

PYTHON_BIN="python3"
if [ -f "$HOME/.virtualenvs/vibetube-ads/bin/python3" ]; then
  PYTHON_BIN="$HOME/.virtualenvs/vibetube-ads/bin/python3"
fi

# 2. Ensure google-adk is pinned to version 2.7.1
if command -v "$PYTHON_BIN" &>/dev/null; then
  CURRENT_ADK_VER=$("$PYTHON_BIN" -c "import google.adk; print(getattr(google.adk, '__version__', ''))" 2>/dev/null || true)
  if [ "$CURRENT_ADK_VER" != "2.7.1" ]; then
    echo ""
    echo "Upgrading google-adk to version 2.7.1..."
    "$PYTHON_BIN" -m pip install --quiet --upgrade "google-adk==2.7.1" 2>/dev/null || true
  fi
fi

# 3. Pre-populate BigQuery telemetry if not already seeded
if command -v "$PYTHON_BIN" &>/dev/null; then
  "$PYTHON_BIN" "$SCRIPT_DIR/init_bigquery.py" || true
fi

# 4. Ensure frontend dependencies are installed (specifically checking for vite binary)
if [ ! -f "$ROOT_DIR/ad_ops_control_center/node_modules/.bin/vite" ]; then
  echo ""
  echo "Installing frontend dependencies (including devDependencies)..."
  (cd "$ROOT_DIR/ad_ops_control_center" && npm install --include=dev)
fi

# 5. Build static production bundle so Ad Server can serve the UI directly on port 8080
if [ ! -d "$ROOT_DIR/ad_ops_control_center/dist" ]; then
  echo ""
  echo "Building frontend bundle for port 8080 serving..."
  (cd "$ROOT_DIR/ad_ops_control_center" && npm run build)
fi

# Ensure log and pid directories exist
mkdir -p "$ROOT_DIR/logs"
mkdir -p "$ROOT_DIR/.pids"

echo ""
echo "Compiling Vibetube Ad Server..."
cd "$ROOT_DIR/ad_server"
go build -o vibetube-ad-server .

if [ "$FOREGROUND" -eq 1 ]; then
  echo "Starting Vibetube Ad Server (foreground mode)..."
  ./vibetube-ad-server &
  AD_SERVER_PID=$!
  echo "$AD_SERVER_PID" > "$ROOT_DIR/.pids/ad_server.pid"

  echo "Starting Ad Ops Control Center (foreground mode)..."
  cd "$ROOT_DIR/ad_ops_control_center"
  npm run dev -- --host 0.0.0.0 --port 3000 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$ROOT_DIR/.pids/frontend.pid"

  echo ""
  echo "=================================================="
  echo "  🎬 Vibetube Ads Running (Foreground Mode)"
  echo ""
  echo "  👉 Local Browser: http://localhost:3000"
  echo "  👉 Cloud Shell  : Web Preview on port 3000 (or 8080)"
  echo ""
  echo "  Press Ctrl+C to stop services."
  echo "=================================================="

  trap "echo ''; echo 'Shutting down Vibetube services...'; kill $AD_SERVER_PID $FRONTEND_PID 2>/dev/null; rm -f $ROOT_DIR/.pids/*.pid" EXIT
  wait
else
  echo "Starting Vibetube Ad Server on port 8080 in the background..."
  nohup ./vibetube-ad-server > "$ROOT_DIR/logs/ad_server.log" 2>&1 &
  AD_SERVER_PID=$!
  echo "$AD_SERVER_PID" > "$ROOT_DIR/.pids/ad_server.pid"

  echo "Starting Ad Ops Control Center on port 3000 in the background..."
  cd "$ROOT_DIR/ad_ops_control_center"
  nohup npm run dev -- --host 0.0.0.0 --port 3000 > "$ROOT_DIR/logs/frontend.log" 2>&1 &
  FRONTEND_PID=$!
  echo "$FRONTEND_PID" > "$ROOT_DIR/.pids/frontend.pid"

  # Disown to detach processes from current terminal session
  disown "$AD_SERVER_PID" 2>/dev/null || true
  disown "$FRONTEND_PID" 2>/dev/null || true

  # Brief health verification
  sleep 2
  if ! kill -0 "$AD_SERVER_PID" 2>/dev/null; then
    echo "❌ Error: Vibetube Ad Server failed to start. Logs:"
    tail -n 20 "$ROOT_DIR/logs/ad_server.log"
    exit 1
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "❌ Error: Ad Ops Control Center failed to start. Logs:"
    tail -n 20 "$ROOT_DIR/logs/frontend.log"
    exit 1
  fi

  echo ""
  echo "=================================================="
  echo "  🎬 Vibetube Ads Running in the Background!"
  echo ""
  echo "  👉 Local Browser: http://localhost:3000"
  echo "  👉 Cloud Shell  : Click 'Web Preview' (top right)"
  echo "                    and select 'Preview on port 3000'"
  echo "                    (or default port 8080)"
  echo ""
  echo "  📋 Service Logs:"
  echo "     tail -f logs/ad_server.log"
  echo "     tail -f logs/frontend.log"
  echo ""
  echo "  🛑 Stop Services:"
  echo "     ./scripts/stop.sh"
  echo "=================================================="
  echo ""
  echo "Your terminal prompt is ready. The helper site continues running in the background."
  echo ""
fi
