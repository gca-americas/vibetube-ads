#!/bin/bash
set -e

echo "Starting Vibetube Ad Server..."
cd "$(dirname "$0")/../ad_server"
go build -o vibetube-ad-server
./vibetube-ad-server &
AD_SERVER_PID=$!

echo "Starting Ad Ops Control Center (Frontend)..."
cd ../ad_ops_control_center/frontend
npm run dev &
FRONTEND_PID=$!

# Trap Ctrl+C (SIGINT) to kill background processes
trap "echo 'Shutting down...'; kill $AD_SERVER_PID $FRONTEND_PID" EXIT

# Wait for background jobs to finish
wait
