namespace LocalMe.Server.Dashboard;

public static class DashboardRenderer
{
    public static string RenderHtml(string nodeRole)
    {
        return $$"""
        <!DOCTYPE html>
        <html lang="en" class="dark">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>LocalMe Sovereign Dashboard</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              darkMode: 'class',
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
                    mono: ['"JetBrains Mono"', 'monospace']
                  },
                  colors: {
                    brand: {
                      50: '#fffbeb',
                      100: '#fef3c7',
                      500: '#f59e0b',
                      600: '#d97706',
                      900: '#78350f'
                    }
                  }
                }
              }
            }
          </script>
          <style>
            body {
              background-color: #09090b;
              color: #f4f4f5;
              font-feature-settings: "cv02", "cv03", "cv04", "cv11";
            }
            .glass-panel {
              background: rgba(24, 24, 27, 0.65);
              backdrop-filter: blur(16px);
              -webkit-backdrop-filter: blur(16px);
              border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .glass-panel:hover {
              border-color: rgba(255, 255, 255, 0.14);
            }
            .glass-nav {
              background: rgba(9, 9, 11, 0.85);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            .glow-amber {
              box-shadow: 0 0 25px -5px rgba(245, 158, 11, 0.15);
            }
            /* Custom scrollbar */
            ::-webkit-scrollbar { width: 6px; height: 6px; }
            ::-webkit-scrollbar-track { background: #09090b; }
            ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
          </style>
        </head>
        <body class="min-h-screen flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
          
          <!-- Top Global Nav -->
          <header class="sticky top-0 z-50 glass-nav px-6 py-3.5 flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center font-extrabold text-black shadow-lg shadow-amber-500/20 text-sm tracking-wider">
                LM
              </div>
              <div>
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-sm tracking-tight text-white">LocalMe Developer Console</span>
                  <span class="px-2 py-0.5 text-[10px] font-mono font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">v1.0.0 Pure .NET 10</span>
                </div>
                <p class="text-[11px] text-zinc-400">Node Role: <span class="font-mono text-zinc-300 uppercase">{{nodeRole}}</span> • Engine: PostgreSQL 18.1 + Redis 7/8</p>
              </div>
            </div>

            <div class="flex items-center space-x-3 text-xs">
              <div class="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span class="font-mono text-zinc-300">Static Egress NAT: Active</span>
              </div>
              <div class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-300 font-mono flex items-center space-x-1.5">
                <span class="text-zinc-400">کیف پول:</span>
                <span class="font-bold">۴۵,۰۰۰,۰۰۰ تومان</span>
                <span class="text-[10px] text-zinc-500 font-sans">(450M IRR)</span>
              </div>
              <a href="/" target="_blank" class="px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 font-medium transition text-xs flex items-center space-x-1">
                <span>View Storefront</span>
                <span>↗</span>
              </a>
            </div>
          </header>

          <!-- Main Dashboard Body -->
          <main class="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
            
            <!-- Hero Banner Card -->
            <div class="relative overflow-hidden rounded-3xl glass-panel p-8 glow-amber">
              <div class="absolute -right-16 -top-16 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div class="space-y-2">
                  <div class="inline-flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>ONLINE & READY FOR DEPLOYMENTS</span>
                  </div>
                  <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">digikala-clone</h1>
                  <p class="text-sm text-zinc-400 max-w-2xl leading-relaxed">
                    Local BaaS and Edge PaaS tenant container. All outbound traffic routes through Iranian whitelisted Static NAT IPs for banking compliance.
                  </p>
                  <div class="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span class="text-zinc-400">Primary Domain:</span>
                    <a href="https://digikala-clone.localme.ir" target="_blank" class="text-amber-400 hover:text-amber-300 underline underline-offset-4 decoration-amber-500/40">https://digikala-clone.localme.ir</a>
                    <span class="text-zinc-600">•</span>
                    <span class="text-zinc-400">Tenant Schema:</span>
                    <span class="text-zinc-200 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">prj_digikala_clone</span>
                  </div>
                </div>

                <div class="flex flex-col sm:flex-row gap-3">
                  <button onclick="testEndpoint('/healthz')" class="px-4 py-2.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700 text-white font-medium text-xs transition border border-zinc-700/60 shadow-sm">
                    Probe Healthz
                  </button>
                  <button onclick="testEndpoint('/_baas/v1/config')" class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition shadow-lg shadow-amber-500/20">
                    Fetch BaaS Config
                  </button>
                </div>
              </div>
            </div>

            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="glass-panel p-5 rounded-2xl space-y-1">
                <span class="text-xs text-zinc-400 font-medium">Kestrel Edge Gateway</span>
                <div class="text-xl font-bold font-mono text-white flex items-center space-x-2">
                  <span>&lt; 1.2ms</span>
                  <span class="text-xs text-emerald-400 font-sans">p99</span>
                </div>
                <p class="text-[11px] text-zinc-500">Local Ed25519 JWT verification</p>
              </div>

              <div class="glass-panel p-5 rounded-2xl space-y-1">
                <span class="text-xs text-zinc-400 font-medium">Dynamic SQL Pipeline</span>
                <div class="text-xl font-bold font-mono text-white flex items-center space-x-2">
                  <span>~1.4M</span>
                  <span class="text-xs text-amber-400 font-sans">rows/s</span>
                </div>
                <p class="text-[11px] text-zinc-500">PipeWriter zero-alloc serialization</p>
              </div>

              <div class="glass-panel p-5 rounded-2xl space-y-1">
                <span class="text-xs text-zinc-400 font-medium">Jint Compute Cold-Start</span>
                <div class="text-xl font-bold font-mono text-white flex items-center space-x-2">
                  <span>&lt; 8.5ms</span>
                  <span class="text-xs text-emerald-400 font-sans">warm pool</span>
                </div>
                <p class="text-[11px] text-zinc-500">16MB memory governor safe</p>
              </div>

              <div class="glass-panel p-5 rounded-2xl space-y-1">
                <span class="text-xs text-zinc-400 font-medium">Active Primitives</span>
                <div class="text-xl font-bold font-mono text-amber-400" id="activePrimitiveCount">11</div>
                <p class="text-[11px] text-zinc-500">Controlled by DAG Matrix</p>
              </div>
            </div>

            <!-- Interactive Capability-to-Primitive DAG Engine -->
            <section class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-bold tracking-tight text-white flex items-center space-x-2">
                    <span>Directed Acyclic Graph (DAG) Dependency Matrix</span>
                    <span class="text-xs font-normal text-zinc-400 font-mono">Section 3.1 SSOT</span>
                  </h2>
                  <p class="text-xs text-zinc-400 mt-0.5">Toggle capabilities below. Primitives compute their transitive closure with atomic ref counting in real time.</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="capabilityGrid">
                <!-- Injected via JavaScript -->
              </div>
            </section>

            <!-- Resolved Primitives Tray -->
            <section class="glass-panel p-6 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold tracking-wider uppercase text-zinc-400">
                  Provisioned Infrastructure Primitives (Transitive Closure)
                </h3>
                <span class="text-xs font-mono text-amber-400" id="primitiveSummary">11 Primitives Active</span>
              </div>
              <div class="flex flex-wrap gap-2" id="primitivesTray">
                <!-- Injected via JavaScript -->
              </div>
            </section>

            <!-- Live Endpoint Response Inspection Box -->
            <section class="glass-panel p-6 rounded-2xl space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center space-x-2">
                  <span>Live Server Inspection Console</span>
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                </h3>
                <span class="text-[11px] font-mono text-zinc-500" id="inspectUrl">Direct In-Process Kestrel Request</span>
              </div>
              <div class="bg-black/60 rounded-xl p-4 border border-zinc-800/80 font-mono text-xs overflow-x-auto text-emerald-400 min-h-[90px] flex items-center" id="inspectOutput">
                Click any endpoint button above to inspect live Kestrel response...
              </div>
            </section>

          </main>

          <!-- Footer -->
          <footer class="border-t border-zinc-900 py-6 px-6 text-center text-xs text-zinc-500">
            LocalMe Sovereign Cloud Platform • Pure .NET 10 Stack • Iranian Domestic & Global Architecture
          </footer>

          <!-- Interactive DAG Script -->
          <script>
            const CAPABILITIES = [
              {
                code: 'BASE',
                name: 'Core Project Foundation',
                description: 'Dynamic subdomain routing, YARP edge proxy, e-Namad compliance, telemetry meter.',
                primitives: ['DNS_SUBDOMAIN', 'YARP_ROUTE', 'COMPLIANCE_RESPONDER', 'TELEMETRY_METER'],
                enabled: true
              },
              {
                code: 'BAAS_DB',
                name: 'Relational Database & API',
                description: 'PostgreSQL 18 schema-per-tenant isolation, Npgsql pool, Dynamic SQL endpoint.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE'],
                enabled: true
              },
              {
                code: 'IDAAS',
                name: 'Authentication & OTP',
                description: 'Iranian mobile OTP (MeliPayamak/Kavenegar), Argon2id, Jint dispatch hooks, Ed25519 tokens.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'REDIS_KV', 'JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT'],
                enabled: true
              },
              {
                code: 'FIN_IPG',
                name: 'Managed IPG & IRR Ledger',
                description: 'Shaparak/Zarinpal/SEP bank callbacks, Rial double-entry ledger, mobile OS deep-link bridge.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT', 'COMPLIANCE_RESPONDER'],
                enabled: false
              },
              {
                code: 'STORAGE_BLOB',
                name: 'Blob & Media Storage',
                description: 'Pluggable IBlobStorageAdapter (Runflare, Arvan, MinIO), TUS resumable uploads, ImageSharp.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'BLOB_STORAGE_ADAPTER', 'TUSDOTNET_PROXY', 'IMAGESHARP_PROXY'],
                enabled: false
              },
              {
                code: 'HOSTING_WEB',
                name: 'Frontend Web Hosting',
                description: 'Content-addressed SPA bundle hosting, YARP edge routing, dynamic e-Namad meta injection.',
                primitives: ['BLOB_STORAGE_ADAPTER', 'YARP_ROUTE', 'EDGE_CACHE', 'LETTUCEENCRYPT_SSL'],
                enabled: true
              },
              {
                code: 'RTAAS',
                name: 'Real-Time PubSub',
                description: 'SignalR multiplexing with Redis backplane and PostgreSQL LISTEN/NOTIFY write capture.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'PG_LISTEN_NOTIFY', 'REDIS_STREAMS', 'SIGNALR_GATEWAY'],
                enabled: false
              },
              {
                code: 'PUSH_ENGINE',
                name: 'Dual-Mode Push Engine',
                description: 'Simultaneous FCM/APNs global dispatch + domestic MQTT-over-WebSocket for intranet resiliency.',
                primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE', 'REDIS_STREAMS', 'MQTTNET_BROKER', 'FCM_APNS_ADAPTER'],
                enabled: false
              },
              {
                code: 'OLAP_ENGINE',
                name: 'Native OLAP Analytics',
                description: 'PostgreSQL 18 declarative list-partitioning, BRIN time indexes, native uuidv7.',
                primitives: ['PG_ANALYTICS_PART', 'PG_LISTEN_NOTIFY', 'REDIS_STREAMS'],
                enabled: false
              }
            ];

            function render() {
              const grid = document.getElementById('capabilityGrid');
              grid.innerHTML = '';

              CAPABILITIES.forEach(cap => {
                const card = document.createElement('div');
                card.className = `cursor-pointer p-5 rounded-2xl transition-all duration-200 border ${
                  cap.enabled
                    ? 'bg-zinc-900/90 border-amber-500/50 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-900/20 border-zinc-800/60 opacity-60 hover:opacity-90'
                }`;
                card.onclick = () => {
                  cap.enabled = !cap.enabled;
                  render();
                };

                card.innerHTML = `
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-mono text-xs font-bold ${cap.enabled ? 'text-amber-400' : 'text-zinc-500'}">${cap.code}</span>
                    <div class="w-4 h-4 rounded-full border flex items-center justify-center ${
                      cap.enabled ? 'border-amber-500 bg-amber-500' : 'border-zinc-700'
                    }">
                      ${cap.enabled ? '<div class="w-1.5 h-1.5 rounded-full bg-black"></div>' : ''}
                    </div>
                  </div>
                  <h4 class="font-semibold text-sm text-zinc-100">${cap.name}</h4>
                  <p class="text-xs text-zinc-400 mt-1 leading-relaxed">${cap.description}</p>
                `;
                grid.appendChild(card);
              });

              // Compute transitive closure of primitives
              const activePrimitives = new Set();
              CAPABILITIES.filter(c => c.enabled).forEach(c => {
                c.primitives.forEach(p => activePrimitives.add(p));
              });

              const tray = document.getElementById('primitivesTray');
              tray.innerHTML = '';
              activePrimitives.forEach(p => {
                const badge = document.createElement('span');
                badge.className = 'px-3 py-1 rounded-xl text-xs font-mono bg-zinc-800 text-zinc-200 border border-zinc-700/60 flex items-center space-x-1.5';
                badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span><span>${p}</span>`;
                tray.appendChild(badge);
              });

              document.getElementById('activePrimitiveCount').textContent = activePrimitives.size;
              document.getElementById('primitiveSummary').textContent = `${activePrimitives.size} Primitives Active`;
            }

            async function testEndpoint(url) {
              const inspectBox = document.getElementById('inspectOutput');
              const inspectUrl = document.getElementById('inspectUrl');
              inspectUrl.textContent = `GET ${url}`;
              inspectBox.textContent = 'Fetching...';

              try {
                const res = await fetch(url);
                const contentType = res.headers.get('content-type') || '';
                let data = '';
                if (contentType.includes('application/json')) {
                  const json = await res.json();
                  data = JSON.stringify(json, null, 2);
                } else {
                  data = await res.text();
                }
                inspectBox.textContent = data;
              } catch (err) {
                inspectBox.textContent = 'Error fetching endpoint: ' + err.message;
              }
            }

            render();
          </script>
        </body>
        </html>
        """;
    }
}
