#!/usr/bin/env bash
# ==============================================================================
# LocalMeProject Organization Scaffolding & Setup Script
# ==============================================================================
# Automatically detects the organization root directory, clones missing
# repositories from @LocalMeProject, configures promotion branches, and
# restores dependencies across all projects.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Detect Organization root (parent of orchestrator repo)
if [ "$(basename "${ORCHESTRATOR_DIR}")" == "localme" ]; then
    ORG_ROOT="$(cd "${ORCHESTRATOR_DIR}/.." && pwd)"
else
    ORG_ROOT="${ORCHESTRATOR_DIR}"
fi

ORG_NAME="LocalMeProject"
SIBLING_REPOS=("localme-examples" "localme-ios" "localme-android" "localme-js" "localme-flutter")
ALL_REPOS=("localme" "localme-examples" "localme-ios" "localme-android" "localme-js" "localme-flutter")
BRANCHES=("main" "test" "stage" "prod")

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${CYAN}        LocalMe Organization Bootstrap & Scaffolding                ${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Org Directory: ${YELLOW}${ORG_ROOT}${NC}"
echo -e "Orchestrator:  ${YELLOW}${ORCHESTRATOR_DIR}${NC}"
echo ""

# Ensure git credentials or gh CLI are available
CLONE_PREFIX="https://github.com/${ORG_NAME}"
if command -v gh &>/dev/null; then
    gh auth setup-git &>/dev/null || true
    TOKEN="$(gh auth token 2>/dev/null || true)"
    if [ -n "${TOKEN}" ]; then
        CLONE_AUTH_PREFIX="https://x-access-token:${TOKEN}@github.com/${ORG_NAME}"
    else
        CLONE_AUTH_PREFIX="${CLONE_PREFIX}"
    fi
else
    CLONE_AUTH_PREFIX="${CLONE_PREFIX}"
fi

# Clone and configure each sibling repository
for repo in "${SIBLING_REPOS[@]}"; do
    TARGET_DIR="${ORG_ROOT}/${repo}"
    REMOTE_URL="${CLONE_PREFIX}/${repo}.git"
    AUTH_REMOTE_URL="${CLONE_AUTH_PREFIX}/${repo}.git"

    echo -e "${CYAN}▶ Processing repository: ${YELLOW}${repo}${NC}"

    if [ -d "${TARGET_DIR}/.git" ]; then
        echo -e "  ${GREEN}✓ Already cloned at ${TARGET_DIR}${NC}"
    else
        echo -e "  Cloning ${REMOTE_URL} into ${TARGET_DIR}..."
        git clone "${AUTH_REMOTE_URL}" "${TARGET_DIR}"
        # Ensure remote URL is stored without tokens
        (cd "${TARGET_DIR}" && git remote set-url origin "${REMOTE_URL}")
        echo -e "  ${GREEN}✓ Cloned successfully${NC}"
    fi

    # Configure local tracking for promotion branches
    cd "${TARGET_DIR}"
    git fetch origin --quiet 2>/dev/null || true
    for branch in "${BRANCHES[@]}"; do
        if ! git show-ref --verify --quiet "refs/heads/${branch}"; then
            if git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
                git branch --track "${branch}" "origin/${branch}" --quiet 2>/dev/null || true
            fi
        fi
    done
    git checkout main --quiet 2>/dev/null || true
done

echo ""
echo -e "${CYAN}▶ Restoring project dependencies across organization...${NC}"

# Restore LocalMe Platform (.NET 10 Solution + Web Console)
if [ -f "${ORCHESTRATOR_DIR}/LocalMe.sln" ]; then
    echo -e "  Restoring ${YELLOW}localme (LocalMe.sln)${NC}..."
    (cd "${ORCHESTRATOR_DIR}" && dotnet restore LocalMe.sln --verbosity quiet)
    echo -e "  ${GREEN}✓ localme .NET dependencies restored${NC}"
fi

if [ -f "${ORCHESTRATOR_DIR}/pnpm-lock.yaml" ] && command -v pnpm &>/dev/null; then
    echo -e "  Installing ${YELLOW}localme frontend dependencies (pnpm)${NC}..."
    (cd "${ORCHESTRATOR_DIR}" && pnpm install --frozen-lockfile --silent 2>/dev/null || pnpm install --silent)
    echo -e "  ${GREEN}✓ localme frontend dependencies installed${NC}"
fi

# Restore JS SDK
if [ -d "${ORG_ROOT}/localme-js" ] && [ -f "${ORG_ROOT}/localme-js/package.json" ]; then
    echo -e "  Restoring ${YELLOW}localme-js${NC}..."
    if command -v pnpm &>/dev/null; then
        (cd "${ORG_ROOT}/localme-js" && pnpm install --silent)
    elif command -v npm &>/dev/null; then
        (cd "${ORG_ROOT}/localme-js" && npm install --silent)
    fi
    echo -e "  ${GREEN}✓ localme-js restored${NC}"
fi

# Restore Flutter SDK
if [ -d "${ORG_ROOT}/localme-flutter" ] && [ -f "${ORG_ROOT}/localme-flutter/pubspec.yaml" ] && command -v flutter &>/dev/null; then
    echo -e "  Restoring ${YELLOW}localme-flutter${NC}..."
    (cd "${ORG_ROOT}/localme-flutter" && flutter pub get)
    echo -e "  ${GREEN}✓ localme-flutter restored${NC}"
fi

# Make all org scripts executable
chmod +x "${SCRIPT_DIR}"/org-*.sh 2>/dev/null || true

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}    Organization Bootstrap Complete! Codebase is ready to build.    ${NC}"
echo -e "${GREEN}====================================================================${NC}"
