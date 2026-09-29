# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f apps/web-public/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
ARG NEXT_PUBLIC_STUDENT_APP_URL
ARG NEXT_PUBLIC_PUBLIC_SITE_URL
ARG API_GATEWAY_URL=http://api-gateway:8080
ENV NEXT_TELEMETRY_DISABLED=1 API_GATEWAY_URL=${API_GATEWAY_URL} NEXT_PUBLIC_STUDENT_APP_URL=${NEXT_PUBLIC_STUDENT_APP_URL} NEXT_PUBLIC_PUBLIC_SITE_URL=${NEXT_PUBLIC_PUBLIC_SITE_URL}
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY packages/web-shared ./packages/web-shared
COPY apps/web-public ./apps/web-public
RUN npm ci --no-audit --no-fund -w @aci/contracts -w @aci/web-shared -w @aci/web-public --include-workspace-root
RUN npm run build -w @aci/contracts && npm run build -w @aci/web-public

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web-public/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web-public/.next/static ./apps/web-public/.next/static
COPY --from=build --chown=node:node /repo/apps/web-public/public ./apps/web-public/public
USER node
EXPOSE 3000
CMD ["node", "apps/web-public/server.js"]
