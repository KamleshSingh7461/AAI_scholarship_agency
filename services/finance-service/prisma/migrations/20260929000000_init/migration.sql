-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" UUID NOT NULL,
    "base" TEXT NOT NULL DEFAULT 'USD',
    "quote" TEXT NOT NULL DEFAULT 'INR',
    "rate4" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award_ledgers" (
    "awardId" UUID NOT NULL,
    "awardNo" TEXT NOT NULL,
    "athleteUserId" UUID NOT NULL,
    "athleteName" TEXT NOT NULL,
    "athleteCode" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "sport" TEXT,
    "universityId" UUID NOT NULL,
    "universityName" TEXT NOT NULL,
    "programId" UUID NOT NULL,
    "programName" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "tuitionPerYear" BIGINT NOT NULL,
    "roomPerYear" BIGINT NOT NULL,
    "foodPerYear" BIGINT NOT NULL,
    "otherPerYear" BIGINT NOT NULL,
    "annualValue" BIGINT NOT NULL,
    "totalValue" BIGINT NOT NULL,
    "usdInrRate4" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "universityCommissionShareBps" INTEGER NOT NULL,
    "grantDate" TIMESTAMP(3) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "universityConfirmationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "universityConfirmedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_ledgers_pkey" PRIMARY KEY ("awardId")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "entryNo" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "awardId" UUID,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "amountInr" BIGINT NOT NULL,
    "amountUsd" BIGINT NOT NULL,
    "usdInrRate4" INTEGER NOT NULL,
    "universityId" UUID,
    "fiscalYear" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "account" TEXT NOT NULL,
    "debit" BIGINT NOT NULL DEFAULT 0,
    "credit" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_schedules" (
    "id" UUID NOT NULL,
    "awardId" UUID NOT NULL,
    "yearNumber" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "fiscalYear" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "universityFunded" BIGINT NOT NULL DEFAULT 0,
    "companyFunded" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "recognizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" UUID NOT NULL,
    "awardId" UUID NOT NULL,
    "yearNumber" INTEGER,
    "universityId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "payee" TEXT NOT NULL DEFAULT 'UNIVERSITY',
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "documentId" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_runs" (
    "id" UUID NOT NULL,
    "reportType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documentId" UUID,
    "fileName" TEXT,
    "rowCount" INTEGER,
    "error" TEXT,
    "generatedById" UUID NOT NULL,
    "generatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "fx_rates_base_quote_effectiveDate_key" ON "fx_rates"("base", "quote", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "award_ledgers_awardNo_key" ON "award_ledgers"("awardNo");

-- CreateIndex
CREATE INDEX "award_ledgers_universityId_idx" ON "award_ledgers"("universityId");

-- CreateIndex
CREATE INDEX "award_ledgers_grantDate_idx" ON "award_ledgers"("grantDate");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_entryNo_key" ON "journal_entries"("entryNo");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_idempotencyKey_key" ON "journal_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "journal_entries_type_entryDate_idx" ON "journal_entries"("type", "entryDate");

-- CreateIndex
CREATE INDEX "journal_entries_awardId_idx" ON "journal_entries"("awardId");

-- CreateIndex
CREATE INDEX "journal_entries_fiscalYear_type_idx" ON "journal_entries"("fiscalYear", "type");

-- CreateIndex
CREATE INDEX "journal_lines_account_idx" ON "journal_lines"("account");

-- CreateIndex
CREATE INDEX "expense_schedules_fiscalYear_status_idx" ON "expense_schedules"("fiscalYear", "status");

-- CreateIndex
CREATE UNIQUE INDEX "expense_schedules_awardId_yearNumber_key" ON "expense_schedules"("awardId", "yearNumber");

-- CreateIndex
CREATE INDEX "disbursements_awardId_idx" ON "disbursements"("awardId");

-- CreateIndex
CREATE INDEX "disbursements_paidOn_idx" ON "disbursements"("paidOn");

-- CreateIndex
CREATE INDEX "report_runs_createdAt_idx" ON "report_runs"("createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_schedules" ADD CONSTRAINT "expense_schedules_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "award_ledgers"("awardId") ON DELETE RESTRICT ON UPDATE CASCADE;

