-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "audit";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "public"."EngagementStatus" AS ENUM ('PLANNING', 'FIELDWORK', 'REPORTING', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."FindingStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "public"."FindingClassification" AS ENUM ('MINOR', 'SIGNIFICANT', 'MATERIAL', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED');

-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "platform"."standard_packs" (
    "code" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuingBody" TEXT NOT NULL,
    "publishedYear" INTEGER NOT NULL,
    "packContent" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "standard_packs_pkey" PRIMARY KEY ("code","version")
);

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "name" TEXT NOT NULL,
    "title" TEXT,
    "passwordHash" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "role" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMPTZ(6),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."mfa_secrets" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretCipher" BYTEA NOT NULL,
    "backupCodesCipher" BYTEA,
    "algorithm" TEXT NOT NULL DEFAULT 'TOTP',
    "digits" INTEGER NOT NULL DEFAULT 6,
    "period" INTEGER NOT NULL DEFAULT 30,
    "verifiedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "mfaFreshUntil" TIMESTAMPTZ(6),
    "ipAddress" INET,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."session_blocklist" (
    "tokenHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reason" TEXT,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_blocklist_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "public"."engagements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "auditeeName" TEXT NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "plannedHours" INTEGER,
    "status" "public"."EngagementStatus" NOT NULL DEFAULT 'PLANNING',
    "leadUserId" TEXT NOT NULL,
    "packStrategyLocked" BOOLEAN NOT NULL DEFAULT false,
    "_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pack_attachments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "packCode" TEXT NOT NULL,
    "packVersion" TEXT NOT NULL,
    "attachedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attachedBy" TEXT NOT NULL,

    CONSTRAINT "pack_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."findings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "findingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "classification" "public"."FindingClassification" NOT NULL DEFAULT 'SIGNIFICANT',
    "elementValuesCipher" BYTEA,
    "elementsComplete" INTEGER NOT NULL DEFAULT 0,
    "status" "public"."FindingStatus" NOT NULL DEFAULT 'DRAFT',
    "validFrom" DATE,
    "validTo" DATE,
    "transactionFrom" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionTo" TIMESTAMPTZ(6),
    "authorId" TEXT NOT NULL,
    "lockedAt" TIMESTAMPTZ(6),
    "lockedBy" TEXT,
    "_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."approval_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "approverSessionId" TEXT,
    "decision" TEXT,
    "decisionComment" TEXT,
    "decidedAt" TIMESTAMPTZ(6),
    "findingId" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" TEXT NOT NULL,
    "_version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_versions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "versionNumber" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "contentCipher" BYTEA NOT NULL,
    "contentHash" TEXT,
    "pdfS3Key" TEXT,
    "pdfRenderedAt" TIMESTAMPTZ(6),
    "signedBy" TEXT,
    "signedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit"."audit_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "sessionId" TEXT,
    "ipAddress" INET,
    "userAgent" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "changesSummary" TEXT,
    "previousHash" TEXT,
    "contentHash" TEXT NOT NULL,
    "chainPosition" BIGSERIAL NOT NULL,
    "loggedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id","loggedAt")
);

-- CreateTable
CREATE TABLE "audit"."outbox_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(6),
    "sqsMessageId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standard_packs_code_idx" ON "platform"."standard_packs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "public"."tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "public"."tenants"("status");

-- CreateIndex
CREATE INDEX "users_tenantId_status_idx" ON "public"."users"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenantId_email_key" ON "public"."users"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_secrets_userId_key" ON "public"."mfa_secrets"("userId");

-- CreateIndex
CREATE INDEX "mfa_secrets_tenantId_idx" ON "public"."mfa_secrets"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "public"."sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_tenantId_userId_idx" ON "public"."sessions"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "sessions_familyId_idx" ON "public"."sessions"("familyId");

-- CreateIndex
CREATE INDEX "sessions_expiresAt_idx" ON "public"."sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "session_blocklist_tenantId_idx" ON "public"."session_blocklist"("tenantId");

-- CreateIndex
CREATE INDEX "session_blocklist_expiresAt_idx" ON "public"."session_blocklist"("expiresAt");

-- CreateIndex
CREATE INDEX "engagements_tenantId_status_idx" ON "public"."engagements"("tenantId", "status");

-- CreateIndex
CREATE INDEX "engagements_tenantId_leadUserId_idx" ON "public"."engagements"("tenantId", "leadUserId");

-- CreateIndex
CREATE INDEX "pack_attachments_tenantId_idx" ON "public"."pack_attachments"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "pack_attachments_engagementId_packCode_packVersion_key" ON "public"."pack_attachments"("engagementId", "packCode", "packVersion");

-- CreateIndex
CREATE INDEX "findings_tenantId_engagementId_status_idx" ON "public"."findings"("tenantId", "engagementId", "status");

-- CreateIndex
CREATE INDEX "findings_tenantId_authorId_idx" ON "public"."findings"("tenantId", "authorId");

-- CreateIndex
CREATE INDEX "findings_tenantId_transactionFrom_transactionTo_idx" ON "public"."findings"("tenantId", "transactionFrom", "transactionTo");

-- CreateIndex
CREATE UNIQUE INDEX "findings_tenantId_engagementId_findingNumber_key" ON "public"."findings"("tenantId", "engagementId", "findingNumber");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_status_targetType_idx" ON "public"."approval_requests"("tenantId", "status", "targetType");

-- CreateIndex
CREATE INDEX "approval_requests_tenantId_approverId_status_idx" ON "public"."approval_requests"("tenantId", "approverId", "status");

-- CreateIndex
CREATE INDEX "approval_requests_findingId_idx" ON "public"."approval_requests"("findingId");

-- CreateIndex
CREATE INDEX "reports_tenantId_engagementId_idx" ON "public"."reports"("tenantId", "engagementId");

-- CreateIndex
CREATE INDEX "reports_tenantId_status_idx" ON "public"."reports"("tenantId", "status");

-- CreateIndex
CREATE INDEX "report_versions_tenantId_reportId_idx" ON "public"."report_versions"("tenantId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "report_versions_reportId_versionNumber_key" ON "public"."report_versions"("reportId", "versionNumber");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_entityType_entityId_loggedAt_idx" ON "audit"."audit_log"("tenantId", "entityType", "entityId", "loggedAt");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_userId_loggedAt_idx" ON "audit"."audit_log"("tenantId", "userId", "loggedAt");

-- CreateIndex
CREATE INDEX "audit_log_chainPosition_idx" ON "audit"."audit_log"("chainPosition");

-- CreateIndex
CREATE INDEX "outbox_events_tenantId_idx" ON "audit"."outbox_events"("tenantId");

-- CreateIndex
CREATE INDEX "outbox_events_publishedAt_idx" ON "audit"."outbox_events"("publishedAt");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mfa_secrets" ADD CONSTRAINT "mfa_secrets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."engagements" ADD CONSTRAINT "engagements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."engagements" ADD CONSTRAINT "engagements_leadUserId_fkey" FOREIGN KEY ("leadUserId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pack_attachments" ADD CONSTRAINT "pack_attachments_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "public"."engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pack_attachments" ADD CONSTRAINT "pack_attachments_packCode_packVersion_fkey" FOREIGN KEY ("packCode", "packVersion") REFERENCES "platform"."standard_packs"("code", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."findings" ADD CONSTRAINT "findings_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "public"."engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."findings" ADD CONSTRAINT "findings_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."approval_requests" ADD CONSTRAINT "approval_requests_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "public"."findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "public"."engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_versions" ADD CONSTRAINT "report_versions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
