#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Stopping Vibetube Ads background services..."

STOPPED=0

# 1. Stop Ad Server via PID file
if [ -f "$ROOT_DIR/.pids/ad_server.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/ad_server.pid" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "  ✓ Stopped Ad Server (PID: $PID)"
    STOPPED=1
  fi
  rm -f "$ROOT_DIR/.pids/ad_server.pid"
fi

# 2. Stop Frontend via PID file
if [ -f "$ROOT_DIR/.pids/frontend.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/frontend.pid" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    echo "  ✓ Stopped Ad Ops Control Center (PID: $PID)"
    STOPPED=1
  fi
  rm -f "$ROOT_DIR/.pids/frontend.pid"
fi

# 3. Fallback: kill any processes listening on port 8080 or 3000 matching Vibetube
if command -v lsof &>/dev/null; then
  PORT_8080_PIDS=$(lsof -ti :8080 2>/dev/null || true)
  if [ -n "$PORT_8080_PIDS" ]; then
    for p in $PORT_8080_PIDS; do
      CMD=$(ps -p "$p" -o comm= 2>/dev/null || true)
      if [[ "$CMD" == *"vibetube"* || "$CMD" == *"ad-server"* ]]; then
        kill "$p" 2>/dev/null || true
        echo "  ✓ Stopped Ad Server on port 8080 (PID: $p)"
        STOPPED=1
      fi
    done
  fi

  PORT_3000_PIDS=$(lsof -ti :3000 2>/dev/null || true)
  if [ -n "$PORT_3000_PIDS" ]; then
    for p in $PORT_3000_PIDS; do
      CMD=$(ps -p "$p" -o command= 2>/dev/null || true)
      if [[ "$CMD" == *"vite"* || "$CMD" == *"ad_ops_control_center"* ]]; then
        kill "$p" 2>/dev/null || true
        echo "  ✓ Stopped Ad Ops Control Center on port 3000 (PID: $p)"
        STOPPED=1
      fi
    done
  fi
fi

# 4. Fallback by binary name
pkill -f "vibetube-ad-server" 2>/dev/null && STOPPED=1 || true

if [ "$STOPPED" -eq 1 ]; then
  echo "All Vibetube Ads services have been stopped."
else
  echo "No active Vibetube Ads services were detected."
fi
