/**
 * Seed script for AIMS v2 dev Postgres.
 *
 * Loads the minimum data needed for Slice A's user journey:
 *   - 1 Tenant (NorthStar Internal Audit)
 *   - 2 Users (Jenna Patel — Senior; David Chen — Supervisor)
 *   - 1 StandardPack (GAGAS-2024.1, minimal representation)
 *   - 1 wrapped TenantKey (proves Task 1.6 wiring end-to-end)
 *
 * Usage:
 *   pnpm -F @aims/prisma-client db:seed
 *
 * Prerequisites:
 *   - Dev Postgres up (pnpm infra:up)
 *   - LocalStack up with KMS + master key (infra bootstrap creates this)
 *   - Migrations applied (pnpm -F @aims/prisma-client db:migrate:deploy)
 *
 * This script is idempotent in effect — it wipes the business tables first,
 * then re-inserts from scratch. Preserves _prisma_migrations and the
 * StandardPack table (other than our seeded row).
 *
 * Safe to run against dev. Do NOT run against shared or production DBs.
 */

import { createHash } from "node:crypto";

import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
import { KMSClient } from "@aws-sdk/client-kms";

import { type AdminPrismaClient, createAdminPrismaClient } from "../src/index";

// ─── Configuration (read from env with dev-safe defaults) ─────────────────

const AWS_ENDPOINT_URL = process.env["AWS_ENDPOINT_URL"] ?? "http://localhost:4566";
const AWS_REGION = process.env["AWS_REGION"] ?? "us-east-1";
const AWS_KMS_MASTER_KEY_ALIAS =
  process.env["AWS_KMS_MASTER_KEY_ALIAS"] ?? "alias/aims-dev-master";

// ─── Minimal GAGAS-2024.1 pack for slice A ───────────────────────────────
// The canonical full packs live in data-model/examples/{gagas-2024,iia-gias-2024}.ts.
// For slice B we extend the slice-A subset with the fields the multi-pack
// resolver needs: independence rules (cooling-off), CPE hours, and
// semanticElementMappings (the canonical-code translation table per ADR-0010).
// Full pack-content integration is still future work.

