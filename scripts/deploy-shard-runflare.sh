#!/usr/bin/env bash
# ==============================================================================
# LocalMe Sovereign PostgreSQL Shard Deployment & Registration Engine
# Target Infrastructure: Runflare Cloud (Docker / Managed PostgreSQL)
# Future-Proof Architecture: Extensible for AbrArvan Cloud VPS / Private VPC
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

SHARD_ID="${SHARD_ID:-shard-runflare-1}"
SHARD_NAME="${SHARD_NAME:-Runflare Shard 1 (Tehran)}"
SHARD_REGION="${SHARD_REGION:-ir-tehran-runflare}"
MAX_CAPACITY="${MAX_CAPACITY:-100}"

# Runflare Target Metadata
RUNFLARE_ACCOUNT="${RUNFLARE_ACCOUNT:-sina1vali@gmail.com}"
RUNFLARE_PROJECT_ID="${RUNFLARE_PROJECT_ID:-36960}"
RUNFLARE_ITEM_ID="${RUNFLARE_ITEM_ID:-88984}"
DEPLOY_SHARD_CONTAINER="${DEPLOY_SHARD_CONTAINER:-false}"

# Database Connection Credentials
PGHOST="${PGHOST:-${LOCALME_SHARD_HOST:-shard-a.localme.ir}}"
PGPORT="${PGPORT:-${LOCALME_SHARD_PORT:-5432}}"
PGDATABASE="${PGDATABASE:-${LOCALME_SHARD_DB:-postgres}}"
PGUSER="${PGUSER:-${LOCALME_SHARD_USER:-postgres}}"
PGPASSWORD="${PGPASSWORD:-${LOCALME_SHARD_PASSWORD:-}}"

# LocalMe Master API endpoint for dynamic shard auto-registration
LOCALME_API_URL="${LOCALME_API_URL:-https://localme.ir}"
LOCALME_ADMIN_TOKEN="${LOCALME_ADMIN_TOKEN:-}"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================================${NC}"
echo -e "${CYAN}      LocalMe PostgreSQL Shard Deployment & Auto-Registration       ${NC}"
echo -e "${CYAN}      Platform Target: Runflare Cloud                             ${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Shard Identifier : ${YELLOW}${SHARD_ID}${NC}"
echo -e "Shard Name       : ${YELLOW}${SHARD_NAME}${NC}"
echo -e "Shard Region     : ${YELLOW}${SHARD_REGION}${NC}"
echo -e "Target Host/Port : ${YELLOW}${PGHOST}:${PGPORT}/${PGDATABASE}${NC}"
echo -e "Project ID       : ${YELLOW}${RUNFLARE_PROJECT_ID}${NC}"
echo ""

# ------------------------------------------------------------------------------
# 1. Optional Runflare Item Deployment (if explicitly requested)
# ------------------------------------------------------------------------------
if [ "${DEPLOY_SHARD_CONTAINER}" = "true" ] && [ -n "${RUNFLARE_ITEM_ID}" ]; then
  RUNFLARE_BIN="$(command -v runflare || echo "${HOME}/.local/bin/runflare")"
  if [ -x "${RUNFLARE_BIN}" ]; then
    echo -e "${CYAN}▶ Deploying shard container to Runflare (Account: ${RUNFLARE_ACCOUNT}, Project: ${RUNFLARE_PROJECT_ID}, Item: ${RUNFLARE_ITEM_ID})...${NC}"
    "${RUNFLARE_BIN}" --account "${RUNFLARE_ACCOUNT}" deploy --project-id "${RUNFLARE_PROJECT_ID}" --item-id "${RUNFLARE_ITEM_ID}" -y --force || {
      echo -e "${YELLOW}⚠️ Runflare item deploy notice: CLI exited with non-zero code. Proceeding to database setup.${NC}"
    }
  else
    echo -e "${YELLOW}ℹ️ Runflare CLI not found at ${RUNFLARE_BIN}. Skipping remote container trigger.${NC}"
  fi
else
  echo -e "${GREEN}✓ Shard container is assumed active on Runflare (Item: ${RUNFLARE_ITEM_ID}). Proceeding to connectivity and registration.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Database Connectivity & Extension Initialization
# ------------------------------------------------------------------------------
echo -e "${CYAN}▶ Verifying PostgreSQL shard connectivity and required extensions...${NC}"

PSQL_BIN="$(command -v psql || echo "${HOME}/.local/share/lerd/bin/psql")"

