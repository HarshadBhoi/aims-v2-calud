# syntax=docker/dockerfile:1.7
#
# REFERENCE IMPLEMENTATION — Production API image for AIMS v2.
#
# Multi-stage, distroless, non-root, pinned by SHA, small.
# Target image size: ~180 MB (vs. ~900 MB for a naive node image).
#
# Build:
#   docker build -f docker/api.Dockerfile -t aims-api:dev .
#
# CI additionally: cosign sign + syft SBOM + trivy scan.

########################################################################
# Stage 1: deps — install workspace dependencies (cacheable layer)
########################################################################
FROM node:22.11.0-bookworm-slim@sha256:1c18d9ab3af4585870b92e4dbc5cac5a0dc77dd13df1a5905cea89fc720eb05b AS deps
WORKDIR /app

# Install build tools needed for native modules (argon2, bcrypt, sharp).
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (bundled with Node 22).
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy only files needed for install — maximizes cache hits.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/validation/package.json packages/validation/
COPY packages/standard-packs/package.json packages/standard-packs/

# Fetch + install all workspace deps for the api filter.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter=api...

########################################################################
# Stage 2: build — compile TypeScript
########################################################################
FROM deps AS build
WORKDIR /app

# Source code.
COPY apps/api ./apps/api
COPY packages/validation ./packages/validation
COPY packages/standard-packs ./packages/standard-packs
COPY tsconfig.base.json turbo.json ./

# Compile.
RUN pnpm --filter=api build
# Prisma Client generation (if applicable).
RUN pnpm --filter=api prisma generate

########################################################################
# Stage 3: prune — install prod-only deps for runtime
########################################################################
FROM deps AS prune
WORKDIR /app

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter=api...

# Remove dev dep noise to shrink the runtime image.
RUN rm -rf /app/apps/api/src /app/apps/api/test

########################################################################
# Stage 4: runtime — distroless nonroot
########################################################################
# Distroless nodejs22 — no shell, no apt, minimal attack surface.
# nonroot digest pinned for reproducibility.
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:f8c47df8ba3d0a84f3dfc1b8cef7d52a4b6ed50a4d4ac8e5f41a9a2b4c7e1d2a AS runtime

WORKDIR /app

# OCI labels for registry browsers + compliance.
LABEL org.opencontainers.image.title="aims-api" \
      org.opencontainers.image.description="AIMS v2 API service" \
      org.opencontainers.image.source="https://github.com/acme/aims-v2" \
      org.opencontainers.image.licenses="Proprietary" \
      org.opencontainers.image.vendor="AIMS" \
      org.opencontainers.image.authors="platform@aims.io"

# Copy production-only artifacts.
COPY --from=prune  --chown=nonroot:nonroot /app/node_modules                    ./node_modules
COPY --from=prune  --chown=nonroot:nonroot /app/packages                        ./packages
COPY --from=build  --chown=nonroot:nonroot /app/apps/api/dist                   ./apps/api/dist
COPY --from=build  --chown=nonroot:nonroot /app/apps/api/package.json           ./apps/api/
# Prisma engine binary (if applicable)
COPY --from=build  --chown=nonroot:nonroot /app/node_modules/.prisma            ./node_modules/.prisma

# Non-root user (distroless default = 65532:65532).
USER nonroot

# Environment.
ENV NODE_ENV=production \
    NODE_OPTIONS="--enable-source-maps --unhandled-rejections=strict" \
    # Keep libuv thread pool sized for argon2 / bcrypt hot paths.
    UV_THREADPOOL_SIZE=16 \
    # OTel: auto-resource detection + service name.
    OTEL_SERVICE_NAME=aims-api \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp

EXPOSE 4000
# Separate metrics port for Prometheus scrape.
EXPOSE 4001

# No HEALTHCHECK — k8s liveness/readiness probes authoritative.

# Final command. Distroless's entrypoint is already /nodejs/bin/node, so we
# pass the script as the argument.
CMD ["apps/api/dist/main.js"]
