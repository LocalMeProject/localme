#!/usr/bin/env bash
# ==============================================================================
# Synchronize promotion branches across LocalMeProject repositories
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
BRANCHES=("main" "test" "stage" "prod")

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${CYAN}    Synchronizing Promotion Branches across LocalMe Organization    ${NC}"
echo -e "${BLUE}====================================================================${NC}"

for repo in "${REPOS[@]}"; do
    TARGET_DIR="${ORG_ROOT}/${repo}"
    if [ -d "${TARGET_DIR}/.git" ]; then
        echo -e "${CYAN}▶ Checking ${YELLOW}${repo}${NC}..."
        (
            cd "${TARGET_DIR}"
            git fetch origin --quiet || true
            for branch in "${BRANCHES[@]}"; do
                if git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
                    if git show-ref --verify --quiet "refs/heads/${branch}"; then
                        git branch --set-upstream-to="origin/${branch}" "${branch}" --quiet 2>/dev/null || true
                    else
                        git branch --track "${branch}" "origin/${branch}" --quiet 2>/dev/null || true
                    fi
                fi
            done
        )
        echo -e "  ${GREEN}✓ ${repo} branches synchronized with origin${NC}"
    fi
done

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}    Branch synchronization completed successfully!                 ${NC}"
echo -e "${GREEN}====================================================================${NC}"
