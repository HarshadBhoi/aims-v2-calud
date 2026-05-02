/**
 * Integration test for the tenant isolation extension (ADR-0002).
 *
 * Spins up a fresh Postgres container via Testcontainers, applies the Prisma
 * schema via `prisma db push`, then exercises the extension against real DB
 * queries. First run pulls postgres:16-alpine (~30s); subsequent runs cached.
 *
 * This is the single most important integration test in Slice A — if it fails,
 * tenant isolation is broken, which is a data-leakage bug.
 */

import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CrossTenantViolationError,
  TenantContextMissingError,
  createAdminPrismaClient,
  createTenantPrismaClient,
  runWithTenantContext,
} from "./index";

import type { AdminPrismaClient, TenantPrismaClient } from "./index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");

// These are assigned in beforeAll. If beforeAll fails before assignment, the
// afterAll cleanup must handle `undefined` safely — hence the explicit
// `| undefined` in the type.
let container: StartedPostgreSqlContainer | undefined;
let admin: AdminPrismaClient | undefined;
let tenant: TenantPrismaClient | undefined;

let tenant1Id: string;
let tenant2Id: string;

/** Narrows admin/tenant from `| undefined` inside test bodies. */
function requireClients(): { admin: AdminPrismaClient; tenant: TenantPrismaClient } {
  if (admin === undefined || tenant === undefined) {
    throw new Error("beforeAll did not complete — clients not initialized.");
  }
  return { admin, tenant };
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_test")
    .withUsername("test_user")
    .withPassword("test_pw")
    .start();

  const url = container.getConnectionUri();

  // Apply migrations (creates all tables + extensions + RLS policies).
  // We use migrate deploy instead of db push so the RLS migration runs.
  execSync("pnpm exec prisma migrate deploy", {
    cwd: PACKAGE_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  admin = createAdminPrismaClient({ datasources: { db: { url } } });
  tenant = createTenantPrismaClient({ datasources: { db: { url } } });

  // Seed two tenants via admin client.
  const t1 = await admin.tenant.create({ data: { slug: "t1", name: "Tenant One" } });
  const t2 = await admin.tenant.create({ data: { slug: "t2", name: "Tenant Two" } });
  tenant1Id = t1.id;
  tenant2Id = t2.id;
}, 180_000);

afterAll(async () => {
  await admin?.$disconnect();
  await container?.stop();
});

describe("tenant isolation extension", () => {
  it("throws TenantContextMissingError when querying without context", async () => {
    const { tenant } = requireClients();
    await expect(tenant.user.findMany()).rejects.toThrow(TenantContextMissingError);
  });

  it("findMany returns only rows for the active tenant", async () => {
    const { admin, tenant } = requireClients();

    // Seed directly via admin to bypass scoping.
    await admin.user.create({
      data: { tenantId: tenant1Id, email: "alice@t1.test", name: "Alice", role: "Staff" },
    });
    await admin.user.create({
      data: { tenantId: tenant2Id, email: "bob@t2.test", name: "Bob", role: "Staff" },
    });

    const t1Users = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.user.findMany(),
    );

    expect(t1Users.length).toBeGreaterThanOrEqual(1);
    expect(t1Users.every((u) => u.tenantId === tenant1Id)).toBe(true);
    expect(t1Users.some((u) => u.email === "alice@t1.test")).toBe(true);
    expect(t1Users.some((u) => u.email === "bob@t2.test")).toBe(false);
  });

  it("create auto-injects tenantId from the context", async () => {
    const { tenant } = requireClients();

    const user = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.user.create({
        // @ts-expect-error — tenantId intentionally omitted. Prisma's generated
        // types require it, but the whole point of this test is to prove the
        // extension auto-injects it at runtime. The extension's runtime rewrite
        // is invisible to the TypeScript compiler.
        data: { email: "carol@t1.test", name: "Carol", role: "Senior" },
      }),
    );

    expect(user.tenantId).toBe(tenant1Id);
  });

  it("rejects create when explicit tenantId mismatches the context", async () => {
    const { tenant } = requireClients();

    await expect(
      runWithTenantContext({ tenantId: tenant1Id }, () =>
        tenant.user.create({
          data: {
            tenantId: tenant2Id,
            email: "dave@t1.test",
            name: "Dave",
            role: "Staff",
          },
        }),
      ),
    ).rejects.toThrow(CrossTenantViolationError);
  });

  it("findUnique respects tenant scope (returns null for other tenants' rows)", async () => {
    const { admin, tenant } = requireClients();

    const created = await admin.user.create({
      data: { tenantId: tenant1Id, email: "eve@t1.test", name: "Eve", role: "Staff" },
    });

    const sameTenantResult = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.user.findUnique({ where: { id: created.id } }),
    );
    expect(sameTenantResult).not.toBeNull();
    expect(sameTenantResult?.id).toBe(created.id);

    const otherTenantResult = await runWithTenantContext({ tenantId: tenant2Id }, () =>
      tenant.user.findUnique({ where: { id: created.id } }),
    );
    expect(otherTenantResult).toBeNull();
  });

  it("updateMany on another tenant's rows is a no-op (0 affected)", async () => {
    const { admin, tenant } = requireClients();

    const target = await admin.user.create({
      data: { tenantId: tenant2Id, email: "frank@t2.test", name: "Frank", role: "Staff" },
    });

    const result = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.user.updateMany({
        where: { id: target.id },
        data: { name: "HIJACKED" },
      }),
    );

    expect(result.count).toBe(0);

    const reread = await admin.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(reread.name).toBe("Frank");
  });

  it("cross-tenant model (StandardPack) is visible to all tenants", async () => {
    const { admin, tenant } = requireClients();

    await admin.standardPack.create({
      data: {
        code: "TEST-PACK",
        version: "1.0.0",
        name: "Test Pack",
        issuingBody: "AIMS Test",
        publishedYear: 2026,
        packContent: { dummy: true },
        contentHash: "sha256:test",
      },
    });

    const fromT1 = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.standardPack.findUniqueOrThrow({
        where: { code_version: { code: "TEST-PACK", version: "1.0.0" } },
      }),
    );
    const fromT2 = await runWithTenantContext({ tenantId: tenant2Id }, () =>
      tenant.standardPack.findUniqueOrThrow({
        where: { code_version: { code: "TEST-PACK", version: "1.0.0" } },
      }),
    );

    expect(fromT1.code).toBe("TEST-PACK");
    expect(fromT2.code).toBe("TEST-PACK");
  });

  it("bypassTenantScope returns cross-tenant rows (explicit opt-out)", async () => {
    const { tenant } = requireClients();

    const users = await runWithTenantContext(
      { tenantId: tenant1Id, bypassTenantScope: true },
      () => tenant.user.findMany(),
    );

    // Should include users from both tenants.
    const uniqueTenants = new Set(users.map((u) => u.tenantId));
    expect(uniqueTenants.size).toBeGreaterThan(1);
  });

  it("count is tenant-scoped", async () => {
    const { admin, tenant } = requireClients();

    const [t1Count, t2Count, totalCount] = await Promise.all([
      runWithTenantContext({ tenantId: tenant1Id }, () => tenant.user.count()),
      runWithTenantContext({ tenantId: tenant2Id }, () => tenant.user.count()),
      admin.user.count(),
    ]);

    expect(t1Count + t2Count).toBe(totalCount);
    expect(t1Count).toBeGreaterThan(0);
    expect(t2Count).toBeGreaterThan(0);
  });

  it("Tenant model itself is scoped by id (self-tenancy)", async () => {
    const { tenant } = requireClients();

    const visibleFromT1 = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.tenant.findMany(),
    );
    expect(visibleFromT1).toHaveLength(1);
    expect(visibleFromT1[0]?.id).toBe(tenant1Id);
  });

  it("RLS blocks cross-tenant reads at the database layer (defence-in-depth)", async () => {
    const { admin } = requireClients();
    if (!container) throw new Error("Container not started.");

    // Create an aims_app role inside the test container so we can simulate what
    // happens when someone bypasses the Prisma extension with a raw connection.
    // The migration already installed RLS policies and default grants — those
    // only fire for this role once it exists, via the IF EXISTS guards in the
    // RLS migration. So we also re-apply grants here for the role we just made.
    const APP_PASSWORD = "test_app_pw";
    await admin.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_app') THEN
          CREATE ROLE aims_app WITH LOGIN NOINHERIT PASSWORD '${APP_PASSWORD}';
        END IF;
      END $$;
    `);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA public TO aims_app`);
    await admin.$executeRawUnsafe(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aims_app`,
    );
    await admin.$executeRawUnsafe(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aims_app`,
    );

    // Open a raw pg connection as aims_app — completely bypassing Prisma and
    // therefore the tenant isolation extension.
    const { Client } = await import("pg");
    const appClient = new Client({
      host: container.getHost(),
      port: container.getPort(),
      user: "aims_app",
      password: APP_PASSWORD,
      database: "aims_test",
    });
    await appClient.connect();

    try {
      // Attempt 1: SELECT without setting app.current_tenant.
      // RLS policy: "tenantId" = current_setting('app.current_tenant', true).
      // current_setting returns NULL when unset. NULL = NULL is NULL (not TRUE),
      // so the policy excludes every row.
      const resultNoContext = await appClient.query<{ id: string }>(
        `SELECT id FROM public.users`,
      );
      expect(resultNoContext.rows).toHaveLength(0);

      // Attempt 2: SELECT with tenant1's context — sees only tenant1's users.
      await appClient.query(
        `SELECT set_config('app.current_tenant', $1, FALSE)`,
        [tenant1Id],
      );
      const resultT1 = await appClient.query<{ "tenantId": string }>(
        `SELECT "tenantId" FROM public.users`,
      );
      expect(resultT1.rows.length).toBeGreaterThan(0);
      expect(resultT1.rows.every((r) => r.tenantId === tenant1Id)).toBe(true);

      // Attempt 3: swap to tenant2 — see only tenant2's users (no cross-tenant leak).
      await appClient.query(
        `SELECT set_config('app.current_tenant', $1, FALSE)`,
        [tenant2Id],
      );
      const resultT2 = await appClient.query<{ "tenantId": string }>(
        `SELECT "tenantId" FROM public.users`,
      );
      expect(resultT2.rows.length).toBeGreaterThan(0);
      expect(resultT2.rows.every((r) => r.tenantId === tenant2Id)).toBe(true);

      // Attempt 4: INSERT with mismatched tenantId — WITH CHECK blocks it.
      await appClient.query(
        `SELECT set_config('app.current_tenant', $1, FALSE)`,
        [tenant1Id],
      );
      await expect(
        appClient.query(
          `INSERT INTO public.users (id, "tenantId", email, name, role, status, "failedLoginCount", "createdAt", "updatedAt")
           VALUES ('rls-hijack-attempt', $1, 'hijack@t2.test', 'Hijack', 'Staff', 'ACTIVE', 0, NOW(), NOW())`,
          [tenant2Id],
        ),
      ).rejects.toThrow(/row-level security|policy/i);
    } finally {
      await appClient.end();
    }
  });
});

