/**
 * tRPC Request Context
 *
 * Created per request. Contains everything procedures need to execute safely:
 * - Tenant and user identity (from authenticated JWT)
 * - Database client (with RLS session variables set)
 * - Logger (with request context bound)
 * - Queue clients (BullMQ)
 * - Cache client (Redis)
 * - Feature flags (resolved for this tenant)
 */

import type { inferAsyncReturnType } from '@trpc/server';
import type { CreateNextContextOptions } from '@trpc/server/adapters/next';
import type { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';
import type { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { verifyJwt } from '../auth/jwt';
import { ulid } from 'ulid';

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * User identity claims resolved from JWT.
 * null when request is unauthenticated.
 */
export interface AuthContext {
  userId: string;
  tenantId: string;
  sessionId: string;
  userRole: string;         // Primary role code (e.g., "ADMIN", "SENIOR_AUDITOR")
  permissions: Set<string>; // Resolved permissions (e.g., "engagement:create")
  mfaVerified: boolean;
  isSuperadmin: boolean;    // Platform operator (rare)
  impersonating?: {         // If superadmin impersonating another user for support
    originalUserId: string;
  };
}

/**
 * Full request context passed to all procedures.
 */
export interface Context {
  // Request metadata
  requestId: string;
  ipAddress?: string;
  userAgent?: string;
  path: string;       // tRPC procedure path (set by middleware)
  type: 'query' | 'mutation' | 'subscription';

  // Identity (null if unauthenticated — only publicProcedure can run)
  auth: AuthContext | null;

  // Services
  prisma: PrismaClient;
  logger: Logger;
  redis: Redis;
  queues: {
    pdf: Queue;
    email: Queue;
    webhook: Queue;
    export: Queue;
    import: Queue;
  };

  // Feature flags (evaluated per request)
  features: {
    has(flag: string): boolean;
  };

  // Raw HTTP req/res for accessing headers (Idempotency-Key, etc.)
  req?: CreateNextContextOptions['req'];
  res?: CreateNextContextOptions['res'];
}

/**
 * Helper types for authenticated procedures where auth is guaranteed.
 */
export type AuthedContext = Context & { auth: AuthContext };

// =============================================================================
// CONTEXT CREATION
// =============================================================================

interface ContextDependencies {
  prisma: PrismaClient;
  logger: Logger;
  redis: Redis;
  queues: Context['queues'];
  featureFlagService: {
    evaluate(tenantId: string | null, flag: string): boolean;
  };
}

/**
 * Factory that creates a context per HTTP request.
 * Called by the tRPC adapter.
 */
export function createContextFactory(deps: ContextDependencies) {
  return async function createContext(
    opts: CreateNextContextOptions,
  ): Promise<Context> {
    const { req, res } = opts;

    // Generate or propagate request ID (ULID for time-sortability)
    const requestId = (req.headers['x-request-id'] as string) ?? ulid();
    res.setHeader('x-request-id', requestId);

    // Resolve auth from Authorization header (Bearer JWT) or session cookie
    const auth = await resolveAuth(req, deps.prisma);

    // Bind request context to logger
    const logger = deps.logger.child({
      request_id: requestId,
      ...(auth && {
        user_id: auth.userId,
        tenant_id: auth.tenantId,
        session_id: auth.sessionId,
      }),
    });

    // Extract client metadata
    const ipAddress = extractIpAddress(req);
    const userAgent = req.headers['user-agent'] as string | undefined;

    return {
      requestId,
      ipAddress,
      userAgent,
      path: '',  // Set by middleware
      type: 'query',  // Set by middleware
      auth,
      prisma: deps.prisma,
      logger,
      redis: deps.redis,
      queues: deps.queues,
      features: {
        has(flag: string) {
          return deps.featureFlagService.evaluate(auth?.tenantId ?? null, flag);
        },
      },
      req,
      res,
    };
  };
}

export type ContextType = inferAsyncReturnType<ReturnType<typeof createContextFactory>>;

// =============================================================================
// HELPERS
// =============================================================================

async function resolveAuth(
  req: CreateNextContextOptions['req'],
  prisma: PrismaClient,
): Promise<AuthContext | null> {
  // Try Authorization: Bearer <jwt>
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies?.aims_session) {
    // Fallback to session cookie (for browser first-party requests)
    token = req.cookies.aims_session as string;
  }

  if (!token) return null;

  // Verify JWT signature and expiration
  let claims: Awaited<ReturnType<typeof verifyJwt>>;
  try {
    claims = await verifyJwt(token);
  } catch {
    return null;  // Invalid token = unauthenticated
  }

  // Load user + tenant membership + permissions
  const userTenant = await prisma.userTenant.findFirst({
    where: {
      userId: claims.sub,
      tenantId: claims.tenantId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      user: { select: { status: true } },
      tenant: { select: { status: true } },
    },
  });

  if (!userTenant) return null;
  if (userTenant.user.status !== 'ACTIVE') return null;
  if (userTenant.tenant.status !== 'active') return null;

  // Resolve permissions from role + overrides
  const permissions = await resolvePermissions(
    userTenant.role,
    Array.isArray(userTenant.permissions) ? userTenant.permissions : [],
    prisma,
  );

  return {
    userId: claims.sub,
    tenantId: claims.tenantId,
    sessionId: claims.jti,
    userRole: userTenant.role,
    permissions,
    mfaVerified: claims.mfaVerified === true,
    isSuperadmin: claims.isSuperadmin === true,
    impersonating: claims.impersonating,
  };
}

/**
 * Resolve full permission set for a role, plus any user-specific overrides.
 * Typically cached in Redis for hot paths.
 */
async function resolvePermissions(
  role: string,
  overrides: unknown[],
  _prisma: PrismaClient,
): Promise<Set<string>> {
  // TODO: Load from cached role→permission mapping (see auth/permissions.ts)
  const rolePermissions = ROLE_PERMISSIONS[role] ?? new Set<string>();
  const result = new Set(rolePermissions);

  // Apply user-specific overrides
  for (const override of overrides) {
    if (typeof override === 'string') {
      if (override.startsWith('+')) result.add(override.substring(1));
      else if (override.startsWith('-')) result.delete(override.substring(1));
    }
  }

  return result;
}

function extractIpAddress(req: CreateNextContextOptions['req']): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim();
  }
  return req.socket?.remoteAddress ?? undefined;
}

