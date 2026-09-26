#!/bin/sh
set -e

if [ "$(id -u)" = "0" ]; then
  # Ensure the bun user has permissions to access mounted GPU and accelerator devices
  # (/dev/dri/* for VA-API/QSV, /dev/rga, /dev/mpp_service, /dev/dma_heap/* for RKMPP, /dev/dxg for WSL2)
  for dev in /dev/dri/* /dev/rga /dev/mpp_service /dev/dma_heap/* /dev/dxg; do
    if [ -e "$dev" ]; then
      gid=$(stat -c '%g' "$dev" 2>/dev/null || true)
      if [ -n "$gid" ] && [ "$gid" != "0" ]; then
        if ! getent group "$gid" >/dev/null 2>&1; then
          groupadd -g "$gid" "hwaccel_group_$gid" 2>/dev/null || true
        fi
        usermod -a -G "$gid" bun 2>/dev/null || true
      fi
    fi
  done

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
