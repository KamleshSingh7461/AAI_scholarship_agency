-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "universities" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "website" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "universities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partnership_agreements" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "referenceNo" TEXT,
    "signedDate" DATE,
    "effectiveDate" DATE NOT NULL,
    "termYears" INTEGER,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "renewalTermYears" INTEGER,
    "noticePeriodMonths" INTEGER,
    "expiresAt" DATE,
    "universityRevenueShareBps" INTEGER,
    "companyRevenueShareBps" INTEGER,
    "agencyCommissionBps" INTEGER,
    "universityCommissionShareBps" INTEGER,
    "documentId" UUID,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partnership_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarship_allocations" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "agreementId" UUID,
    "academicYear" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "rolledOverSeats" INTEGER NOT NULL DEFAULT 0,
    "rolloverPolicy" TEXT NOT NULL DEFAULT 'FORFEIT',
    "valuationPerSeatAnnual" BIGINT,
    "valuationCurrency" TEXT NOT NULL DEFAULT 'INR',
    "transferLetterDocumentId" UUID,
    "valuationLetterDocumentId" UUID,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "forfeitedSeats" INTEGER NOT NULL DEFAULT 0,
    "rolledToAllocationId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarship_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scholarship_programs" (
    "id" UUID NOT NULL,
    "universityId" UUID NOT NULL,
    "allocationId" UUID,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scholarshipType" TEXT NOT NULL DEFAULT 'ATHLETIC',
    "coverageType" TEXT NOT NULL DEFAULT 'PARTIAL',
    "durationYears" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "intakeDate" DATE,
    "applicationOpensAt" TIMESTAMP(3),
    "applicationClosesAt" TIMESTAMP(3),
    "eligibleSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligibilityCriteria" TEXT,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "genderEligibility" TEXT NOT NULL DEFAULT 'ANY',
    "courses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "tuitionFullPerYear" BIGINT NOT NULL DEFAULT 0,
    "tuitionCoverageBps" INTEGER NOT NULL DEFAULT 10000,
    "tuitionPerYear" BIGINT NOT NULL DEFAULT 0,
    "roomPerYear" BIGINT NOT NULL DEFAULT 0,
    "foodPerYear" BIGINT NOT NULL DEFAULT 0,
    "otherPerYear" BIGINT NOT NULL DEFAULT 0,
    "otherCostsNote" TEXT,
    "tuitionBorneBy" TEXT NOT NULL DEFAULT 'UNIVERSITY',
    "roomBorneBy" TEXT NOT NULL DEFAULT 'COMPANY',
    "foodBorneBy" TEXT NOT NULL DEFAULT 'COMPANY',
    "otherBorneBy" TEXT NOT NULL DEFAULT 'STUDENT',
    "feeType" TEXT NOT NULL DEFAULT 'NONE',
    "feeFlatInr" BIGINT NOT NULL DEFAULT 0,
    "feePercentBps" INTEGER NOT NULL DEFAULT 0,
    "feePercentBase" TEXT NOT NULL DEFAULT 'TOTAL_VALUE',
    "feeMinInr" BIGINT NOT NULL DEFAULT 0,
    "feeMaxInr" BIGINT NOT NULL DEFAULT 0,
    "taxBps" INTEGER NOT NULL DEFAULT 1800,
    "feeRefundableOnRejection" BOOLEAN NOT NULL DEFAULT false,
    "commissionBps" INTEGER NOT NULL DEFAULT 800,
    "universityCommissionShareBps" INTEGER NOT NULL DEFAULT 0,
    "seatsTotal" INTEGER NOT NULL,
    "seatsReserved" INTEGER NOT NULL DEFAULT 0,
    "seatsAwarded" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarship_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seat_reservations" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HELD',
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,

    CONSTRAINT "seat_reservations_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "universities_slug_key" ON "universities"("slug");

-- CreateIndex
CREATE INDEX "partnership_agreements_universityId_type_idx" ON "partnership_agreements"("universityId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_allocations_universityId_academicYear_key" ON "scholarship_allocations"("universityId", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_programs_code_key" ON "scholarship_programs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_programs_slug_key" ON "scholarship_programs"("slug");

-- CreateIndex
CREATE INDEX "scholarship_programs_universityId_status_idx" ON "scholarship_programs"("universityId", "status");

-- CreateIndex
CREATE INDEX "scholarship_programs_status_applicationClosesAt_idx" ON "scholarship_programs"("status", "applicationClosesAt");

-- CreateIndex
CREATE UNIQUE INDEX "seat_reservations_applicationId_key" ON "seat_reservations"("applicationId");

-- CreateIndex
CREATE INDEX "seat_reservations_programId_status_idx" ON "seat_reservations"("programId", "status");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "partnership_agreements" ADD CONSTRAINT "partnership_agreements_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_allocations" ADD CONSTRAINT "scholarship_allocations_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_allocations" ADD CONSTRAINT "scholarship_allocations_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "partnership_agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_programs" ADD CONSTRAINT "scholarship_programs_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "universities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_programs" ADD CONSTRAINT "scholarship_programs_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "scholarship_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_programId_fkey" FOREIGN KEY ("programId") REFERENCES "scholarship_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

