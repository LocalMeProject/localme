import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native addon: keep it external to the server bundle so
  // Node loads the compiled binding directly (works on every Node host).
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Cap page-data collection workers: on many-core hosts the default
    // (cores + 1) workers each load the full module graph and can exceed
    // container memory limits (OOM-killed builds). 4 is plenty for this app.
    cpus: 4,
    memoryBasedWorkersCount: false,
  },
};

export default nextConfig;
