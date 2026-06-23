#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  # Check if /app/data exists and is not owned by the bun user (UID 1000)
  if [ -d "/app/data" ]; then
    if [ "$(stat -c '%u' /app/data)" != "1000" ]; then
      echo "Correcting permissions on /app/data..."
      chown -R bun:bun /app/data
    fi
  fi
  # Run the CMD as the bun user
  exec gosu bun "$@"
else
  # Run the CMD directly if already running as non-root
  exec "$@"
fi
