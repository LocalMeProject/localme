#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "   LocalMe Unified Production Container Deployment        "
echo "   Target: Runflare Docker Engine                         "
echo "   Project: projectsgroup-free (36960) | Item: localme (86246)"
echo "   Port: 3000 (Pure .NET 10 Unified BaaS/PaaS)            "
echo "=========================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

echo "🧹 1. Cleaning up stale build artifacts..."
rm -rf dist/server 2>/dev/null || true

echo "🔨 2. Compiling and publishing .NET 10 host locally..."
dotnet publish apps/server/src/LocalMe.Server.csproj -c Release -o dist/server

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
    'deploy',
    '--project-id', '36960',
    '--item-id', '86246',
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
