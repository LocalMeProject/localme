#!/usr/bin/env bash
# ==============================================================================
# Check git and health status across all LocalMeProject repositories
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "$(basename "${ORCHESTRATOR_DIR}")" == "localme" ]; then
    ORG_ROOT="$(cd "${ORCHESTRATOR_DIR}/.." && pwd)"
else
    ORG_ROOT="${ORCHESTRATOR_DIR}"
fi

REPOS=("localme" "localme-examples" "localme-ios" "localme-android" "localme-js" "localme-flutter")

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${CYAN}             LocalMe Organization Status                            ${NC}"
echo -e "${BLUE}====================================================================${NC}"
printf "%-18s %-12s %-14s %-40s\n" "REPOSITORY" "BRANCH" "STATUS" "LATEST COMMIT"
echo "--------------------------------------------------------------------"

for repo in "${REPOS[@]}"; do
    TARGET_DIR="${ORG_ROOT}/${repo}"
    if [ -d "${TARGET_DIR}/.git" ]; then
        cd "${TARGET_DIR}"
        BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
        DIRTY="$(git status --porcelain | wc -l)"
        if [ "$DIRTY" -eq 0 ]; then
            STATUS="${GREEN}clean${NC}"
        else
            STATUS="${YELLOW}modified (${DIRTY})${NC}"
        fi
        COMMIT="$(git log -n 1 --oneline 2>/dev/null || echo 'none')"
        printf "%-18s %-12s %-22b %-40s\n" "${repo}" "${BRANCH}" "${STATUS}" "${COMMIT:0:40}"
    else
        printf "%-18s %-12s %-22b %-40s\n" "${repo}" "-" "${RED}missing${NC}" "-"
    fi
done
echo "--------------------------------------------------------------------"
