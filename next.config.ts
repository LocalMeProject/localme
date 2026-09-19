import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // better-sqlite3 is a native addon: keep it external to the server bundle so
  // Node loads the compiled binding directly (works on every Node host).
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
