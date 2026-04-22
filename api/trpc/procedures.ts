/**
 * Procedure Builders
 *
 * Pre-composed procedure builders combining common middleware stacks.
 * Use these instead of raw `procedure` for consistency.
 */

import {
  procedure,
  requestLogging,
  tenantContext,
  authRequired,
  mfaRequired,
  rateLimitCheck,
  idempotencyCheck,
  requirePermission,
  requireRole,
  requireSuperadmin,
} from './middleware';

/**
 * Public procedure — no auth required.
 * Use for: health checks, auth endpoints (login/register), public webhooks.
 */
export const publicProcedure = procedure.use(requestLogging);

/**
 * Authenticated procedure — standard for most endpoints.
 * Stack: logging → auth → MFA → tenant RLS → rate limit → idempotency.
 */
export const authedProcedure = procedure
  .use(requestLogging)
  .use(authRequired)
  .use(mfaRequired)
  .use(tenantContext)
  .use(rateLimitCheck({ scope: 'user', limit: 100, windowSeconds: 60 }))
  .use(idempotencyCheck);

/**
 * Read-only procedure — optimized for read replica.
 * Hint to infrastructure to route to replica via ctx.readOnly flag.
 */
export const readOnlyProcedure = procedure
  .use(requestLogging)
  .use(authRequired)
  .use(mfaRequired)
  .use(tenantContext)
  .use(rateLimitCheck({ scope: 'user', limit: 200, windowSeconds: 60 }));

/**
 * Admin procedure — ADMIN role required.
 */
export const adminProcedure = authedProcedure.use(requireRole('ADMIN'));

/**
 * Director procedure — ADMIN or DIRECTOR role.
 */
export const directorProcedure = authedProcedure.use(requireRole('ADMIN', 'DIRECTOR'));

/**
 * Platform procedure — for superadmin cross-tenant operations.
 * Use with extreme care; all calls heavily audited.
 */
export const platformProcedure = procedure
  .use(requestLogging)
  .use(authRequired)
  .use(requireSuperadmin)
  .use(rateLimitCheck({ scope: 'user', limit: 60, windowSeconds: 60 }));

/**
 * Permission-gated procedure helper.
 * Usage: `permissionProcedure('engagement:create')`
 */
export const permissionProcedure = (...perms: string[]) =>
  authedProcedure.use(requirePermission(...perms));

/**
 * Expensive procedure — stricter rate limit.
 * Use for: PDF generation, bulk exports, complex reports.
 */
export const expensiveProcedure = authedProcedure.use(
  rateLimitCheck({ scope: 'user', limit: 10, windowSeconds: 60 }),
);

/**
 * Auth endpoint procedure — very strict rate limit (brute force prevention).
 */
export const authEndpointProcedure = procedure
  .use(requestLogging)
  .use(rateLimitCheck({ scope: 'ip', limit: 5, windowSeconds: 60 }));
