/**
 * Request-scoped tenant context carrier (AsyncLocalStorage).
 *
 * Per ADR-0002, tenant isolation is enforced in two layers:
 *   1. This Prisma Client Extension (primary, unit-testable).
 *   2. Postgres RLS policies (defence-in-depth; task 1.5).
 *
 * Every request handler must establish a context before issuing queries:
 *
 *   import { runWithTenantContext } from "@aims/prisma-client";
 *
 *   runWithTenantContext({ tenantId, userId, sessionId }, async () => {
 *     await tenantPrisma.user.findMany(); // auto-scoped to tenantId
 *   });
 *
 * Queries without an active context throw TenantContextMissingError.
 * Cross-tenant admin operations use the admin client explicitly instead.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  readonly tenantId: string;
  readonly userId?: string;
  readonly sessionId?: string;
  /**
   * Opt-out escape hatch for platform-admin and bootstrap operations.
   * Use sparingly and with justification. Every use of this should be
   * matched by an audit-log entry recording the reason.
   */
  readonly bypassTenantScope?: boolean;
};

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Runs `fn` with the given tenant context. Nested calls override the outer
 * context for the duration of `fn`.
 *
 * Always returns a Promise so the context survives through the async chain.
 * Sync return values are wrapped.
 *
 * IMPORTANT: this function explicitly awaits `fn()` inside `storage.run` so
 * that any Prisma promises returned by `fn` are resolved while the
 * AsyncLocalStorage context is still active. A naïve sync implementation
 * (`storage.run(context, fn)`) would lose the context the moment `fn` returns
 * its thenable — the thenable would then be awaited outside the context,
 * causing the extension's `getTenantContext()` to return `undefined`.
 */
export async function runWithTenantContext<T>(
  context: TenantContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return storage.run(context, async () => fn());
}

/**
 * Returns the current tenant context, or `undefined` if none is active.
 * Non-throwing variant — use for optional-context code paths.
 */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Returns the current tenant context or throws TenantContextMissingError.
 * Use inside request-handler code paths where the context is required.
 */
export function requireTenantContext(): TenantContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new TenantContextMissingError();
  }
  return ctx;
}

export class TenantContextMissingError extends Error {
  readonly model: string | undefined;
  readonly operation: string | undefined;

  constructor(model?: string, operation?: string) {
    const suffix = model && operation ? ` (attempted: ${model}.${operation})` : "";
    super(
      "No tenant context is active." +
        suffix +
        " Every query path must run inside runWithTenantContext({ tenantId, ... }, () => ...). " +
        "For cross-tenant administrative operations, use the admin client " +
        "(createAdminPrismaClient) instead of the tenant-scoped client.",
    );
    this.name = "TenantContextMissingError";
    this.model = model;
    this.operation = operation;
  }
}

export class CrossTenantViolationError extends Error {
  readonly contextTenantId: string;
  readonly attemptedTenantId: string;
  readonly model: string;
  readonly operation: string;

  constructor(
    contextTenantId: string,
    attemptedTenantId: string,
    model: string,
    operation: string,
  ) {
    super(
      `Cross-tenant write blocked: operation ${model}.${operation} targeted ` +
        `tenantId=${attemptedTenantId} but the active context is ` +
        `tenantId=${contextTenantId}. This is a potential data-leakage bug; ` +
        `verify the data being written or use the admin client with justification.`,
    );
    this.name = "CrossTenantViolationError";
    this.contextTenantId = contextTenantId;
    this.attemptedTenantId = attemptedTenantId;
    this.model = model;
    this.operation = operation;
  }
}
