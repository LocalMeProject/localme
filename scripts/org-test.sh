#!/usr/bin/env bash
# ==============================================================================
# Run automated tests across LocalMeProject organization
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORCHESTRATOR_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [ "$(basename "${ORCHESTRATOR_DIR}")" == "localme" ]; then
    ORG_ROOT="$(cd "${ORCHESTRATOR_DIR}/.." && pwd)"
else
    ORG_ROOT="${ORCHESTRATOR_DIR}"
fi

TARGET="${1:-all}"
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

test_localme() {
    echo -e "${CYAN}🧪 Testing localme backend (.NET 10 test suite)...${NC}"
    dotnet test "${ORCHESTRATOR_DIR}/LocalMe.sln" -c Release --verbosity quiet
    echo -e "  ${GREEN}✓ localme .NET tests passed${NC}"

    if [ -d "${ORCHESTRATOR_DIR}/apps/web-console" ]; then
        echo -e "${CYAN}🧪 Testing localme web console (Vitest)...${NC}"
        (cd "${ORCHESTRATOR_DIR}" && npx nx test web-console)
        echo -e "  ${GREEN}✓ web-console tests passed${NC}"
    fi
}

test_js() {
    echo -e "${CYAN}🧪 Testing localme-js SDK...${NC}"
    JS_DIR="${ORG_ROOT}/localme-js"
    if [ -f "${JS_DIR}/package.json" ] && grep -q '"test"' "${JS_DIR}/package.json"; then
        (cd "${JS_DIR}" && pnpm test)
        echo -e "  ${GREEN}✓ localme-js tests passed${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-js: test suite not configured yet${NC}"
    fi
}

test_android() {
    echo -e "${CYAN}🧪 Testing localme-android SDK...${NC}"
    ANDROID_DIR="${ORG_ROOT}/localme-android"
    if [ -f "${ANDROID_DIR}/gradlew" ]; then
        (cd "${ANDROID_DIR}" && ./gradlew test)
        echo -e "  ${GREEN}✓ localme-android tests passed${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-android: test suite not configured yet${NC}"
    fi
}

test_flutter() {
    echo -e "${CYAN}🧪 Testing localme-flutter SDK...${NC}"
    FLUTTER_DIR="${ORG_ROOT}/localme-flutter"
    if [ -f "${FLUTTER_DIR}/pubspec.yaml" ] && command -v flutter &>/dev/null; then
        (cd "${FLUTTER_DIR}" && flutter test)
        echo -e "  ${GREEN}✓ localme-flutter tests passed${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-flutter: test suite not configured yet${NC}"
    fi
}

test_ios() {
    echo -e "${CYAN}🧪 Testing localme-ios SDK...${NC}"
    IOS_DIR="${ORG_ROOT}/localme-ios"
    if [ -f "${IOS_DIR}/Package.swift" ] && command -v swift &>/dev/null; then
        (cd "${IOS_DIR}" && swift test)
        echo -e "  ${GREEN}✓ localme-ios tests passed${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-ios: test suite not configured yet${NC}"
    fi
}

test_examples() {
    echo -e "${CYAN}🧪 Testing localme-examples...${NC}"
    EXAMPLES_DIR="${ORG_ROOT}/localme-examples"
    if [ -f "${EXAMPLES_DIR}/package.json" ] && grep -q '"test"' "${EXAMPLES_DIR}/package.json"; then
        (cd "${EXAMPLES_DIR}" && pnpm test)
        echo -e "  ${GREEN}✓ localme-examples tests passed${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-examples: test suite not configured yet${NC}"
    fi
}

case "${TARGET}" in
    localme|platform|server|console)
        test_localme
        ;;
    js)
        test_js
        ;;
    android)
        test_android
        ;;
    flutter)
        test_flutter
        ;;
    ios)
        test_ios
        ;;
    examples)
        test_examples
        ;;
    all)
        echo -e "${BLUE}====================================================================${NC}"
        echo -e "${CYAN}    Running all automated test suites across LocalMe organization   ${NC}"
        echo -e "${BLUE}====================================================================${NC}"
        test_localme
        test_js
        test_android
        test_ios
        test_flutter
        test_examples
        echo -e "${GREEN}====================================================================${NC}"
        echo -e "${GREEN}    All LocalMe organization tests passed!                          ${NC}"
        echo -e "${GREEN}====================================================================${NC}"
        ;;
    *)
        echo "Usage: $0 [all|localme|js|android|ios|flutter|examples]"
        exit 1
        ;;
esac
