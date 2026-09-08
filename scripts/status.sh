#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=================================================="
echo "  📊 Vibetube Ads Service Status"
echo "=================================================="

AD_SERVER_RUNNING=0
FRONTEND_RUNNING=0

# Check Ad Server
if [ -f "$ROOT_DIR/.pids/ad_server.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/ad_server.pid" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "  ✓ Ad Server            : RUNNING (PID: $PID, Port: 8080)"
    AD_SERVER_RUNNING=1
  fi
fi

if [ "$AD_SERVER_RUNNING" -eq 0 ]; then
  if command -v lsof &>/dev/null; then
    PID=$(lsof -ti :8080 2>/dev/null | head -n 1 || true)
    if [ -n "$PID" ]; then
      echo "  ✓ Ad Server            : RUNNING (PID: $PID, Port: 8080)"
      AD_SERVER_RUNNING=1
    fi
  fi
fi

if [ "$AD_SERVER_RUNNING" -eq 0 ]; then
  echo "  ✗ Ad Server            : STOPPED"
fi

# Check Frontend
if [ -f "$ROOT_DIR/.pids/frontend.pid" ]; then
  PID=$(cat "$ROOT_DIR/.pids/frontend.pid" 2>/dev/null || true)
  if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
    echo "  ✓ Ad Ops Control Center: RUNNING (PID: $PID, Port: 3000)"
    FRONTEND_RUNNING=1
  fi
fi

if [ "$FRONTEND_RUNNING" -eq 0 ]; then
  if command -v lsof &>/dev/null; then
    PID=$(lsof -ti :3000 2>/dev/null | head -n 1 || true)
    if [ -n "$PID" ]; then
      echo "  ✓ Ad Ops Control Center: RUNNING (PID: $PID, Port: 3000)"
      FRONTEND_RUNNING=1
    fi
  fi
fi

if [ "$FRONTEND_RUNNING" -eq 0 ]; then
  echo "  ✗ Ad Ops Control Center: STOPPED"
fi

echo "=================================================="
if [ "$AD_SERVER_RUNNING" -eq 1 ] && [ "$FRONTEND_RUNNING" -eq 1 ]; then
  echo "  👉 Local Browser: http://localhost:3000"
  echo "  👉 Cloud Shell  : Web Preview on port 3000 (or 8080)"
fi
echo ""