/**
 * Tenant isolation for the Slice B `EngagementStrictness` model — Day 1
 * acceptance covers schema + RLS only; later days exercise the resolver
 * write path that populates this table. The model is added to
 * TENANT_SCOPED_MODELS in prisma-extension.ts and gets the standard
 * tenant_isolation policy in the migration.
 *
 * Per ADR-0011's threats section: explicit positive (admin sees across)
 * and negative (app blocked at DB layer) tests are required.
 */
describe("engagement strictness — tenant isolation (slice B day 1)", () => {
  // Helpers — create the FK chain (User → Engagement) the strictness row
  // depends on, scoped to a given tenant. Returns the engagement id.
  async function seedEngagement(
    tenantId: string,
    suffix: string,
  ): Promise<string> {
    const { admin } = requireClients();
    const lead = await admin.user.create({
      data: {
        tenantId,
        email: `lead-${suffix}@${tenantId}.test`,
        name: `Lead ${suffix}`,
        role: "Senior",
      },
    });
    const eng = await admin.engagement.create({
      data: {
        tenantId,
        name: `eng-${suffix}`,
        auditeeName: `auditee-${suffix}`,
        fiscalPeriod: "FY26 Q1",
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-03-31"),
        leadUserId: lead.id,
      },
    });
    return eng.id;
  }

  const SAMPLE_DRIVEN_BY = [
    {
      rule: "retentionYears",
      value: 7,
      source: { packCode: "GAGAS", packVersion: "2024.1", direction: "max" },
    },
  ];
  const SAMPLE_DOC_REQS = {
    fourElementComplete: true,
    workPaperCitationRequired: false,
    retentionYears: 7,
  };

  it("tenant client findMany returns only rows for the active tenant", async () => {
    const { admin, tenant } = requireClients();
    const t1Eng = await seedEngagement(tenant1Id, "strictness-t1-find");
    const t2Eng = await seedEngagement(tenant2Id, "strictness-t2-find");

    await admin.engagementStrictness.createMany({
      data: [
        {
          tenantId: tenant1Id,
          engagementId: t1Eng,
          retentionYears: 7,
          coolingOffMonths: 24,
          cpeHours: 80,
          documentationRequirements: SAMPLE_DOC_REQS,
          requiredCanonicalCodes: ["CRITERIA", "CONDITION", "CAUSE", "EFFECT"],
          drivenBy: SAMPLE_DRIVEN_BY,
        },
        {
          tenantId: tenant2Id,
          engagementId: t2Eng,
          retentionYears: 5,
          coolingOffMonths: 12,
          cpeHours: 40,
          documentationRequirements: { ...SAMPLE_DOC_REQS, retentionYears: 5 },
          requiredCanonicalCodes: ["CRITERIA", "CONDITION"],
          drivenBy: [
            {
              rule: "retentionYears",
              value: 5,
              source: { packCode: "IIA", packVersion: "2024.1", direction: "max" },
            },
          ],
        },
      ],
    });

    const t1Rows = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.engagementStrictness.findMany(),
    );
    expect(t1Rows).toHaveLength(1);
    expect(t1Rows[0]?.engagementId).toBe(t1Eng);
    expect(t1Rows[0]?.retentionYears).toBe(7);
    expect(t1Rows.some((r) => r.engagementId === t2Eng)).toBe(false);
  });

  it("tenant client create auto-injects tenantId from the active context", async () => {
    const { tenant } = requireClients();
    const eng = await seedEngagement(tenant1Id, "strictness-t1-create");

    const row = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.engagementStrictness.create({
        // @ts-expect-error — tenantId omitted; the extension injects it.
        data: {
          engagementId: eng,
          retentionYears: 7,
          coolingOffMonths: 24,
          documentationRequirements: SAMPLE_DOC_REQS,
          requiredCanonicalCodes: ["CRITERIA"],
          drivenBy: SAMPLE_DRIVEN_BY,
        },
      }),
    );
    expect(row.tenantId).toBe(tenant1Id);
  });

  it("tenant client rejects create with mismatched tenantId", async () => {
    const { tenant } = requireClients();
    const eng = await seedEngagement(tenant1Id, "strictness-t1-mismatch");

    await expect(
      runWithTenantContext({ tenantId: tenant1Id }, () =>
        tenant.engagementStrictness.create({
          data: {
            tenantId: tenant2Id,
            engagementId: eng,
            retentionYears: 7,
            coolingOffMonths: 24,
            documentationRequirements: SAMPLE_DOC_REQS,
            requiredCanonicalCodes: ["CRITERIA"],
            drivenBy: SAMPLE_DRIVEN_BY,
          },
        }),
      ),
    ).rejects.toThrow(CrossTenantViolationError);
  });

  it("admin client reads across tenants (positive bypass — for the audit-log viewer per ADR-0011 threats)", async () => {
    const { admin } = requireClients();
    // Both rows from the findMany test above are still in the DB; admin
    // sees them all without a tenant context.
    const all = await admin.engagementStrictness.findMany();
    const tenants = new Set(all.map((r) => r.tenantId));
    expect(tenants.has(tenant1Id)).toBe(true);
    expect(tenants.has(tenant2Id)).toBe(true);
  });

  it("RLS blocks cross-tenant reads at the database layer (defence-in-depth)", async () => {
    const { admin } = requireClients();
    if (!container) throw new Error("Container not started.");

    // The aims_app role + grants were created by the earlier RLS test in this
    // file; we re-apply only what's specific to the new table to be safe in
    // any test ordering. (DO blocks are idempotent.)
    await admin.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'aims_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."engagement_strictness" TO aims_app;
        END IF;
      END $$;
    `);

    const { Client } = await import("pg");
    const appClient = new Client({
      host: container.getHost(),
      port: container.getPort(),
      user: "aims_app",
      password: "test_app_pw",
      database: "aims_test",
    });
    await appClient.connect();

    try {
      // No tenant context → policy excludes every row.
      const noContext = await appClient.query<{ id: string }>(
        `SELECT id FROM public.engagement_strictness`,
      );
      expect(noContext.rows).toHaveLength(0);

      // Set tenant1 context → see only tenant1's rows.
      await appClient.query(
        `SELECT set_config('app.current_tenant', $1, FALSE)`,
        [tenant1Id],
      );
      const t1Rows = await appClient.query<{ tenantId: string }>(
        `SELECT "tenantId" FROM public.engagement_strictness`,
      );
      expect(t1Rows.rows.length).toBeGreaterThan(0);
      expect(t1Rows.rows.every((r) => r.tenantId === tenant1Id)).toBe(true);

      // INSERT with mismatched tenantId → WITH CHECK blocks it.
      const eng = await seedEngagement(tenant1Id, "strictness-rls-hijack");
      await expect(
        appClient.query(
          `INSERT INTO public.engagement_strictness
             (id, "tenantId", "engagementId", "retentionYears", "coolingOffMonths",
              "documentationRequirements", "requiredCanonicalCodes", "drivenBy",
              "createdAt", "updatedAt")
           VALUES ('rls-hijack-strictness', $1, $2, 7, 24, '{}'::jsonb, ARRAY[]::TEXT[], '[]'::jsonb, NOW(), NOW())`,
          [tenant2Id, eng],
        ),
      ).rejects.toThrow(/row-level security|policy/i);
    } finally {
      await appClient.end();
    }
  });
});

describe("audit log hash chain", () => {
  type VerifyResult = {
    ok: boolean;
    broken_at: bigint | null;
    total_rows: bigint;
    reason: string;
  };

  async function verifyChain(): Promise<VerifyResult> {
    const { admin } = requireClients();
    const rows = await admin.$queryRawUnsafe<VerifyResult[]>(
      `SELECT ok, broken_at, total_rows, reason FROM audit.verify_chain()`,
    );
    if (!rows[0]) throw new Error("verify_chain() returned no rows");
    return rows[0];
  }

  it("writes an audit row for each engagement mutation (CREATE, UPDATE)", async () => {
    const { admin, tenant } = requireClients();

    // Count audit rows for this tenant before, and after each mutation.
    const beforeRows = await admin.auditLog.count({
      where: { tenantId: tenant1Id, entityType: "engagements" },
    });

    const lead = await admin.user.create({
      data: { tenantId: tenant1Id, email: "chain-lead@t1.test", name: "Chain Lead", role: "Senior" },
    });

    const engagement = await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.engagement.create({
        // @ts-expect-error — tenantId intentionally omitted; the extension
        // injects it at runtime. Prisma's generated types don't know that.
        data: {
          name: "Chain Test Engagement",
          auditeeName: "ChainCo",
          fiscalPeriod: "FY26 Q1",
          periodStart: new Date("2026-01-01"),
          periodEnd: new Date("2026-03-31"),
          leadUserId: lead.id,
        },
      }),
    );

    await runWithTenantContext({ tenantId: tenant1Id }, () =>
      tenant.engagement.update({
        where: { id: engagement.id },
        data: { name: "Chain Test Engagement (renamed)" },
      }),
    );

    const afterRows = await admin.auditLog.count({
      where: { tenantId: tenant1Id, entityType: "engagements" },
    });

    // One CREATE + one UPDATE row.
    expect(afterRows - beforeRows).toBeGreaterThanOrEqual(2);
  });

  it("chain verifies after normal mutations", async () => {
    const result = await verifyChain();
    expect(result.ok).toBe(true);
    expect(result.total_rows).toBeGreaterThan(0n);
  });

  it("detects a tampered row (content_hash mismatch)", async () => {
    const { admin } = requireClients();

    // Pick any audit row and tamper with its afterData.
    const target = await admin.auditLog.findFirst({
      where: { entityType: "engagements" },
      orderBy: { chainPosition: "asc" },
    });
    if (!target) throw new Error("no audit rows to tamper with");

    const originalAfter = target.afterData;

    // Note: matching by id alone — the PK is (id, loggedAt) for partitioning,
    // but id is a UUID (gen_random_uuid in the trigger), effectively unique
    // on its own. Date.toISOString() can't round-trip timestamptz's microsecond
    // precision, so loggedAt equality would miss the row.
    const tamperedCount = await admin.$executeRawUnsafe<number>(
      `UPDATE audit.audit_log SET "afterData" = '{"tampered":true}'::jsonb WHERE "id" = $1`,
      target.id,
    );
    expect(tamperedCount).toBe(1);

    const tampered = await verifyChain();
    expect(tampered.ok).toBe(false);
    expect(tampered.broken_at).toBe(target.chainPosition);
    expect(tampered.reason).toMatch(/content_hash mismatch/);

    // Restore.
    await admin.$executeRawUnsafe(
      `UPDATE audit.audit_log SET "afterData" = $1::jsonb WHERE "id" = $2`,
      JSON.stringify(originalAfter),
      target.id,
    );

    const restored = await verifyChain();
    expect(restored.ok).toBe(true);
  });

  it("detects a broken chain link (previous_hash mismatch)", async () => {
    const { admin } = requireClients();

    // Grab the last two chain rows — tamper with the earlier row's content_hash
    // directly (not via verify_chain recompute). This should make the NEXT row's
    // previousHash not match.
    const rows = await admin.auditLog.findMany({
      orderBy: { chainPosition: "desc" },
      take: 2,
    });
    if (rows.length < 2) throw new Error("need at least 2 audit rows to test link mismatch");

    const earlier = rows[1];
    const later = rows[0];
    if (!earlier || !later) throw new Error("unexpected rows shape");

    const originalContentHash = earlier.contentHash;

    // Directly corrupt the earlier row's stored content_hash (not its data).
    // This row's content still hashes to originalContentHash when recomputed,
    // so the content_hash check fails at the earlier row.
    const mutationCount = await admin.$executeRawUnsafe<number>(
      `UPDATE audit.audit_log SET "contentHash" = $1 WHERE "id" = $2`,
      "deadbeef".repeat(8), // wrong but valid-shaped hash
      earlier.id,
    );
    expect(mutationCount).toBe(1);

    const broken = await verifyChain();
    expect(broken.ok).toBe(false);
    expect(broken.broken_at).toBe(earlier.chainPosition);

    // Restore.
    await admin.$executeRawUnsafe(
      `UPDATE audit.audit_log SET "contentHash" = $1 WHERE "id" = $2`,
      originalContentHash,
      earlier.id,
    );

    const restored = await verifyChain();
    expect(restored.ok).toBe(true);
  });
});
