/**
 * Playwright global setup — runs once before any test starts.
 *
 * Brings the dev DB to a known state for the journey:
 *   - wipe business tables (deterministic re-runs)
 *   - seed GAGAS-2024.1 standard pack (cross-tenant)
 *   - seed e2e tenant + DEK (KMS-wrapped via LocalStack)
 *   - seed e2e user with Argon2 password hash
 *   - seed MFA secret (TOTP, ALE-encrypted) so step-up flows can complete
 *
 * Credentials live in `e2e/fixtures/credentials.ts`. The test reads the same
 * constants and signs in with the password / generates TOTP codes from the
 * known secret.
 */

import { createHash } from "node:crypto";

import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
import { createAdminPrismaClient } from "@aims/prisma-client";
import { KMSClient } from "@aws-sdk/client-kms";
import { hash } from "@node-rs/argon2";

import {
  E2E_ENGAGEMENT_AUDITEE,
  E2E_ENGAGEMENT_NAME,
  E2E_PACK_CODE,
  E2E_PACK_VERSION,
  E2E_TENANT_NAME,
  E2E_TENANT_SLUG,
  E2E_TOTP_SECRET,
  E2E_USER_EMAIL,
  E2E_USER_NAME,
  E2E_USER_PASSWORD,
  E2E_USER_ROLE,
} from "./fixtures/credentials";

const AWS_ENDPOINT_URL =
  process.env["AWS_ENDPOINT_URL"] ?? "http://localhost:4566";
const AWS_REGION = process.env["AWS_REGION"] ?? "us-east-1";
const AWS_KMS_MASTER_KEY_ALIAS =
  process.env["AWS_KMS_MASTER_KEY_ALIAS"] ?? "alias/aims-dev-master";

const ARGON2_PARAMS = {
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 1,
} as const;

/**
 * Minimal GAGAS pack — same shape `apps/api/src/packs/resolver.ts` reads.
 * Mirrors `packages/prisma-client/prisma/seed.ts` but isolated to the e2e
 * tenant slug so it doesn't fight with `pnpm db:seed`.
 */
const GAGAS_PACK = {
  code: E2E_PACK_CODE,
  version: E2E_PACK_VERSION,
  type: "methodology",
  name: "Generally Accepted Government Auditing Standards (Yellow Book)",
  commonName: "GAGAS 2024",
  issuingBody: "U.S. Government Accountability Office (GAO)",
  publishedYear: 2024,
  effectiveFrom: "2025-12-15",
  schemaVersion: "1.0.0",
  findingElements: [
    { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
    { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
    { code: "CAUSE", name: "Cause", required: true, minLength: 50 },
    { code: "EFFECT", name: "Effect", required: true, minLength: 50 },
  ],
  findingClassifications: [
    { code: "MINOR", severity: 1 },
    { code: "SIGNIFICANT", severity: 2 },
    { code: "MATERIAL", severity: 3 },
    { code: "CRITICAL", severity: 4 },
  ],
  // Slice B fields needed by the multi-pack resolver + W1 migration script.
  semanticElementMappings: [
    { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
    { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
    { semanticCode: "CAUSE", packElementCode: "CAUSE", equivalenceStrength: "exact" },
    { semanticCode: "EFFECT", packElementCode: "EFFECT", equivalenceStrength: "exact" },
  ],
  independenceRules: { coolingOffPeriodMonths: 24 },
  cpeRequirements: { requiredHoursPerCycle: 80 },
  documentationRequirements: {
    fourElementComplete: true,
    workPaperCitationRequired: true,
    retentionYears: 7,
  },
};

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// eslint-disable-next-line import/no-default-export -- Playwright globalSetup contract requires default export
export default async function globalSetup(): Promise<void> {
  // Use the migration role for admin operations (TRUNCATE across schemas,
  // RLS bypass for cross-tenant seed). Falls back to DATABASE_URL if the
  // admin URL isn't set, but in that case the e2e setup will fail with
  // permission-denied — which is the correct signal.
  const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const prisma = createAdminPrismaClient({
    datasourceUrl: adminUrl,
  });
  const kmsClient = new KMSClient({
    endpoint: AWS_ENDPOINT_URL,
    region: AWS_REGION,
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  try {
    // ─── Wipe ─────────────────────────────────────────────────────────────
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "audit"."audit_log",
        "audit"."outbox_events",
        "public"."report_versions",
        "public"."reports",
        "public"."approval_requests",
        "public"."findings",
        "public"."pack_attachments",
        "public"."mfa_secrets",
        "public"."sessions",
        "public"."session_blocklist",
        "public"."tenant_keys",
        "public"."users",
        "public"."engagements",
        "public"."tenants",
        "platform"."standard_packs"
      RESTART IDENTITY CASCADE
    `);

    // ─── Pack ─────────────────────────────────────────────────────────────
    await prisma.standardPack.create({
      data: {
        code: E2E_PACK_CODE,
        version: E2E_PACK_VERSION,
        name: GAGAS_PACK.name,
        issuingBody: GAGAS_PACK.issuingBody,
        publishedYear: GAGAS_PACK.publishedYear,
        packContent: GAGAS_PACK,
        contentHash: `sha256:${sha256Canonical(GAGAS_PACK)}`,
      },
    });

    // ─── Tenant + DEK ─────────────────────────────────────────────────────
    const tenant = await prisma.tenant.create({
      data: {
        slug: E2E_TENANT_SLUG,
        name: E2E_TENANT_NAME,
        timezone: "America/New_York",
      },
    });

    const encryption = createEncryptionModule({
      kmsClient,
      masterKeyArn: AWS_KMS_MASTER_KEY_ALIAS,
      dekStore: createPrismaDekStore(prisma),
    });
    await encryption.provisionTenantDek(tenant.id);

    // ─── User with Argon2 password hash ───────────────────────────────────
    const passwordHash = await hash(E2E_USER_PASSWORD, ARGON2_PARAMS);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: E2E_USER_EMAIL,
        name: E2E_USER_NAME,
        role: E2E_USER_ROLE,
        status: "ACTIVE",
        passwordHash,
      },
    });

    // ─── MFA secret (ALE-encrypted) ───────────────────────────────────────
    const secretCipher = await encryption.encrypt(tenant.id, E2E_TOTP_SECRET);
    const backupCodesCipher = await encryption.encryptJson(tenant.id, []);
    await prisma.mfaSecret.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        secretCipher,
        backupCodesCipher,
        verifiedAt: new Date(),
      },
    });

    // ─── Engagement + pack attachment ─────────────────────────────────────
    const engagement = await prisma.engagement.create({
      data: {
        tenantId: tenant.id,
        name: E2E_ENGAGEMENT_NAME,
        auditeeName: E2E_ENGAGEMENT_AUDITEE,
        fiscalPeriod: "FY26 Q1",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-03-31"),
        leadUserId: user.id,
      },
    });
    await prisma.packAttachment.create({
      data: {
        tenantId: tenant.id,
        engagementId: engagement.id,
        packCode: E2E_PACK_CODE,
        packVersion: E2E_PACK_VERSION,
        attachedBy: user.id,
        isPrimary: true,
      },
    });

    console.warn(
      `[e2e:global-setup] seeded tenant=${E2E_TENANT_SLUG} user=${E2E_USER_EMAIL} engagement=${engagement.id} (MFA enrolled, pack=${E2E_PACK_CODE}:${E2E_PACK_VERSION})`,
    );
  } finally {
    await prisma.$disconnect();
    kmsClient.destroy();
  }
}
