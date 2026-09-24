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
    --setup-project)
      "$SCRIPT_DIR/setup_project.sh"
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

# Check if BOTH services are already running via PID file or ports
AD_ALIVE=0
FRONT_ALIVE=0

if [ -f "$ROOT_DIR/.pids/ad_server.pid" ]; then
  OLD_PID=$(cat "$ROOT_DIR/.pids/ad_server.pid" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    AD_ALIVE=1
  fi
fi

if [ "$AD_ALIVE" -eq 0 ] && command -v lsof &>/dev/null; then
  if lsof -ti :8080 -sTCP:LISTEN &>/dev/null; then
    AD_ALIVE=1
  fi
fi

if [ -f "$ROOT_DIR/.pids/frontend.pid" ]; then
  OLD_PID=$(cat "$ROOT_DIR/.pids/frontend.pid" 2>/dev/null || true)
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    FRONT_ALIVE=1
  fi
fi

if [ "$FRONT_ALIVE" -eq 0 ] && command -v lsof &>/dev/null; then
  if lsof -ti :3000 -sTCP:LISTEN &>/dev/null; then
    FRONT_ALIVE=1
  fi
fi

if [ "$AD_ALIVE" -eq 1 ] && [ "$FRONT_ALIVE" -eq 1 ]; then
  echo ""
  echo "ℹ️  Vibetube Ads services are already active!"
  "$SCRIPT_DIR/status.sh"
  echo "To restart services, run: ./scripts/stop.sh && ./scripts/start.sh"
  exit 0
fi

# If one service was orphaned or stale, clean it up before a fresh launch
if [ "$AD_ALIVE" -eq 1 ] || [ "$FRONT_ALIVE" -eq 1 ]; then
  "$SCRIPT_DIR/stop.sh" >/dev/null 2>&1 || true
fi

# 1. Resolve Google Cloud Project ID and Environment Variables for GCP
PROJECT_FILE="$HOME/project_id.txt"
DETECTED_PROJECT=""

if [ -n "${GCP_PROJECT_ID:-}" ] && [ "$GCP_PROJECT_ID" != "(unset)" ]; then
  DETECTED_PROJECT="$GCP_PROJECT_ID"
elif [ -f "$PROJECT_FILE" ] && [ -n "$(tr -d '[:space:]' < "$PROJECT_FILE" || true)" ]; then
  DETECTED_PROJECT="$(tr -d '[:space:]' < "$PROJECT_FILE")"
  echo "ℹ️  Found $PROJECT_FILE ($DETECTED_PROJECT), skipping project setup."
elif command -v gcloud &>/dev/null && [ -f "$SCRIPT_DIR/setup_project.sh" ]; then
  echo "ℹ️  $PROJECT_FILE not found. Running setup_project.sh..."
  if "$SCRIPT_DIR/setup_project.sh"; then
    if [ -f "$PROJECT_FILE" ]; then
      DETECTED_PROJECT="$(tr -d '[:space:]' < "$PROJECT_FILE" || true)"
    else
      DETECTED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
    fi
  fi
fi

if [ -z "$DETECTED_PROJECT" ] || [ "$DETECTED_PROJECT" = "(unset)" ]; then
  DETECTED_PROJECT="${GOOGLE_CLOUD_PROJECT:-${DEVSHELL_PROJECT_ID:-}}"
fi
if [ -z "$DETECTED_PROJECT" ] || [ "$DETECTED_PROJECT" = "(unset)" ]; then
  DETECTED_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
fi
if [ -z "$DETECTED_PROJECT" ] || [ "$DETECTED_PROJECT" = "(unset)" ]; then
  DETECTED_PROJECT="$(curl -s -f -m 1 -H "Metadata-Flavor: Google" http://metadata.google.internal/computeMetadata/v1/project/project-id 2>/dev/null || true)"
fi

# If still unset, attempt auto-discovery from gcloud projects list
if [ -z "$DETECTED_PROJECT" ] || [ "$DETECTED_PROJECT" = "(unset)" ]; then
  if command -v gcloud &>/dev/null; then
    FIRST_PROJECT="$(gcloud projects list --format='value(projectId)' --limit=1 2>/dev/null || true)"
    if [ -n "$FIRST_PROJECT" ] && [ "$FIRST_PROJECT" != "(unset)" ]; then
      DETECTED_PROJECT="$FIRST_PROJECT"
      gcloud config set project "$DETECTED_PROJECT" 2>/dev/null || true
      echo "ℹ️  Auto-detected active Google Cloud project: $DETECTED_PROJECT"
    fi
  fi
fi

if [ -z "$DETECTED_PROJECT" ] || [ "$DETECTED_PROJECT" = "(unset)" ]; then
  echo "❌ Error: No Google Cloud project is configured."
  echo ""
  echo "Please run project setup or configure your active project:"
  echo "  ./scripts/setup_project.sh"
  echo "  or: gcloud config set project <YOUR_PROJECT_ID>"
  exit 1
fi

export GCP_PROJECT_ID="$DETECTED_PROJECT"
export GOOGLE_CLOUD_PROJECT="$DETECTED_PROJECT"

# 1.5 Resolve Vibetube Event Code
EVENT_FILE="$HOME/vibetube_event.txt"
DETECTED_EVENT=""

if [ -f "$EVENT_FILE" ] && [ -n "$(tr -d '[:space:]' < "$EVENT_FILE" || true)" ]; then
  DETECTED_EVENT="$(tr -d '[:space:]' < "$EVENT_FILE")"
  echo "ℹ️  Found $EVENT_FILE ($DETECTED_EVENT)"
elif [ -n "${VIBETUBE_EVENT:-}" ]; then
  DETECTED_EVENT="$VIBETUBE_EVENT"
elif [ -t 0 ]; then
  read -r -p "  Enter Vibetube Event Code: " DETECTED_EVENT || DETECTED_EVENT=""
  DETECTED_EVENT="$(printf '%s' "$DETECTED_EVENT" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
fi

if [ -z "$DETECTED_EVENT" ]; then
  echo "❌ Error: Vibetube Event Code is required (not found in ~/vibetube_event.txt or environment)."
  echo "Please set VIBETUBE_EVENT or create ~/vibetube_event.txt with your event code."
  exit 1
fi

printf '%s\n' "$DETECTED_EVENT" > "$EVENT_FILE"
export VIBETUBE_EVENT="$DETECTED_EVENT"

# 2. Regional and Google Enterprise Agent Platform configuration
export GOOGLE_CLOUD_LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
export VERTEX_AI_LOCATION="${VERTEX_AI_LOCATION:-us-central1}"
export BQ_LOCATION="${BQ_LOCATION:-US}"

# 3. Gemini & Google Enterprise Agent Platform models
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-3.5-flash-lite}"
export GEMINI_IMAGE_MODEL="${GEMINI_IMAGE_MODEL:-gemini-3.1-flash-image}"
export GOOGLE_GENAI_USE_VERTEXAI="${GOOGLE_GENAI_USE_VERTEXAI:-true}"