const GAGAS_PACK = {
  code: "GAGAS",
  version: "2024.1",
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

  // GAGAS pack-element-codes are already canonical (CRITERIA / CONDITION /
  // CAUSE / EFFECT match the canonical dictionary), so all four mappings
  // are `exact`. Mirrors data-model/examples/gagas-2024.ts:1201-1224.
  semanticElementMappings: [
    { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
    { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
    { semanticCode: "CAUSE", packElementCode: "CAUSE", equivalenceStrength: "exact" },
    { semanticCode: "EFFECT", packElementCode: "EFFECT", equivalenceStrength: "exact" },
  ],

  annotationPolicy: {
    allowedDirections: ["tighten", "override_required"],
  },

  documentationRequirements: {
    fourElementComplete: true,
    workPaperCitationRequired: true,
    retentionYears: 7,
  },

  // GAGAS §3.02-3.108: 24-month cooling-off is stricter than IIA's 12.
  independenceRules: {
    coolingOffPeriodMonths: 24,
  },

  // GAGAS §4.16: 80 CPE hours per 2-year cycle, 24 in governmental subjects.
  cpeRequirements: {
    requiredHoursPerCycle: 80,
  },
};

// Slice B seeds the IIA-GIAS-2024.1 pack alongside GAGAS so multi-pack
// engagements can attach both. Mirrors data-model/examples/iia-gias-2024.ts
// at the field shape the resolver needs; the canonical full pack has more
// content not yet load-bearing in slice B.
const IIA_GIAS_PACK = {
  code: "IIA-GIAS",
  version: "2024.1",
  type: "methodology",
  name: "Global Internal Audit Standards",
  commonName: "IIA GIAS 2024",
  issuingBody: "Institute of Internal Auditors (IIA)",
  publishedYear: 2024,
  effectiveFrom: "2025-01-09",
  schemaVersion: "1.0.0",

  // IIA Standard 15.1 — the "5 Cs" finding structure: Criteria, Condition,
  // Cause (named ROOT_CAUSE here per IIA Standard 14.2), Consequence (named
  // CONSEQUENCE; mapped to canonical EFFECT), Recommendation (the 5th C,
  // inline per IIA's pack-level recommendationPresentation).
  findingElements: [
    { code: "CRITERIA", name: "Criteria", required: true, minLength: 50 },
    { code: "CONDITION", name: "Condition", required: true, minLength: 50 },
    { code: "ROOT_CAUSE", name: "Root Cause", required: true, minLength: 50 },
    { code: "CONSEQUENCE", name: "Consequence", required: true, minLength: 50 },
    { code: "RECOMMENDATION", name: "Recommendation", required: true, minLength: 50 },
  ],

  findingClassifications: [
    { code: "LOW", severity: 1 },
    { code: "MEDIUM", severity: 2 },
    { code: "HIGH", severity: 3 },
    { code: "CRITICAL", severity: 4 },
  ],

  // Five mappings, four `exact`, one `close` (RECOMMENDATION — IIA renders
  // recommendations inline as the 5th C; AIMS canonical RECOMMENDATION is
  // the same semantic slot but the rendering convention differs). Mirrors
  // data-model/examples/iia-gias-2024.ts:690-721.
  semanticElementMappings: [
    { semanticCode: "CRITERIA", packElementCode: "CRITERIA", equivalenceStrength: "exact" },
    { semanticCode: "CONDITION", packElementCode: "CONDITION", equivalenceStrength: "exact" },
    { semanticCode: "CAUSE", packElementCode: "ROOT_CAUSE", equivalenceStrength: "exact" },
    { semanticCode: "EFFECT", packElementCode: "CONSEQUENCE", equivalenceStrength: "exact" },
    { semanticCode: "RECOMMENDATION", packElementCode: "RECOMMENDATION", equivalenceStrength: "close" },
  ],

  annotationPolicy: {
    allowedDirections: ["tighten"],
  },

  documentationRequirements: {
    fourElementComplete: false, // IIA uses 5 Cs, not 4 elements
    workPaperCitationRequired: true,
    retentionYears: 5, // IIA Standard 11.4 — shorter than GAGAS's 7
  },

  // IIA Standard 6.1 — 12-month cooling-off (less strict than GAGAS).
  independenceRules: {
    coolingOffPeriodMonths: 12,
  },

  // IIA CPE is certification-driven (CIA / CRMA), not org-mandated at the
  // standard level. Pack-level value is null; tenant policy or auditor
  // certification supplies the actual hours.
  cpeRequirements: {
    requiredHoursPerCycle: null as number | null,
  },
};

function sha256Canonical(value: unknown): string {
  // Stable JSON serialization (key order matches insertion; we control the
  // input). Good enough for a content-integrity hash on the pack.
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const prisma = createAdminPrismaClient();

  try {
    console.warn("[seed] wiping business tables…");
    await wipeBusinessData(prisma);

    console.warn("[seed] seeding GAGAS-2024.1 standard pack…");
    await prisma.standardPack.create({
      data: {
        code: "GAGAS",
        version: "2024.1",
        name: "Generally Accepted Government Auditing Standards (Yellow Book)",
        issuingBody: "U.S. Government Accountability Office (GAO)",
        publishedYear: 2024,
        packContent: GAGAS_PACK,
        contentHash: `sha256:${sha256Canonical(GAGAS_PACK)}`,
      },
    });

    console.warn("[seed] seeding IIA-GIAS-2024.1 standard pack…");
    await prisma.standardPack.create({
      data: {
        code: "IIA-GIAS",
        version: "2024.1",
        name: "Global Internal Audit Standards",
        issuingBody: "Institute of Internal Auditors (IIA)",
        publishedYear: 2024,
        packContent: IIA_GIAS_PACK,
        contentHash: `sha256:${sha256Canonical(IIA_GIAS_PACK)}`,
      },
    });

    console.warn("[seed] seeding tenant NorthStar Internal Audit…");
    const tenant = await prisma.tenant.create({
      data: {
        slug: "northstar",
        name: "NorthStar Internal Audit",
        timezone: "America/New_York",
      },
    });

    console.warn("[seed] provisioning tenant DEK via KMS…");
    const kmsClient = new KMSClient({
      endpoint: AWS_ENDPOINT_URL,
      region: AWS_REGION,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });
    try {
      const encryption = createEncryptionModule({
        kmsClient,
        masterKeyArn: AWS_KMS_MASTER_KEY_ALIAS,
        dekStore: createPrismaDekStore(prisma),
      });
      await encryption.provisionTenantDek(tenant.id);
    } finally {
      kmsClient.destroy();
    }

    console.warn("[seed] seeding users (Jenna, David)…");
    await prisma.user.createMany({
      data: [
        {
          tenantId: tenant.id,
          email: "jenna@northstar.test",
          name: "Jenna Patel",
          role: "Senior",
          status: "ACTIVE",
          // passwordHash intentionally null — Task 2.1 (auth) will add a
          // set-password CLI. For now, log in via dev shortcut once wired.
          passwordHash: null,
        },
        {
          tenantId: tenant.id,
          email: "david@northstar.test",
          name: "David Chen",
          role: "Supervisor",
          status: "ACTIVE",
          passwordHash: null,
        },
      ],
    });

    console.warn("");
    console.warn("Seed complete.");
    console.warn("  Tenant:     northstar (NorthStar Internal Audit)");
    console.warn("  Users:      jenna@northstar.test · david@northstar.test");
    console.warn("  Pack:       GAGAS-2024.1");
    console.warn("  Tenant DEK: provisioned (wrapped by KMS master key)");
    console.warn("");
    console.warn("Passwords are NULL. Task 2.1 (auth) adds a set-password CLI.");
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * TRUNCATE CASCADE on the business tables. CASCADE handles FK dependencies
 * automatically; RESTART IDENTITY resets sequences (e.g., audit_log's
 * chainPosition back to 1).
 */
async function wipeBusinessData(prisma: AdminPrismaClient): Promise<void> {
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
}

await main();
