# syntax=docker/dockerfile:1.7
# Build context: repository root.  docker build -f apps/web-admin/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /repo
ARG NEXT_PUBLIC_STUDENT_APP_URL
ARG NEXT_PUBLIC_PUBLIC_SITE_URL
ARG API_GATEWAY_URL=http://api-gateway:8080
ENV NEXT_TELEMETRY_DISABLED=1 API_GATEWAY_URL=${API_GATEWAY_URL} NEXT_PUBLIC_STUDENT_APP_URL=${NEXT_PUBLIC_STUDENT_APP_URL} NEXT_PUBLIC_PUBLIC_SITE_URL=${NEXT_PUBLIC_PUBLIC_SITE_URL}
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY packages/web-shared ./packages/web-shared
COPY apps/web-admin ./apps/web-admin
RUN npm ci --no-audit --no-fund -w @aci/contracts -w @aci/web-shared -w @aci/web-admin --include-workspace-root
RUN npm run build -w @aci/contracts && npm run build -w @aci/web-admin

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3002 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web-admin/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=build --chown=node:node /repo/apps/web-admin/public ./apps/web-admin/public
USER node
EXPOSE 3002
CMD ["node", "apps/web-admin/server.js"]
