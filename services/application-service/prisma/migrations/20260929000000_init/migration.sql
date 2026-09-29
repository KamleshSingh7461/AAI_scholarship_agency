-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "athleteUserId" UUID NOT NULL,
    "athleteProfileId" UUID NOT NULL,
    "athleteCode" TEXT NOT NULL,
    "athleteName" TEXT NOT NULL,
    "athletePhone" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "athleteEmail" TEXT,
    "sport" TEXT,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardian" JSONB,
    "programId" UUID NOT NULL,
    "programName" TEXT NOT NULL,
    "universityId" UUID NOT NULL,
    "universityName" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "annualValue" BIGINT NOT NULL,
    "totalValue" BIGINT NOT NULL,
    "usdInrRate4" INTEGER NOT NULL DEFAULT 830000,
    "programSnapshot" JSONB NOT NULL,
    "statement" TEXT,
    "preferredCourse" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "feeBaseInr" BIGINT NOT NULL DEFAULT 0,
    "feeTaxInr" BIGINT NOT NULL DEFAULT 0,
    "feeTotalInr" BIGINT NOT NULL DEFAULT 0,
    "feeExplanation" TEXT,
    "feeWaived" BOOLEAN NOT NULL DEFAULT false,
    "paymentStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "paymentOrderId" UUID,
    "paidAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "reviewerId" UUID,
    "forwardedAt" TIMESTAMP(3),
    "universityDecisionAt" TIMESTAMP(3),
    "universityDecisionById" UUID,
    "universityDecisionNote" TEXT,
    "universityApprovalDocumentId" UUID,
    "rejectionReason" TEXT,
    "createdByStaffId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" UUID,
    "actorRole" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_notes" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "authorName" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" UUID NOT NULL,
    "awardNo" TEXT NOT NULL,
    "applicationId" UUID NOT NULL,
    "athleteUserId" UUID NOT NULL,
    "athleteCode" TEXT NOT NULL,
    "athleteName" TEXT NOT NULL,
    "whatsappNumber" TEXT NOT NULL,
    "athleteEmail" TEXT,
    "sport" TEXT,
    "isMinor" BOOLEAN NOT NULL DEFAULT false,
    "guardian" JSONB,
    "universityId" UUID NOT NULL,
    "universityName" TEXT NOT NULL,
    "programId" UUID NOT NULL,
    "programName" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "tuitionPerYear" BIGINT NOT NULL,
    "roomPerYear" BIGINT NOT NULL,
    "foodPerYear" BIGINT NOT NULL,
    "otherPerYear" BIGINT NOT NULL,
    "annualValue" BIGINT NOT NULL,
    "totalValue" BIGINT NOT NULL,
    "universityFundedAnnual" BIGINT NOT NULL DEFAULT 0,
    "companyFundedAnnual" BIGINT NOT NULL DEFAULT 0,
    "usdInrRate4" INTEGER NOT NULL,
    "commissionBps" INTEGER NOT NULL,
    "universityCommissionShareBps" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
    "currentYear" INTEGER NOT NULL DEFAULT 0,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agreementsDeadline" TIMESTAMP(3) NOT NULL,
    "grantDate" TIMESTAMP(3),
    "startDate" DATE,
    "endDate" DATE,
    "scholarshipEnvelopeId" UUID,
    "scholarshipSignedAt" TIMESTAMP(3),
    "scholarshipSignedDocumentId" UUID,
    "agencyEnvelopeId" UUID,
    "agencySignedAt" TIMESTAMP(3),
    "agencySignedDocumentId" UUID,
    "lastReminderAt" TIMESTAMP(3),
    "universityConfirmationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "universityConfirmedAt" TIMESTAMP(3),
    "universityConfirmedById" UUID,
    "universityConfirmationDocumentId" UUID,
    "universityConfirmationNote" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "award_years" (
    "id" UUID NOT NULL,
    "awardId" UUID NOT NULL,
    "yearNumber" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "tuitionAmount" BIGINT NOT NULL,
    "roomAmount" BIGINT NOT NULL,
    "foodAmount" BIGINT NOT NULL,
    "otherAmount" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "enrollmentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "currentCourse" TEXT,
    "currentSemester" TEXT,
    "academicScore" TEXT,
    "policyAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "registrationDocumentId" UUID,
    "registrationSubmittedAt" TIMESTAMP(3),
    "scholarshipEnvelopeId" UUID,
    "scholarshipSignedAt" TIMESTAMP(3),
    "agencyEnvelopeId" UUID,
    "agencySignedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "overdueAt" TIMESTAMP(3),
    "renewedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "award_years_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "applications_applicationNo_key" ON "applications"("applicationNo");

-- CreateIndex
CREATE INDEX "applications_athleteUserId_status_idx" ON "applications"("athleteUserId", "status");

-- CreateIndex
CREATE INDEX "applications_programId_status_idx" ON "applications"("programId", "status");

-- CreateIndex
CREATE INDEX "applications_universityId_status_idx" ON "applications"("universityId", "status");

-- CreateIndex
CREATE INDEX "applications_status_updatedAt_idx" ON "applications"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "application_status_history_applicationId_createdAt_idx" ON "application_status_history"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "application_status_history_createdAt_idx" ON "application_status_history"("createdAt");

-- CreateIndex
CREATE INDEX "application_notes_applicationId_idx" ON "application_notes"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "awards_awardNo_key" ON "awards"("awardNo");

-- CreateIndex
CREATE UNIQUE INDEX "awards_applicationId_key" ON "awards"("applicationId");

-- CreateIndex
CREATE INDEX "awards_athleteUserId_idx" ON "awards"("athleteUserId");

-- CreateIndex
CREATE INDEX "awards_universityId_status_idx" ON "awards"("universityId", "status");

-- CreateIndex
CREATE INDEX "awards_status_idx" ON "awards"("status");

-- CreateIndex
CREATE INDEX "awards_grantDate_idx" ON "awards"("grantDate");

-- CreateIndex
CREATE INDEX "award_years_status_dueDate_idx" ON "award_years"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "award_years_awardId_yearNumber_key" ON "award_years"("awardId", "yearNumber");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_notes" ADD CONSTRAINT "application_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_years" ADD CONSTRAINT "award_years_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "awards"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One live application per athlete per program (enforced by the database, not just the code).
-- Rejected / withdrawn / expired applications do not block re-applying.
CREATE UNIQUE INDEX "applications_one_live_per_program"
  ON "applications" ("athleteUserId", "programId")
  WHERE "status" NOT IN ('REJECTED', 'UNIVERSITY_REJECTED', 'WITHDRAWN', 'EXPIRED');

-- At most one live scholarship per athlete.
CREATE UNIQUE INDEX "awards_one_live_per_athlete"
  ON "awards" ("athleteUserId")
  WHERE "status" IN ('PENDING_SIGNATURE', 'ACTIVE', 'RENEWAL_DUE', 'SUSPENDED');
