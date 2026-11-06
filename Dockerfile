# Lean Production Dockerfile for LocalMe (.NET 10 Unified BaaS/PaaS)
# Compatible with AbrArvan Cloud, Runflare, GHCR, and generic Linux VPS hosts.
FROM mcr.microsoft.com/dotnet/aspnet:10.0

WORKDIR /app

ENV NODE_ENV=production \
    ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_URLS=http://+:3000 \
    ASPNETCORE_HTTP_PORTS=3000 \
    PORT=3000

# Install curl for container health probes and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy pre-built published server and wwwroot assets
COPY dist/server ./

# Ensure storage directory exists
RUN mkdir -p /app/.localme-storage /app/data

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/healthz || exit 1

ENTRYPOINT ["dotnet", "LocalMe.Server.dll"]
