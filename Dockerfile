# syntax=docker/dockerfile:1

# ---- Stage 1: build the client bundle -------------------------------------
FROM node:22.23.5-bookworm-slim AS builder

WORKDIR /app

# Install dependencies against the committed manifests first so the layer
# cache survives source-only changes.
COPY package.json ./
RUN npm install --no-audit --no-fund

# Build the Vite bundle (also runs the copy-unbundled-src-assets plugin).
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public
RUN npm run build

# ---- Stage 2: runtime ------------------------------------------------------
FROM node:22.23.5-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# server.ts is executed directly by Node, which strips TypeScript types
# natively (Node >= 22.18). Only runtime dependencies are installed here.
COPY package.json ./
RUN npm install --no-audit --no-fund --omit=dev && npm cache clean --force

# Typescript sources are required at runtime: server.ts imports the
# application / domain / infrastructure folders directly.
COPY server.ts ./
COPY src ./src
COPY --from=builder /app/dist ./dist

# Persisted JSON stores (analytics, inquiries, feedback).
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.ts"]
