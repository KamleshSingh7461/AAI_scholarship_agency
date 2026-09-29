# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f services/api-gateway/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY services/api-gateway ./services/api-gateway
RUN npm ci --no-audit --no-fund -w @aci/api-gateway --include-workspace-root
RUN npm run build -w @aci/api-gateway && npm prune --omit=dev -w @aci/api-gateway

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=build --chown=node:node /repo/services/api-gateway/package.json ./services/api-gateway/package.json
USER node
WORKDIR /repo/services/api-gateway
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
