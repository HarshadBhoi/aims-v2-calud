/**
 * @aims/prisma-client — Public API.
 *
 * Primary exports:
 *   - createTenantPrismaClient / createAdminPrismaClient: client factories
 *   - runWithTenantContext / requireTenantContext / getTenantContext: context
 *   - TenantContextMissingError / CrossTenantViolationError: error types
 *   - Prisma: re-exported namespace (types, enums)
 *
 * See:
 *   - ADR-0002 (two-layer tenant isolation)
 *   - ADR-0005 (session revocation — SessionBlocklist model)
 *   - database/POOLING.md (pool multiplexing caveats, SET LOCAL)
 *   - VERTICAL-SLICE-PLAN.md §4 Week 1 Task 1.4
 */

export {
  createAdminPrismaClient,
  createTenantPrismaClient,
  type AdminPrismaClient,
  type TenantPrismaClient,
} from "./client";

export {
  CrossTenantViolationError,
  TenantContextMissingError,
  type TenantContext,
  getTenantContext,
  requireTenantContext,
  runWithTenantContext,
} from "./tenant-context";

// Re-export the Prisma namespace (enums, input types, utility types).
export { Prisma, PrismaClient } from "@prisma/client";
export type * from "@prisma/client";
