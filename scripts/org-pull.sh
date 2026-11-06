#!/usr/bin/env bash
# ==============================================================================
# Pull and synchronize all LocalMeProject repositories
# ==============================================================================
# When run in a freshly cloned localme repo, this script automatically detects
# missing sibling repositories, invokes the scaffolding bootstrapper to clone
# and restore them, and pulls the latest updates across all branches.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "$(basename "${ORCHESTRATOR_DIR}")" == "localme" ]; then
    ORG_ROOT="$(cd "${ORCHESTRATOR_DIR}/.." && pwd)"
else
    ORG_ROOT="${ORCHESTRATOR_DIR}"
fi

SIBLING_REPOS=("localme-examples" "localme-ios" "localme-android" "localme-js" "localme-flutter")
ALL_REPOS=("localme" "localme-examples" "localme-ios" "localme-android" "localme-js" "localme-flutter")

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${CYAN}        LocalMe Organization Pull & Synchronize                     ${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Org Directory: ${YELLOW}${ORG_ROOT}${NC}"
echo ""

# 1. Check if any sibling repositories are missing
MISSING=0
for repo in "${SIBLING_REPOS[@]}"; do
    if [ ! -d "${ORG_ROOT}/${repo}/.git" ]; then
        MISSING=1
        break
    fi
done

if [ "$MISSING" -eq 1 ]; then
    echo -e "${YELLOW}One or more organization repositories are not yet cloned.${NC}"
    echo -e "${CYAN}Running organization scaffolding & setup first...${NC}"
    bash "${SCRIPT_DIR}/org-setup.sh"
    echo ""
fi

# 2. Pull latest changes for each repository
echo -e "${BLUE}▶ Pulling latest updates across all organization repositories...${NC}"

for repo in "${ALL_REPOS[@]}"; do
    TARGET_DIR="${ORG_ROOT}/${repo}"
    if [ -d "${TARGET_DIR}/.git" ]; then
        echo -e "${CYAN}▶ Pulling ${YELLOW}${repo}${NC}..."
        CURRENT_BRANCH="$(git -C "${TARGET_DIR}" branch --show-current 2>/dev/null || echo '')"
        if [ -n "${CURRENT_BRANCH}" ]; then
            (cd "${TARGET_DIR}" && git pull --quiet origin "${CURRENT_BRANCH}") || true
            echo -e "  ${GREEN}✓ Updated ${repo} (${CURRENT_BRANCH})${NC}"
        else
            echo -e "  ${YELLOW}⚠ Skipped ${repo} (detached HEAD)${NC}"
        fi
    fi
done

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}    All organization repositories are synchronized and ready!      ${NC}"
echo -e "${GREEN}====================================================================${NC}"
