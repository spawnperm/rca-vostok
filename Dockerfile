# syntax=docker/dockerfile:1

# ---- Stage 1: build the client bundle -------------------------------------
FROM node:26.13.0-bookworm-slim AS builder

WORKDIR /app

# Dependency manifests first: this layer is reused until package*.json changes.
COPY package*.json .npmrc ./
# Workspace manifests first: `npm ci` links packages/* into node_modules only if
# they are present at install time. Copying them afterwards leaves
# @nexus-plugins/* unresolvable at runtime.
COPY packages ./packages
# `npm ci` requires package-lock.json, which is committed. The previous
# conditional fell back to `npm install` when the lockfile was missing, so image
# builds could pull newer dependency versions than CI had tested.
RUN npm ci --no-audit --no-fund

# Build the Vite bundle (also runs the copy-unbundled-src-assets plugin).
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:26.13.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# server.ts is executed directly by Node, which strips TypeScript types
# natively (Node >= 22.18). Only runtime dependencies are installed here.
COPY package*.json .npmrc ./
COPY packages ./packages
RUN npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

# TypeScript sources are required at runtime: server.ts imports the
# application / domain / infrastructure folders directly.
COPY server.ts ./
COPY src ./src
# Operational scripts (e.g. `docker compose exec app node scripts/create-admin.ts`).
COPY scripts ./scripts
COPY packages ./packages
COPY --from=builder /app/dist ./dist

# Persisted JSON stores (analytics, inquiries, feedback) and structured log files.
# /app/data/pgdata holds the embedded PGlite database when DATABASE_URL is unset;
# /app/logs receives the structured log file.
RUN mkdir -p /app/data/pgdata /app/logs && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.ts"]
