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
import pty, os, sys, subprocess, struct, termios, fcntl, time, threading, base64, json, urllib.request

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

initial_latest_id = None
jwt_token = None
try:
    token_file = os.path.expanduser('~/.config/.runflare/token')
    if os.path.exists(token_file):
        with open(token_file) as f:
            raw = f.read().strip()
        jwt_token = json.loads(base64.b64decode(raw + '===').decode('utf-8')).get('token')
        req = urllib.request.Request(
            'https://api.runflare.com/project/${RUNFLARE_PROJECT_ID}/items/${RUNFLARE_ITEM_ID}/images/',
            headers={'Authorization': f'Bearer {jwt_token}'}
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            images = json.loads(r.read()).get('data', [])
            if images:
                initial_latest_id = images[0].get('id')
except Exception:
    pass

proc = subprocess.Popen(cmd, stdin=slave, stdout=slave, stderr=slave, close_fds=True, env=env)
os.close(slave)

flags = fcntl.fcntl(master, fcntl.F_GETFL)
fcntl.fcntl(master, fcntl.F_SETFL, flags | os.O_NONBLOCK)

start_time = time.time()
max_duration = 600  # 10 minutes max timeout
stop_flag = [False]
abort_reason = [None]

def monitor_api():
    if not jwt_token:
        return
    while not stop_flag[0]:
        time.sleep(5)
        try:
            req = urllib.request.Request(
                'https://api.runflare.com/project/${RUNFLARE_PROJECT_ID}/items/${RUNFLARE_ITEM_ID}/images/',
                headers={'Authorization': f'Bearer {jwt_token}'}
            )
            with urllib.request.urlopen(req, timeout=5) as r:
                images = json.loads(r.read()).get('data', [])
                if images:
                    curr = images[0]
                    curr_id = curr.get('id')
                    if curr_id != initial_latest_id:
                        if curr.get('status') == 'ER' or curr.get('error'):
                            abort_reason[0] = f'Runflare build error on image {curr_id} ({curr.get(\"version_code\")})'
                            stop_flag[0] = True
                            break
                        elif curr.get('status') == 'CP' and curr.get('current'):
                            time.sleep(2)
                            stop_flag[0] = True
                            break
        except Exception:
            pass

mon_thread = threading.Thread(target=monitor_api, daemon=True)
mon_thread.start()

try:
    while proc.poll() is None and not stop_flag[0]:
        if time.time() - start_time > max_duration:
            abort_reason[0] = 'Deployment timeout exceeded (7 minutes)'
            break
        try:
            data = os.read(master, 1024)
            if data:
                text = data.decode('latin1', errors='ignore')
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
                if 'error: failed to solve:' in text or '401 Unauthorized' in text:
                    abort_reason[0] = 'BuildKit push failed (401 Unauthorized to registry)'
                    break
        except (BlockingIOError, OSError):
            time.sleep(0.1)
finally:
    stop_flag[0] = True
    try:
        os.close(master)
    except OSError:
        pass

if abort_reason[0]:
    print(f'\\n❌ {abort_reason[0]}', file=sys.stderr)
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass
    sys.exit(1)

ret = proc.poll()
if ret is None:
    try:
        proc.wait(timeout=5)
        ret = proc.returncode
    except Exception:
        ret = 0

if ret != 0:
    print(f'\\n❌ Deployment exited with code {ret}', file=sys.stderr)
sys.exit(ret)
"

echo "✅ LocalMe deployment to Runflare completed successfully!"
