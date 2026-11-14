#!/usr/bin/env bash
set -e

echo "[postgres-shard] Starting socat port forwarders (3000 -> 5432 and 80 -> 5432)..."
while true; do
  socat TCP-LISTEN:3000,fork,reuseaddr TCP:127.0.0.1:5432 2>/dev/null || true
  sleep 1
done &

while true; do
  socat TCP-LISTEN:80,fork,reuseaddr TCP:127.0.0.1:5432 2>/dev/null || true
  sleep 1
done &

echo "[postgres-shard] Handing off to official docker-entrypoint.sh..."
exec docker-entrypoint.sh postgres "$@"
