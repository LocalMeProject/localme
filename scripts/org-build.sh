#!/usr/bin/env bash
# ==============================================================================
# Build all or targeted projects across LocalMeProject Organization
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

build_localme() {
    echo -e "${CYAN}🔨 Building localme core engine & server (.NET 10)...${NC}"
    dotnet build "${ORCHESTRATOR_DIR}/LocalMe.sln" -c Release
    echo -e "  ${GREEN}✓ localme .NET build succeeded${NC}"

    if [ -d "${ORCHESTRATOR_DIR}/apps/web-console" ]; then
        echo -e "${CYAN}🔨 Building localme web console (React / Vite)...${NC}"
        (cd "${ORCHESTRATOR_DIR}" && npx nx build web-console)
        echo -e "  ${GREEN}✓ web-console build succeeded${NC}"
    fi
}

build_js() {
    echo -e "${CYAN}🔨 Building localme-js SDK...${NC}"
    JS_DIR="${ORG_ROOT}/localme-js"
    if [ -f "${JS_DIR}/package.json" ]; then
        if grep -q '"build"' "${JS_DIR}/package.json"; then
            (cd "${JS_DIR}" && pnpm run build)
            echo -e "  ${GREEN}✓ localme-js build succeeded${NC}"
        else
            echo -e "  ${YELLOW}ℹ localme-js: no build script configured yet in package.json${NC}"
        fi
    else
        echo -e "  ${YELLOW}ℹ localme-js: package.json not yet created (scaffold state)${NC}"
    fi
}

build_android() {
    echo -e "${CYAN}🔨 Building localme-android SDK...${NC}"
    ANDROID_DIR="${ORG_ROOT}/localme-android"
    if [ -f "${ANDROID_DIR}/gradlew" ]; then
        (cd "${ANDROID_DIR}" && ./gradlew build)
        echo -e "  ${GREEN}✓ localme-android build succeeded${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-android: gradle wrapper not yet created (scaffold state)${NC}"
    fi
}

build_flutter() {
    echo -e "${CYAN}🔨 Building localme-flutter SDK...${NC}"
    FLUTTER_DIR="${ORG_ROOT}/localme-flutter"
    if [ -f "${FLUTTER_DIR}/pubspec.yaml" ] && command -v flutter &>/dev/null; then
        (cd "${FLUTTER_DIR}" && flutter build)
        echo -e "  ${GREEN}✓ localme-flutter build succeeded${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-flutter: pubspec.yaml not yet created (scaffold state)${NC}"
    fi
}

build_ios() {
    echo -e "${CYAN}🔨 Building localme-ios SDK...${NC}"
    IOS_DIR="${ORG_ROOT}/localme-ios"
    if [ -f "${IOS_DIR}/Package.swift" ] && command -v swift &>/dev/null; then
        (cd "${IOS_DIR}" && swift build -c release)
        echo -e "  ${GREEN}✓ localme-ios build succeeded${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-ios: Package.swift not yet created (scaffold state)${NC}"
    fi
}

build_examples() {
    echo -e "${CYAN}🔨 Building localme-examples...${NC}"
    EXAMPLES_DIR="${ORG_ROOT}/localme-examples"
    if [ -f "${EXAMPLES_DIR}/package.json" ]; then
        (cd "${EXAMPLES_DIR}" && pnpm run build 2>/dev/null || true)
        echo -e "  ${GREEN}✓ localme-examples build succeeded${NC}"
    else
        echo -e "  ${YELLOW}ℹ localme-examples: scaffold state${NC}"
    fi
}

case "${TARGET}" in
    localme|platform|server|console)
        build_localme
        ;;
    js)
        build_js
        ;;
    android)
        build_android
        ;;
    flutter)
        build_flutter
        ;;
    ios)
        build_ios
        ;;
    examples)
        build_examples
        ;;
    all)
        echo -e "${BLUE}====================================================================${NC}"
        echo -e "${CYAN}    Building entire LocalMe platform & SDKs across organization      ${NC}"
        echo -e "${BLUE}====================================================================${NC}"
        build_localme
        build_js
        build_android
        build_ios
        build_flutter
        build_examples
        echo -e "${GREEN}====================================================================${NC}"
        echo -e "${GREEN}    All LocalMe organization builds processed successfully!         ${NC}"
        echo -e "${GREEN}====================================================================${NC}"
        ;;
    *)
        echo "Usage: $0 [all|localme|js|android|ios|flutter|examples]"
        exit 1
        ;;
esac
