#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

PORT="${1:-4173}"

echo
echo "Starting Card Scanner App preview server..."
echo "Open: http://localhost:$PORT"
echo "Press Ctrl+C to stop."
echo

python3 -m http.server "$PORT"
