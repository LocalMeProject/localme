#!/usr/bin/env bash
# ==============================================================================
# LocalMe Generic Provider-Agnostic Deployment Runner
# Supports AbrArvan Cloud, GHCR, Docker Hub, and any Linux VPS/Docker host.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-latest}"
REGISTRY="${REGISTRY:-docker.arvancloud.ir/localme}"
IMAGE_NAME="${IMAGE_NAME:-localme-platform}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

CONTAINER_CLI="$(command -v podman || command -v docker || true)"
if [ -z "${CONTAINER_CLI}" ]; then
  echo "❌ Error: Neither podman nor docker found on system PATH."
  exit 1
fi

echo "=========================================================="
echo "   LocalMe Provider-Agnostic Deployment Engine            "
echo "   Container Engine: ${CONTAINER_CLI}                     "
echo "   Target Image: ${FULL_IMAGE}                            "
echo "=========================================================="

usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  --build          Build multi-stage OCI container image"
  echo "  --push           Push image to container registry (${REGISTRY})"
  echo "  --deploy-vps     Deploy to remote VPS over SSH (requires VPS_HOST and VPS_USER)"
  echo "  --run-local      Run locally via docker-compose.prod.yml"
  echo "  --all            Build, push, and deploy"
  exit 0
}

ACTION="${1:---build}"

do_build() {
  echo "⚛️ 1. Compiling web-console (React + Vite)..."
  pnpm -C apps/web-console build
  cp apps/web-console/dist/index.html apps/server/src/wwwroot/panel.html
  mkdir -p apps/server/src/wwwroot/assets
  cp -r apps/web-console/dist/assets/* apps/server/src/wwwroot/assets/

  echo "🔨 2. Compiling and publishing .NET 10 host..."
  dotnet publish apps/server/src/LocalMe.Server.csproj -c Release -o dist/server
  rm -f dist/server/*.pdb 2>/dev/null || true

  echo "📦 3. Building lean production image (${FULL_IMAGE})..."
  ${CONTAINER_CLI} build -t "${FULL_IMAGE}" -f Dockerfile .
  echo "✅ Image built successfully: ${FULL_IMAGE}"
}

do_push() {
  echo "🚀 Pushing image to registry: ${FULL_IMAGE}..."
  ${CONTAINER_CLI} push "${FULL_IMAGE}"
  echo "✅ Image pushed successfully."
}

do_run_local() {
  echo "🐳 Launching LocalMe production cluster locally..."
  LOCALME_IMAGE="${FULL_IMAGE}" docker compose -f docker-compose.prod.yml up -d
  echo "✅ LocalMe cluster running on http://localhost:${PORT:-3000}"
}

do_deploy_vps() {
  VPS_HOST="${VPS_HOST:-}"
  VPS_USER="${VPS_USER:-root}"
  if [ -z "${VPS_HOST}" ]; then
    echo "❌ Error: VPS_HOST environment variable is required for remote deployment."
    exit 1
  fi

  echo "🌐 Deploying to remote VPS: ${VPS_USER}@${VPS_HOST}..."
  ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p /opt/localme"
  scp docker-compose.prod.yml "${VPS_USER}@${VPS_HOST}:/opt/localme/"
  ssh "${VPS_USER}@${VPS_HOST}" "cd /opt/localme && LOCALME_IMAGE='${FULL_IMAGE}' docker compose -f docker-compose.prod.yml pull && LOCALME_IMAGE='${FULL_IMAGE}' docker compose -f docker-compose.prod.yml up -d"
  echo "✅ Deployment on ${VPS_HOST} completed successfully!"
}

case "${ACTION}" in
  --build)
    do_build
    ;;
  --push)
    do_push
    ;;
  --run-local)
    do_run_local
    ;;
  --deploy-vps)
    do_deploy_vps
    ;;
  --all)
    do_build
    do_push
    do_deploy_vps
    ;;
  -h|--help)
    usage
    ;;
  *)
    echo "Unknown option: ${ACTION}"
    usage
    ;;
esac
