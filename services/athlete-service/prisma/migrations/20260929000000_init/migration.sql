-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "athlete_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "athleteNumber" SERIAL NOT NULL,
    "athleteCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "firstName" TEXT,
    "lastName" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "profilePhotoDocumentId" UUID,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'India',
    "guardianName" TEXT,
    "guardianRelation" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "stepsCompleted" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" UUID,
    "reviewRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_records" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "level" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "boardOrUniversity" TEXT,
    "stream" TEXT,
    "degree" TEXT,
    "major" TEXT,
    "yearOfPassing" INTEGER,
    "isExpectedYear" BOOLEAN NOT NULL DEFAULT false,
    "scoreType" TEXT,
    "scoreValue" TEXT,
    "certificateDocumentId" UUID,

    CONSTRAINT "academic_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports_profiles" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "primarySport" TEXT NOT NULL,
    "currentClub" TEXT,
    "coachName" TEXT,
    "coachContact" TEXT,
    "yearsOfTraining" INTEGER,
    "heightCm" DECIMAL(5,1),
    "weightKg" DECIMAL(5,1),
    "wingspanCm" DECIMAL(5,1),
    "chestCm" DECIMAL(5,1),
    "waistCm" DECIMAL(5,1),
    "bodyFatPct" DECIMAL(4,1),
    "fitnessLevel" TEXT,
    "rankingLevel" TEXT,
    "rankingValue" TEXT,
    "ageGroup" TEXT,
    "bestPerformance" TEXT,
    "medalsGold" INTEGER NOT NULL DEFAULT 0,
    "medalsSilver" INTEGER NOT NULL DEFAULT 0,
    "medalsBronze" INTEGER NOT NULL DEFAULT 0,
    "internationalParticipation" BOOLEAN NOT NULL DEFAULT false,
    "internationalDetails" TEXT,
    "previousInjuries" BOOLEAN NOT NULL DEFAULT false,
    "injuryDetails" TEXT,
    "recoveryStatus" TEXT,
    "medicalClearanceDocumentId" UUID,
    "sportsIdDocumentId" UUID,
    "coachCertificationDocumentId" UUID,

    CONSTRAINT "sports_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_documents" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "documentId" UUID NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_references" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "relationship" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "certificationDocumentId" UUID,

    CONSTRAINT "athlete_references_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "athlete_profiles_userId_key" ON "athlete_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_profiles_athleteNumber_key" ON "athlete_profiles"("athleteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_profiles_athleteCode_key" ON "athlete_profiles"("athleteCode");

-- CreateIndex
CREATE INDEX "athlete_profiles_status_idx" ON "athlete_profiles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "academic_records_profileId_level_key" ON "academic_records"("profileId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "sports_profiles_profileId_key" ON "sports_profiles"("profileId");

-- CreateIndex
CREATE INDEX "sports_profiles_primarySport_idx" ON "sports_profiles"("primarySport");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_documents_profileId_type_key" ON "athlete_documents"("profileId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_references_profileId_position_key" ON "athlete_references"("profileId", "position");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "academic_records" ADD CONSTRAINT "academic_records_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sports_profiles" ADD CONSTRAINT "sports_profiles_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_documents" ADD CONSTRAINT "athlete_documents_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_references" ADD CONSTRAINT "athlete_references_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "athlete_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

