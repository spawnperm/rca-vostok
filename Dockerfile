# syntax=docker/dockerfile:1

# ---- Stage 1: build the client bundle -------------------------------------
FROM node:22.23.5-bookworm-slim AS builder

WORKDIR /app

# pnpm is pinned via Corepack using the `packageManager` field in package.json,
# so the exact same version runs locally, in CI and in the image. The manifest
# must be present before `corepack prepare --activate` can resolve it.
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"
RUN corepack enable

# Dependency manifests first: this layer is reused until the lockfile changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack prepare --activate
# --frozen-lockfile guarantees the build uses the committed resolution and
# fails loudly on drift instead of silently rewriting it.
RUN pnpm install --frozen-lockfile

# Build the Vite bundle (also runs the copy-unbundled-src-assets plugin).
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN pnpm run build

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:22.23.5-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH"

WORKDIR /app

RUN corepack enable

# server.ts is executed directly by Node, which strips TypeScript types
# natively (Node >= 22.18). Only runtime dependencies are installed here.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack prepare --activate
RUN pnpm install --frozen-lockfile --prod

# Typescript sources are required at runtime: server.ts imports the
# application / domain / infrastructure folders directly.
COPY server.ts ./
COPY src ./src
# Operational scripts (e.g. `docker compose exec app node scripts/create-admin.ts`).
COPY scripts ./scripts
COPY --from=builder /app/dist ./dist

# Persisted JSON stores (analytics, inquiries, feedback) and structured log files.
RUN mkdir -p /app/data /app/logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.ts"]
