# ==============================================================================
# Multi-Stage Provider-Agnostic Dockerfile for LocalMe (.NET 10 Unified BaaS/PaaS)
# Compatible with AbrArvan, Docker Hub, GHCR, and generic Linux VPS hosts.
# ==============================================================================

# Stage 1: Build Web Console (React 19 + TypeScript + Vite + Tailwind)
FROM node:22-alpine AS web-builder
WORKDIR /workspace

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy root and web-console package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web-console/package.json ./apps/web-console/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @localme/web-console...

# Copy web-console sources and configuration
COPY apps/web-console ./apps/web-console
RUN pnpm -C apps/web-console build

# Stage 2: Build .NET 10 Unified Host
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS dotnet-builder
WORKDIR /src

# Copy project files for caching restore
COPY LocalMe.sln Directory.Build.props ./
COPY libs/core-domain/src/LocalMe.Core.csproj ./libs/core-domain/src/
COPY libs/data-plane/src/LocalMe.DataPlane.csproj ./libs/data-plane/src/
COPY libs/infrastructure/src/LocalMe.Infrastructure.csproj ./libs/infrastructure/src/
COPY apps/server/src/LocalMe.Server.csproj ./apps/server/src/

RUN dotnet restore apps/server/src/LocalMe.Server.csproj

# Copy all source files
COPY libs/ ./libs/
COPY apps/server/ ./apps/server/

# Copy compiled web-console assets to server wwwroot
COPY --from=web-builder /workspace/apps/web-console/dist/index.html ./apps/server/src/wwwroot/panel.html
COPY --from=web-builder /workspace/apps/web-console/dist/assets/ ./apps/server/src/wwwroot/assets/

# Publish release binary
RUN dotnet publish apps/server/src/LocalMe.Server.csproj -c Release -o /app/publish --no-restore

# Stage 3: Lean Production Runtime Image
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    ASPNETCORE_ENVIRONMENT=Production \
    PORT=3000

# Install curl for container health probes and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=dotnet-builder /app/publish ./

# Create storage mount directory
RUN mkdir -p /app/.localme-storage /app/data

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/healthz || exit 1

ENTRYPOINT ["dotnet", "LocalMe.Server.dll"]
