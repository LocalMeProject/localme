#!/usr/bin/env bash
# ==============================================================================
# Start local development servers across the LocalMe platform
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "$(basename "${ORCHESTRATOR_DIR}")" == "localme" ]; then
    ORG_ROOT="$(cd "${ORCHESTRATOR_DIR}/.." && pwd)"
else
    ORG_ROOT="${ORCHESTRATOR_DIR}"
fi

TARGET="${1:-server}"

case "${TARGET}" in
    server|backend)
        echo "🚀 Starting LocalMe .NET 10 Engine & Server..."
        cd "${ORCHESTRATOR_DIR}"
        dotnet run --project apps/server/src/LocalMe.Server.csproj
        ;;
    console|web|frontend)
        echo "🚀 Starting LocalMe Web Console (React / Vite)..."
        cd "${ORCHESTRATOR_DIR}"
        npx nx dev web-console
        ;;
    *)
        echo "Usage: $0 [server|console]"
        exit 1
        ;;
esac
