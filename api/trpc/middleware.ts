/**
 * tRPC Middleware Stack
 *
 * Composable middleware for cross-cutting concerns. Applied to procedures
 * via `.use(middleware)` chains.
 *
 * Order matters. Recommended order for authenticated procedures:
 *   1. requestLogging     — bind logger, log start/end
 *   2. tenantContext      — set RLS session variables
 *   3. authRequired       — ensure auth.user present
 *   4. mfaRequired        — ensure MFA verified (if tenant policy)
 *   5. rateLimitCheck     — check rate limits
 *   6. idempotencyCheck   — short-circuit if key seen before (mutations only)
 *   7. requirePermission  — RBAC check
 *   8. auditRequest       — log to audit_log (select mutations)
 *
 * Procedure helpers in `procedures.ts` compose these for common cases:
 *   - publicProcedure       → logging only
 *   - authedProcedure       → logging + tenant + auth + mfa + ratelimit + idempotency
 *   - adminProcedure        → authed + requireRole('ADMIN')
 *   - platformProcedure     → authed + isSuperadmin check
 */

import { TRPCError, initTRPC } from '@trpc/server';
import { ZodError } from 'zod';
import superjson from 'superjson';
import type { Context, AuthedContext } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Expose Zod validation issues in structured form
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
        // Preserve our AppErrorCode where applicable
        appCode: (error.cause as { code?: string })?.code ?? null,
      },
    };
  },
});

export const middleware = t.middleware;
export const router = t.router;
export const procedure = t.procedure;

// =============================================================================
// 1. REQUEST LOGGING
// =============================================================================

export const requestLogging = middleware(async ({ ctx, path, type, next }) => {
  const start = Date.now();

  // Bind path/type to context for downstream middleware
  const enrichedCtx = { ...ctx, path, type };

  enrichedCtx.logger.info({ path, type }, 'Request started');

  try {
    const result = await next({ ctx: enrichedCtx });
    enrichedCtx.logger.info(
      { duration_ms: Date.now() - start, status: 'ok' },
      'Request completed',
    );
    return result;
  } catch (err) {
    enrichedCtx.logger.error(
      { err, duration_ms: Date.now() - start, status: 'error' },
      'Request failed',
    );
    throw err;
  }
});

// =============================================================================
// 2. TENANT CONTEXT (RLS)
// =============================================================================

export const tenantContext = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    // No tenant context without auth; skip
    return next();
  }

  // Set PostgreSQL session variables so RLS policies filter by tenant
  // Must be in a transaction (SET LOCAL) for PgBouncer compatibility
  await ctx.prisma.$executeRawUnsafe(`
    SET LOCAL app.current_tenant_id = '${ctx.auth.tenantId.replace(/'/g, "''")}';
    SET LOCAL app.current_user_id = '${ctx.auth.userId.replace(/'/g, "''")}';
    SET LOCAL app.is_superadmin = '${ctx.auth.isSuperadmin ? 'true' : 'false'}';
  `);

  return next();
});

// =============================================================================
// 3. AUTH REQUIRED
// =============================================================================

export const authRequired = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
      cause: { code: 'UNAUTHENTICATED' },
    });
  }

  // Narrow type: downstream can rely on ctx.auth being non-null
  return next({ ctx: ctx as AuthedContext });
});

// =============================================================================
// 4. MFA REQUIRED
// =============================================================================

export const mfaRequired = middleware(async ({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  // Check tenant policy (cached in feature flags)
  const requiresMfa = ctx.features.has('require_mfa');

  if (requiresMfa && !ctx.auth.mfaVerified) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'MFA verification required',
      cause: { code: 'MFA_REQUIRED' },
    });
  }

  return next();
});

// =============================================================================
// 5. RATE LIMIT CHECK
// =============================================================================

export const rateLimitCheck = (options: {
  scope: 'user' | 'tenant' | 'ip';
  limit: number;
  windowSeconds: number;
}) =>
  middleware(async ({ ctx, path, next }) => {
    const identifier =
      options.scope === 'user'
        ? ctx.auth?.userId ?? ctx.ipAddress
        : options.scope === 'tenant'
          ? ctx.auth?.tenantId ?? ctx.ipAddress
          : ctx.ipAddress;

    if (!identifier) return next();

    const key = `ratelimit:${options.scope}:${identifier}:${path}`;
    const current = await ctx.redis.incr(key);

    if (current === 1) {
      await ctx.redis.expire(key, options.windowSeconds);
    }

    const ttl = await ctx.redis.ttl(key);

    if (current > options.limit) {
      if (ctx.res) {
        ctx.res.setHeader('Retry-After', String(ttl));
        ctx.res.setHeader('X-RateLimit-Limit', String(options.limit));
        ctx.res.setHeader('X-RateLimit-Remaining', '0');
        ctx.res.setHeader('X-RateLimit-Reset', String(Date.now() / 1000 + ttl));
      }
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded',
        cause: {
          code: 'TOO_MANY_REQUESTS',
          limit: options.limit,
          windowSeconds: options.windowSeconds,
          retryAfterSeconds: ttl,
        },
      });
    }

    // Propagate rate limit headers
    if (ctx.res) {
      ctx.res.setHeader('X-RateLimit-Limit', String(options.limit));
      ctx.res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.limit - current)));
      ctx.res.setHeader('X-RateLimit-Reset', String(Date.now() / 1000 + ttl));
    }

    return next();
  });