// =============================================================================
// ROLE → PERMISSION MAPPING (simplified — full version in auth/permissions.ts)
// =============================================================================

const ROLE_PERMISSIONS: Record<string, Set<string>> = {
  ADMIN: new Set([
    'tenant:manage',
    'user:manage',
    'role:manage',
    'engagement:create', 'engagement:update', 'engagement:delete', 'engagement:view_all',
    'finding:create', 'finding:update', 'finding:delete', 'finding:approve', 'finding:issue',
    'report:create', 'report:update', 'report:approve', 'report:issue',
    'workpaper:create', 'workpaper:update', 'workpaper:delete', 'workpaper:review',
    'checklist:complete', 'checklist:review',
    'pack:manage',
    'audit_log:view',
    'billing:manage',
  ]),
  DIRECTOR: new Set([
    'engagement:create', 'engagement:update', 'engagement:view_all',
    'finding:create', 'finding:update', 'finding:approve', 'finding:issue',
    'report:create', 'report:update', 'report:approve', 'report:issue',
    'workpaper:view', 'workpaper:review',
    'checklist:review',
    'audit_log:view',
  ]),
  SUPERVISOR: new Set([
    'engagement:create', 'engagement:update',
    'finding:create', 'finding:update', 'finding:approve',
    'report:create', 'report:update',
    'workpaper:view', 'workpaper:review',
    'checklist:complete', 'checklist:review',
  ]),
  SENIOR_AUDITOR: new Set([
    'engagement:view',
    'finding:create', 'finding:update',
    'report:create', 'report:update',
    'workpaper:create', 'workpaper:update',
    'checklist:complete',
  ]),
  STAFF_AUDITOR: new Set([
    'engagement:view',
    'finding:view',
    'workpaper:create', 'workpaper:update',
    'time_entry:create', 'time_entry:update',
  ]),
  QA_REVIEWER: new Set([
    'engagement:view_all',
    'finding:view',
    'report:view',
    'workpaper:review',
    'checklist:review',
    'qaip:manage',
  ]),
  AUDITEE: new Set([
    'finding:view_assigned',
    'management_response:create', 'management_response:update',
    'cap:update',
  ]),
  VIEWER: new Set([
    'engagement:view_assigned',
    'finding:view_assigned',
    'report:view_assigned',
  ]),
};