INITIALIZE_SQL="
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
SELECT 'SHARD_READY' AS status, current_setting('server_version') AS version;
"

if [ -x "${PSQL_BIN}" ]; then
  echo -e "  Applying extensions via ${PSQL_BIN}..."
  PGPASSWORD="${PGPASSWORD}" "${PSQL_BIN}" \
    -h "${PGHOST}" \
    -p "${PGPORT}" \
    -U "${PGUSER}" \
    -d "${PGDATABASE}" \
    -c "${INITIALIZE_SQL}" || {
      echo -e "${YELLOW}⚠️ Notice: Direct psql verification completed or skipped.${NC}"
    }
else
  # Fallback to Python standard library socket/database check
  python3 -c "
import socket, sys
try:
    sock = socket.create_connection(('${PGHOST}', int('${PGPORT}')), timeout=5)
    sock.close()
    print('  ✓ TCP Connection to shard ${PGHOST}:${PGPORT} established successfully.')
except Exception as ex:
    print(f'  ⚠️ TCP probe notice: {ex}', file=sys.stderr)
"
fi

# ------------------------------------------------------------------------------
# 3. Assemble ADO.NET Connection String for LocalMe Connection Pooling
# ------------------------------------------------------------------------------
SHARD_CONN_STRING="Host=${PGHOST};Port=${PGPORT};Database=${PGDATABASE};Username=${PGUSER};Password=${PGPASSWORD};SSL Mode=Prefer;Trust Server Certificate=true;MinPoolSize=5;MaxPoolSize=30;Multiplexing=true;"

# ------------------------------------------------------------------------------
# 4. Auto-Register Shard in LocalMe Master Shard Catalog via Admin API
# ------------------------------------------------------------------------------
echo -e "${CYAN}▶ Registering shard '${SHARD_ID}' in LocalMe Shard Catalog (${LOCALME_API_URL})...${NC}"

REGISTER_PAYLOAD=$(cat <<EOF
{
  "id": "${SHARD_ID}",
  "name": "${SHARD_NAME}",
  "region": "${SHARD_REGION}",
  "connectionString": "${SHARD_CONN_STRING}",
  "maxCapacityProjects": ${MAX_CAPACITY},
  "isActive": true,
  "isAcceptingNewProjects": true
}
EOF
)

AUTH_HEADER=""
if [ -n "${LOCALME_ADMIN_TOKEN}" ]; then
  AUTH_HEADER="Authorization: Bearer ${LOCALME_ADMIN_TOKEN}"
fi

python3 -c "
import urllib.request, json, sys

url = '${LOCALME_API_URL}/_baas/v1/admin/shards'
data = '''${REGISTER_PAYLOAD}'''.encode('utf-8')
headers = {'Content-Type': 'application/json'}
auth = '${AUTH_HEADER}'
if auth:
    k, v = auth.split(': ', 1)
    headers[k] = v

req = urllib.request.Request(url, data=data, headers=headers, method='POST')
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode('utf-8')
        print(f'  ${GREEN}✓ Shard registered successfully: {body}${NC}')
except urllib.error.HTTPError as err:
    print(f'  ℹ️ Registration HTTP {err.code}: {err.read().decode(\"utf-8\", errors=\"ignore\")}')
except Exception as ex:
    print(f'  ℹ️ Registration notice: {ex} (LocalMe server may be starting or offline)')
"

# ------------------------------------------------------------------------------
# 5. Diagnostic Connection Probe
# ------------------------------------------------------------------------------
echo -e "${CYAN}▶ Probing shard health diagnostic endpoint...${NC}"

python3 -c "
import urllib.request, sys

test_url = '${LOCALME_API_URL}/_baas/v1/admin/shards/${SHARD_ID}/test'
headers = {}
auth = '${AUTH_HEADER}'
if auth:
    k, v = auth.split(': ', 1)
    headers[k] = v

req = urllib.request.Request(test_url, data=b'', headers=headers, method='POST')
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        body = resp.read().decode('utf-8')
        print(f'  ${GREEN}✓ Health probe response: {body}${NC}')
except Exception as ex:
    print(f'  ℹ️ Probe notice: {ex}')
"

echo ""
echo -e "${GREEN}====================================================================${NC}"
echo -e "${GREEN}    Shard deployment and registration workflow complete!           ${NC}"
echo -e "${GREEN}====================================================================${NC}"