// =============================================================================
// 6. IDEMPOTENCY CHECK (mutations only)
// =============================================================================

export const idempotencyCheck = middleware(async ({ ctx, type, path, next, getRawInput }) => {
  // Only applies to mutations
  if (type !== 'mutation') return next();

  const idempotencyKey = ctx.req?.headers['idempotency-key'] as string | undefined;
  if (!idempotencyKey) return next();

  // Validate key format (ULID or similar: 26 alphanumeric chars)
  if (!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(idempotencyKey)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Invalid Idempotency-Key format (expected ULID)',
      cause: { code: 'BAD_REQUEST' },
    });
  }

  if (!ctx.auth) return next();

  const input = await getRawInput();
  const inputHash = hashInput(input);

  // Look up existing key
  const existing = await ctx.prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    // Verify same tenant+user
    if (existing.tenantId !== ctx.auth.tenantId || existing.userId !== ctx.auth.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Idempotency key belongs to another user/tenant',
        cause: { code: 'FORBIDDEN' },
      });
    }

    // Verify same endpoint
    if (existing.endpoint !== path) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Idempotency key already used on a different endpoint',
        cause: { code: 'IDEMPOTENCY_KEY_CONFLICT' },
      });
    }

    // Verify same input (prevent replay with different payload)
    if ((existing.responseBody as { __inputHash?: string })?.__inputHash !== inputHash) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Idempotency key already used with different payload',
        cause: { code: 'IDEMPOTENCY_KEY_CONFLICT' },
      });
    }

    // Return stored response
    ctx.logger.info({ idempotency_key: idempotencyKey }, 'Idempotent replay');
    return { ok: true, data: (existing.responseBody as { data: unknown }).data, marker: 'next' as const };
  }

  // Process request
  const result = await next();

  // Store response
  await ctx.prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      tenantId: ctx.auth.tenantId,
      userId: ctx.auth.userId,
      endpoint: path,
      responseStatus: 200,
      responseBody: { data: result, __inputHash: inputHash },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  return result;
});

function hashInput(input: unknown): string {
  const canonical = JSON.stringify(input, Object.keys(input as object ?? {}).sort());
  // Lightweight hash — not cryptographic, just collision-resistant for payload comparison
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    hash = (hash << 5) - hash + canonical.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// =============================================================================
// 7. REQUIRE PERMISSION (RBAC)
// =============================================================================

export const requirePermission = (...permissions: string[]) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.auth) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    const hasAny = permissions.some((p) => ctx.auth!.permissions.has(p));

    if (!hasAny) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Requires one of: ${permissions.join(', ')}`,
        cause: {
          code: 'UNAUTHORIZED',
          requiredPermissions: permissions,
          userPermissions: Array.from(ctx.auth.permissions),
        },
      });
    }

    return next();
  });

export const requireRole = (...roles: string[]) =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.auth) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    if (!roles.includes(ctx.auth.userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Requires role: ${roles.join(' or ')}`,
        cause: { code: 'UNAUTHORIZED' },
      });
    }

    return next();
  });

export const requireSuperadmin = middleware(async ({ ctx, next }) => {
  if (!ctx.auth?.isSuperadmin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Platform operator only',
      cause: { code: 'FORBIDDEN' },
    });
  }
  return next();
});

// =============================================================================
// 8. AUDIT REQUEST (explicit for sensitive ops)
// =============================================================================

/**
 * Most audit logging happens via DB triggers. This middleware adds
 * human-readable summaries for specific sensitive operations.
 */
export const auditRequest = (
  getSummary: (input: unknown) => string | Promise<string>,
) =>
  middleware(async ({ ctx, path, next, getRawInput }) => {
    const result = await next();

    if (ctx.auth) {
      try {
        const input = await getRawInput();
        const summary = await getSummary(input);

        await ctx.prisma.auditLog.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: ctx.auth.tenantId,
            userId: ctx.auth.userId,
            action: 'CREATE',  // Override per path if needed
            entityType: path.split('.')[0],
            changesSummary: summary,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
        });
      } catch (err) {
        // Audit logging failure must not break the operation
        ctx.logger.error({ err }, 'Audit log write failed');
      }
    }

    return result;
  });

// =============================================================================
// 9. OPTIMISTIC CONCURRENCY HELPER
// =============================================================================

/**
 * Extract version from input and set up concurrency check.
 * Usage: pass `version` field to Prisma update's `where` clause.
 */
export function requireVersion<T extends { version: number }>(input: T): number {
  if (typeof input.version !== 'number' || input.version < 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'version field is required for update',
      cause: { code: 'VALIDATION_FAILED' },
    });
  }
  return input.version;
}

/**
 * Verify update affected a row. If not, distinguish CONFLICT from NOT_FOUND.
 */
export async function assertUpdateAffected<T>(
  ctx: AuthedContext,
  result: { count: number },
  fallbackFetch: () => Promise<T | null>,
  resourceType: string,
  id: string,
): Promise<void> {
  if (result.count === 0) {
    const current = await fallbackFetch();
    if (!current) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `${resourceType} not found`,
        cause: { code: 'NOT_FOUND', resourceType, resourceId: id },
      });
    }
    throw new TRPCError({
      code: 'CONFLICT',
      message: `${resourceType} has been modified. Please reload.`,
      cause: {
        code: 'CONFLICT',
        resourceType,
        resourceId: id,
        currentVersion: (current as { _version?: number })._version,
      },
    });
  }
}