# 4. BigQuery dataset, telemetry, and pubsub configuration
export BQ_DATASET_ID="${BQ_DATASET_ID:-vibetube_telemetry}"
export BQ_TABLE_ID="${BQ_TABLE_ID:-auction_events}"
export PUBSUB_TOPIC_ID="${PUBSUB_TOPIC_ID:-vibetube-ad-telemetry}"

# 5. Core service URLs and directories
export PORT="${PORT:-8080}"
export AD_SERVER_URL="${AD_SERVER_URL:-http://localhost:8080}"
export VIBETUBE_BACKEND_URL="${VIBETUBE_BACKEND_URL:-http://localhost:8000}"
export LAB_DIR="${LAB_DIR:-$ROOT_DIR/agentic_data_engineer}"

# 6. Ensure required Google Cloud APIs are enabled on GCP project
if command -v gcloud &>/dev/null && [ -n "$GOOGLE_CLOUD_PROJECT" ] && [ "$GOOGLE_CLOUD_PROJECT" != "vibeflix-sandbox" ]; then
  echo ""
  echo "Ensuring required Google Cloud APIs (Google Enterprise Agent Platform, BigQuery, Pub/Sub, Cloud AI Companion, Gemini Data Analytics) are enabled..."
  if ! gcloud services enable \
    aiplatform.googleapis.com \
    bigquery.googleapis.com \
    pubsub.googleapis.com \
    cloudaicompanion.googleapis.com \
    geminidataanalytics.googleapis.com \
    --project="$GOOGLE_CLOUD_PROJECT"; then
    echo "⚠️  Warning: Failed to enable required Google Cloud APIs on project '$GOOGLE_CLOUD_PROJECT'. Please check your IAM permissions."
  fi
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

