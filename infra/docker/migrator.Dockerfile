# One-shot job that applies every service's Prisma migrations (prisma migrate deploy).
# Run it before (re)starting services on each release. Build context: repository root.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@6.19.3
WORKDIR /migrations
COPY services/auth-service/prisma ./auth/prisma
COPY services/athlete-service/prisma ./athlete/prisma
COPY services/university-service/prisma ./university/prisma
COPY services/application-service/prisma ./application/prisma
COPY services/payment-service/prisma ./payment/prisma
COPY services/esign-service/prisma ./esign/prisma
COPY services/document-service/prisma ./document/prisma
COPY services/notification-service/prisma ./notification/prisma
COPY services/finance-service/prisma ./finance/prisma
COPY infra/docker/migrate-all.sh ./migrate-all.sh
USER node
CMD ["sh", "./migrate-all.sh"]
