import React, { useState } from 'react';

interface Capability {
  code: string;
  name: string;
  description: string;
  primitives: string[];
  enabled: boolean;
}

const INITIAL_CAPABILITIES: Capability[] = [
  {
    code: 'BASE',
    name: 'Core Project Foundation',
    description: 'Dynamic subdomain, YARP edge routing, e-Namad compliance responder',
    primitives: ['DNS_SUBDOMAIN', 'YARP_ROUTE', 'COMPLIANCE_RESPONDER', 'TELEMETRY_METER'],
    enabled: true,
  },
  {
    code: 'BAAS_DB',
    name: 'Relational Database & API',
    description: 'PostgreSQL 18 schema-per-tenant, Npgsql pool, Dynamic SQL endpoint',
    primitives: ['PG_TENANT_SCHEMA', 'NPGSQL_POOL', 'DYNAMIC_SQL_ROUTE'],
    enabled: true,
  },
  {
    code: 'IDAAS',
    name: 'Authentication (IDaaS)',
    description: 'Iranian mobile OTP, Jint dispatch hooks, Argon2id, Ed25519 tokens',
    primitives: ['BAAS_DB', 'REDIS_KV', 'JINT_ISOLATE', 'SECRET_VAULT', 'STATIC_EGRESS_NAT'],
    enabled: true,
  },
  {
    code: 'FIN_IPG',
    name: 'Managed IPG & IRR Ledger',
    description: 'Shaparak / Zarinpal / SEP bank callbacks, Rial double-entry ledger, Deep Links',
    primitives: ['BAAS_DB', 'COMPUTE_EDGE', 'STATIC_EGRESS_NAT', 'COMPLIANCE_RESPONDER'],
    enabled: false,
  },
  {
    code: 'STORAGE_BLOB',
    name: 'Blob & Media Storage',
    description: 'Multi-adapter storage (Runflare, Arvan, MinIO), TUS resumable uploads, ImageSharp',
    primitives: ['BAAS_DB', 'BLOB_STORAGE_ADAPTER', 'TUSDOTNET_PROXY', 'IMAGESHARP_PROXY'],
    enabled: false,
  },
  {
    code: 'HOSTING_WEB',
    name: 'Frontend Web Hosting',
    description: 'Immutable content-addressed SPA hosting, automatic e-Namad meta injection',
    primitives: ['BLOB_STORAGE_ADAPTER', 'YARP_ROUTE', 'EDGE_CACHE', 'LETTUCEENCRYPT_SSL'],
    enabled: true,
  },
];

export default function App() {
  const [capabilities, setCapabilities] = useState(INITIAL_CAPABILITIES);
  const [walletBalance] = useState<number>(450000000); // 450,000,000 IRR = 45,000,000 Tomans

  const toggleCapability = (code: string) => {
    setCapabilities((prev) =>
      prev.map((c) => (c.code === code ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const activePrimitives = Array.from(
    new Set(
      capabilities
        .filter((c) => c.enabled)
        .flatMap((c) => c.primitives)
    )
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-zinc-800">
      {/* Sleek Apple-style Translucent Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center font-bold text-black text-sm">
            LM
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight">LocalMe Sovereign Console</h1>
            <p className="text-xs text-zinc-400">Pure .NET 10 + PostgreSQL 18.1 + Redis 7/8</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Static Egress NAT: Whitelisted</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800">
            <span>کیف پول ریالی: </span>
            <span className="text-amber-400 font-bold">{(walletBalance / 10).toLocaleString('fa-IR')} تومان</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        {/* Project Header Card */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-md flex justify-between items-center">
          <div>
            <div className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
              ACTIVE PROJECT
            </div>
            <h2 className="text-2xl font-bold tracking-tight">digikala-clone</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Static Subdomain: <a href="https://digikala-clone.localme.ir" target="_blank" rel="noreferrer" className="text-amber-400 hover:underline">https://digikala-clone.localme.ir</a>
            </p>
          </div>
          <button className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 font-medium text-sm transition">
            Deploy New Build
          </button>
        </div>

        {/* DAG Matrix Engine Section */}
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Directed Acyclic Graph (DAG) Matrix</h3>
            <p className="text-sm text-zinc-400">
              Toggle capabilities to trigger atomic reference counting and automated primitive provisioning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilities.map((cap) => (
              <div
                key={cap.code}
                onClick={() => toggleCapability(cap.code)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all duration-200 ${
                  cap.enabled
                    ? 'bg-zinc-900/90 border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-zinc-900/20 border-zinc-800/60 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-amber-400">{cap.code}</span>
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      cap.enabled ? 'border-amber-500 bg-amber-500' : 'border-zinc-700'
                    }`}
                  >
                    {cap.enabled && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                  </div>
                </div>
                <h4 className="font-medium text-sm text-zinc-100">{cap.name}</h4>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{cap.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Resolved Infrastructure Primitives Display */}
        <section className="p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">
            Active Infrastructure Primitives ({activePrimitives.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {activePrimitives.map((p) => (
              <span
                key={p}
                className="px-3 py-1 rounded-lg text-xs font-mono bg-zinc-800 text-zinc-200 border border-zinc-700/60"
              >
                {p}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