# Ensure log and pid directories exist
mkdir -p "$ROOT_DIR/logs"
mkdir -p "$ROOT_DIR/.pids"

# 3. Pre-populate BigQuery telemetry in background if not already seeded
if command -v "$PYTHON_BIN" &>/dev/null; then
  echo ""
  echo "Starting BigQuery telemetry seeding in background (logs: logs/bigquery_init.log)..."
  nohup "$PYTHON_BIN" "$SCRIPT_DIR/init_bigquery.py" > "$ROOT_DIR/logs/bigquery_init.log" 2>&1 &
  BQ_INIT_PID=$!
  echo "$BQ_INIT_PID" > "$ROOT_DIR/.pids/bigquery_init.pid"
  disown "$BQ_INIT_PID" 2>/dev/null || true
fi

# 4. Ensure frontend dependencies are installed (specifically checking for vite binary)
if [ ! -f "$ROOT_DIR/ad_ops_workbench/node_modules/.bin/vite" ]; then
  echo ""
  echo "Installing frontend dependencies (including devDependencies)..."
  (cd "$ROOT_DIR/ad_ops_workbench" && npm install --include=dev)
fi

# 5. Build static production bundle so Ad Server can serve the UI directly on port 8080
if [ ! -d "$ROOT_DIR/ad_ops_workbench/dist" ]; then
  echo ""
  echo "Building frontend bundle for port 8080 serving..."
  (cd "$ROOT_DIR/ad_ops_workbench" && npm run build)
fi

echo ""
echo "Compiling Vibetube Ad Server..."
cd "$ROOT_DIR/ad_server"
go build -o vibetube-ad-server .

# Ensure port 8080 and 3000 are free of stale processes before launch
if command -v lsof &>/dev/null; then
  PORT_8080_PIDS=$(lsof -ti :8080 -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PORT_8080_PIDS" ]; then
    echo "⚠️  Port 8080 is in use. Stopping stale process..."
    for p in $PORT_8080_PIDS; do
      kill -9 "$p" 2>/dev/null || true
    done
    sleep 0.5
  fi
  PORT_3000_PIDS=$(lsof -ti :3000 -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PORT_3000_PIDS" ]; then
    echo "⚠️  Port 3000 is in use. Stopping stale process..."
    for p in $PORT_3000_PIDS; do
      kill -9 "$p" 2>/dev/null || true
    done
    sleep 0.5
  fi
fi

if [ "$FOREGROUND" -eq 1 ]; then
  echo "Starting Vibetube Ad Server (foreground mode)..."
  ./vibetube-ad-server &
  AD_SERVER_PID=$!
  echo "$AD_SERVER_PID" > "$ROOT_DIR/.pids/ad_server.pid"

  echo "Starting Ad Ops Workbench (foreground mode)..."
  cd "$ROOT_DIR/ad_ops_workbench"
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

  trap "echo ''; echo 'Shutting down Vibetube services...'; kill $AD_SERVER_PID $FRONTEND_PID $(cat "$ROOT_DIR/.pids/bigquery_init.pid" 2>/dev/null || true) 2>/dev/null; rm -f $ROOT_DIR/.pids/*.pid" EXIT
  wait
else
  echo "Starting Vibetube Ad Server on port 8080 in the background..."
  nohup ./vibetube-ad-server > "$ROOT_DIR/logs/ad_server.log" 2>&1 &
  AD_SERVER_PID=$!
  echo "$AD_SERVER_PID" > "$ROOT_DIR/.pids/ad_server.pid"

  echo "Starting Ad Ops Workbench on port 3000 in the background..."
  cd "$ROOT_DIR/ad_ops_workbench"
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
    echo "❌ Error: Ad Ops Workbench failed to start. Logs:"
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
  echo "     tail -f logs/bigquery_init.log"
  echo ""
  echo "  🛑 Stop Services:"
  echo "     ./scripts/stop.sh"
  echo "=================================================="
  echo ""
  echo "Your terminal prompt is ready. The helper site continues running in the background."
  echo ""
fi
