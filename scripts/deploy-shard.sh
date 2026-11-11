#!/usr/bin/env bash
# ==============================================================================
# LocalMe Generic Database Shard Deployment Entrypoint
# Currently configured for: Runflare Cloud
# Future target: AbrArvan Cloud VPS / DBaaS / Private VPC
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="${1:-runflare}"

case "${TARGET}" in
  runflare)
    echo "▶ Invoking Runflare Shard Deployment Engine..."
    exec bash "${SCRIPT_DIR}/deploy-shard-runflare.sh"
    ;;
  arvan|abrarvan)
    echo "ℹ️ AbrArvan VPS/DBaaS migration target is reserved for upcoming infrastructure rollout."
    echo "   Currently active deployment target is: Runflare"
    echo "   Running Runflare deployment..."
    exec bash "${SCRIPT_DIR}/deploy-shard-runflare.sh"
    ;;
  *)
    echo "Usage: $0 [runflare|arvan]"
    exit 1
    ;;
esac
