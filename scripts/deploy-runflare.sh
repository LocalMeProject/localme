#!/usr/bin/env bash
set -e

RUNFLARE_ACCOUNT="${RUNFLARE_ACCOUNT:-sina1vali@gmail.com}"
RUNFLARE_PROJECT_ID="${RUNFLARE_PROJECT_ID:-36960}"
RUNFLARE_ITEM_ID="${RUNFLARE_ITEM_ID:-86246}"

echo "=========================================================="
echo "   LocalMe Unified Production Container Deployment        "
echo "   Target: Runflare Docker Engine                         "
echo "   Account: ${RUNFLARE_ACCOUNT}                           "
echo "   Project: projectsgroup-free (${RUNFLARE_PROJECT_ID}) | Item: localme (${RUNFLARE_ITEM_ID})"
echo "   Port: 3000 (Pure .NET 10 Unified BaaS/PaaS)            "
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "🧹 1. Cleaning up stale build artifacts..."
rm -rf dist/server 2>/dev/null || true

echo "⚛️ 2. Compiling web-console (React + Vite + Supabase Design System)..."
pnpm -C apps/web-console build
cp apps/web-console/dist/index.html apps/server/src/wwwroot/panel.html
mkdir -p apps/server/src/wwwroot/assets
cp -r apps/web-console/dist/assets/* apps/server/src/wwwroot/assets/

echo "🔨 3. Compiling and publishing .NET 10 host locally..."
dotnet publish apps/server/src/LocalMe.Server.csproj -c Release -o dist/server
rm -f dist/server/*.pdb 2>/dev/null || true

# Prune unreferenced stale historical web bundles to keep container upload lightweight
python3 -c "
import os, glob, re
panel = 'dist/server/wwwroot/panel.html'
if os.path.exists(panel):
    with open(panel) as f:
        html = f.read()
    referenced = set(re.findall(r'/assets/([^\"\' >]+)', html))
    for f in glob.glob('dist/server/wwwroot/assets/index-*'):
        base = os.path.basename(f).replace('.gz', '').replace('.br', '')
        if base not in referenced:
            try:
                os.remove(f)
            except OSError:
                pass
"

if [ ! -f "dist/server/LocalMe.Server.dll" ]; then
  echo "❌ Error: dist/server/LocalMe.Server.dll not found after publish!"
  exit 1
fi
if [ ! -d "dist/server/wwwroot" ]; then
  echo "❌ Error: dist/server/wwwroot not found after publish!"
  exit 1
fi

echo "📦 3. Preparing pre-built artifacts for Runflare packager..."
# Runflare CLI consults git check-ignore by default. Temporarily comment out dist/ in .gitignore
sed -i.bak -e 's|^dist/|# dist/|g' .gitignore

restore_gitignore() {
  if [ -f .gitignore.bak ]; then
    mv .gitignore.bak .gitignore 2>/dev/null || true
  fi
  rm -f .gitignore.bak 2>/dev/null || true
}
trap restore_gitignore EXIT INT TERM

echo "🚀 4. Uploading pre-built container to Runflare..."
RUNFLARE_BIN="$(command -v runflare || echo "${HOME}/.local/bin/runflare")"

python3 -c "
import pty, os, sys, subprocess, struct, termios, fcntl

master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 100, 0, 0))

env = os.environ.copy()
env['TERM'] = 'xterm-256color'

cmd = [
    '${RUNFLARE_BIN}',
    '--account', '${RUNFLARE_ACCOUNT}',
    'deploy',
    '--project-id', '${RUNFLARE_PROJECT_ID}',
    '--item-id', '${RUNFLARE_ITEM_ID}',
    '-y',
    '--force'
]

proc = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave, close_fds=True, env=env)
os.close(slave)

try:
    while True:
        try:
            data = os.read(master, 1024)
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
        except OSError:
            break
finally:
    os.close(master)

ret = proc.wait()
if ret != 0:
    print(f'\n❌ Deployment exited with code {ret}', file=sys.stderr)
sys.exit(ret)
"

echo "✅ LocalMe deployment to Runflare completed successfully!"
