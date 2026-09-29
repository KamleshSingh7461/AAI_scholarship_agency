# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f services/payment-service/Dockerfile .
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services/payment-service ./services/payment-service
RUN npm ci --no-audit --no-fund -w @aci/contracts -w @aci/nest-common -w @aci/payment-service --include-workspace-root
RUN npm run build -w @aci/contracts -w @aci/nest-common \
 && cd services/payment-service && npx prisma generate && npm run build
RUN npm prune --omit=dev -w @aci/contracts -w @aci/nest-common -w @aci/payment-service

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/services/payment-service/dist ./services/payment-service/dist
COPY --from=build --chown=node:node /repo/services/payment-service/prisma ./services/payment-service/prisma
COPY --from=build --chown=node:node /repo/services/payment-service/package.json ./services/payment-service/package.json
COPY --from=build --chown=node:node /repo/package.json ./package.json
USER node
WORKDIR /repo/services/payment-service
EXPOSE 4005
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://127.0.0.1:4005/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
