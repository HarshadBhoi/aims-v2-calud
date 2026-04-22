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

  // Push schema (creates all tables, extensions, schemas without migration history).
  execSync("pnpm exec prisma db push --accept-data-loss --skip-generate", {
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
});
