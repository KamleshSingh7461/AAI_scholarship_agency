-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "agreement_templates" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "universityId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envelopes" (
    "id" UUID NOT NULL,
    "agreementType" TEXT NOT NULL,
    "templateId" UUID NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" UUID NOT NULL,
    "signerUserId" UUID NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerPhone" TEXT,
    "guardian" JSONB,
    "mergeFields" JSONB NOT NULL,
    "documentSha256" TEXT NOT NULL,
    "unsignedDocumentId" UUID,
    "signatureAnchors" JSONB,
    "signedDocumentId" UUID,
    "provider" TEXT NOT NULL,
    "providerEnvelopeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "guardianSignedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "envelopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "envelope_events" (
    "id" UUID NOT NULL,
    "envelopeId" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "detail" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "envelope_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "event_id" UUID NOT NULL,
    "handler" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("event_id","handler")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agreement_templates_type_active_idx" ON "agreement_templates"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_templates_type_universityId_version_key" ON "agreement_templates"("type", "universityId", "version");

-- CreateIndex
CREATE INDEX "envelopes_referenceType_referenceId_idx" ON "envelopes"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "envelopes_signerUserId_status_idx" ON "envelopes"("signerUserId", "status");

-- CreateIndex
CREATE INDEX "envelopes_status_expiresAt_idx" ON "envelopes"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "envelopes_provider_providerEnvelopeId_idx" ON "envelopes"("provider", "providerEnvelopeId");

-- CreateIndex
CREATE INDEX "envelope_events_envelopeId_createdAt_idx" ON "envelope_events"("envelopeId", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "envelopes" ADD CONSTRAINT "envelopes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "agreement_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "envelope_events" ADD CONSTRAINT "envelope_events_envelopeId_fkey" FOREIGN KEY ("envelopeId") REFERENCES "envelopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

