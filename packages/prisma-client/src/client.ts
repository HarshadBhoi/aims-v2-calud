/**
 * Prisma client factories.
 *
 * Two distinct clients, intentionally separate:
 *
 *   createTenantPrismaClient() — returns a client with tenant isolation applied.
 *     Requires an active TenantContext for every query. Use for ~99% of app code.
 *
 *   createAdminPrismaClient()  — returns an unmodified PrismaClient.
 *     Bypasses tenant scoping entirely. Use only for:
 *       - Auth bootstrap: looking up a session by tokenHash before the tenant
 *         is known (chicken-and-egg).
 *       - Platform-admin operations (support mode, break-glass) that cross
 *         tenant boundaries by design, per ADR-0005.
 *       - System tasks (cleanup jobs, scheduled maintenance).
 *     Every use of the admin client should be paired with an audit-log entry.
 */

import { PrismaClient, type Prisma } from "@prisma/client";

import { tenantIsolationExtension } from "./prisma-extension";

/** The concrete type of a tenant-scoped client. */
export type TenantPrismaClient = ReturnType<typeof createTenantPrismaClient>;

/** The concrete type of the admin client (raw Prisma, no extension). */
export type AdminPrismaClient = PrismaClient;

export function createTenantPrismaClient(options?: Prisma.PrismaClientOptions) {
  const base = new PrismaClient(options);
  return base.$extends(tenantIsolationExtension);
}

export function createAdminPrismaClient(options?: Prisma.PrismaClientOptions): AdminPrismaClient {
  return new PrismaClient(options);
}
