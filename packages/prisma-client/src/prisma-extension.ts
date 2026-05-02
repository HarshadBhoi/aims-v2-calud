/**
 * Prisma Client Extension — tenant isolation (primary enforcement per ADR-0002).
 *
 * Intercepts every operation on a tenant-scoped model and injects a scope
 * constraint sourced from the active TenantContext:
 *   - Reads: adds `tenantId = :tenantId` to the where clause
 *   - Creates: sets `data.tenantId = :tenantId`, rejects mismatches
 *   - Updates / upserts / deletes: adds `tenantId = :tenantId` to where
 *
 * Cross-tenant models (StandardPack) are exempted — they're deliberately global.
 *
 * If no tenant context is active, the extension throws. This is the safe
 * default: better to fail loudly than silently return cross-tenant data.
 *
 * NOTE on typing: the Prisma `$allOperations` callback receives args with
 * shape that depends on the model + operation at runtime. The extension API
 * types them as unknown for good reason. We treat args as opaque objects
 * and mutate via spread, preserving whatever the caller passed.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  CrossTenantViolationError,
  TenantContextMissingError,
  getTenantContext,
} from "./tenant-context";

/**
 * Models with NO tenantId — shared across tenants.
 * Currently only StandardPack (platform schema).
 */
const CROSS_TENANT_MODELS: ReadonlySet<string> = new Set(["StandardPack"]);

/**
 * Tenant itself is special: its own `id` is the "tenantId" for scoping.
 */
const TENANT_MODEL = "Tenant";

/**
 * Tenant-scoped models — must have a `tenantId` column. Slice A added 12;
 * Slice B adds `EngagementStrictness` (per ADR-0011).
 */
const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "User",
  "MfaSecret",
  "Session",
  "SessionBlocklist",
  "Engagement",
  "PackAttachment",
  "EngagementStrictness",
  "Finding",
  "ApprovalRequest",
  "Report",
  "ReportVersion",
  "AuditLog",
  "OutboxEvent",
]);

type QueryArgs = Record<string, unknown>;
type QueryFn = (args: unknown) => Promise<unknown>;

function isRecord(value: unknown): value is QueryArgs {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Prisma extension, callback form.
 *
 * We need access to the extended client so we can issue the SET LOCAL
 * (via set_config) inside the same transaction as the actual query. The
 * callback form of `defineExtension` receives the client being extended.
 */
export const tenantIsolationExtension = Prisma.defineExtension((baseClient) =>
  baseClient.$extends({
    name: "aims-tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (CROSS_TENANT_MODELS.has(model)) {
            return query(args);
          }

          if (model !== TENANT_MODEL && !TENANT_SCOPED_MODELS.has(model)) {
            throw new Error(
              `[aims-tenant-isolation] Model "${model}" is not classified as ` +
                `tenant-scoped or cross-tenant. Add it to one of the sets in ` +
                `prisma-extension.ts when you add it to the schema.`,
            );
          }

          const ctx = getTenantContext();
          if (!ctx) {
            throw new TenantContextMissingError(model, operation);
          }

          if (ctx.bypassTenantScope) {
            return query(args);
          }

          return applyTenantScope({
            model,
            operation,
            args: isRecord(args) ? args : undefined,
            query,
            tenantId: ctx.tenantId,
            client: baseClient as unknown as PrismaClient,
          });
        },
      },
    },
  }),
);

type ScopeParams = {
  readonly model: string;
  readonly operation: string;
  readonly args: QueryArgs | undefined;
  readonly query: QueryFn;
  readonly tenantId: string;
  readonly client: PrismaClient;
};

/**
 * Wraps a query so it runs inside a transaction that first sets
 * `app.current_tenant` via set_config(..., is_local=TRUE). This is the SET
 * LOCAL equivalent — scoped to the transaction — which RLS policies evaluate
 * via current_setting('app.current_tenant', true).
 *
 * set_config is transaction-local, so it can't leak across connections in a
 * pool (POOLING.md §2). The overhead is one extra roundtrip per query; for
 * Slice A this is acceptable. Pool-multiplexing concerns become interesting
 * only when we introduce PgBouncer (later slice).
 */
function runWithRls<T>(
  client: PrismaClient,
  tenantId: string,
  queryPromise: PrismaPromise<T>,
): Promise<T> {
  return client
    .$transaction([
      client.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant', $1, TRUE)`,
        tenantId,
      ),
      queryPromise,
    ])
    .then(([, result]) => result);
}

// PrismaPromise is the lazy thenable Prisma returns from model operations.
// It's `query(args)`'s return type. We alias it to keep signatures explicit.
type PrismaPromise<T> = Promise<T> & { [Symbol.toStringTag]: "PrismaPromise" };

function applyTenantScope(params: ScopeParams): Promise<unknown> {
  const { model, operation, args, query, tenantId, client } = params;

  // For the Tenant model, scope by `id` (self-tenancy). All others by `tenantId`.
  const scopeField = model === TENANT_MODEL ? "id" : "tenantId";

  // Helper: runs a prepared, app-layer-scoped query inside the RLS transaction.
  const withRls = (scopedArgs: unknown): Promise<unknown> =>
    runWithRls(client, tenantId, query(scopedArgs) as PrismaPromise<unknown>);

  switch (operation) {
    // ─── Reads ──────────────────────────────────────────────────────────
    case "findFirst":
    case "findFirstOrThrow":
    case "findMany":
    case "findUnique":
    case "findUniqueOrThrow":
    case "count":
    case "aggregate":
    case "groupBy": {
      return withRls(withScopedWhere(args, scopeField, tenantId));
    }

    // ─── Single-row writes ──────────────────────────────────────────────
    case "create": {
      return withRls(
        withScopedCreateData({
          args,
          model,
          operation,
          tenantId,
          scopeField,
          dataKey: "data",
        }),
      );
    }

    case "createMany":
    case "createManyAndReturn": {
      return withRls(
        withScopedCreateManyData({ args, model, operation, tenantId, scopeField }),
      );
    }

    // ─── Updates / deletes / upserts ────────────────────────────────────
    case "update":
    case "updateMany":
    case "delete":
    case "deleteMany": {
      return withRls(withScopedWhere(args, scopeField, tenantId));
    }

    case "upsert": {
      const withWhere = withScopedWhere(args, scopeField, tenantId);
      return withRls(
        withScopedCreateData({
          args: withWhere,
          model,
          operation,
          tenantId,
          scopeField,
          dataKey: "create",
        }),
      );
    }

    // ─── Raw SQL — pass through (rare, caller takes responsibility) ─────
    case "$queryRaw":
    case "$executeRaw":
    case "$queryRawUnsafe":
    case "$executeRawUnsafe": {
      return query(args);
    }

    default: {
      // Unknown operation. Fail safe to block accidental bypass.
      throw new Error(
        `[aims-tenant-isolation] Unhandled operation "${operation}" on model "${model}". ` +
          `Update prisma-extension.ts to classify it.`,
      );
    }
  }
}

function withScopedWhere(
  args: QueryArgs | undefined,
  scopeField: string,
  tenantId: string,
): QueryArgs {
  const existingWhere = isRecord(args?.["where"]) ? args["where"] : {};
  return {
    ...(args ?? {}),
    where: {
      ...existingWhere,
      [scopeField]: tenantId,
    },
  };
}

function withScopedCreateData(params: {
  args: QueryArgs | undefined;
  model: string;
  operation: string;
  tenantId: string;
  scopeField: string;
  dataKey: "data" | "create";
}): QueryArgs {
  const { args, model, operation, tenantId, scopeField, dataKey } = params;

  const rawData = args?.[dataKey];
  const existingData: QueryArgs = isRecord(rawData) ? rawData : {};

  const explicit = existingData[scopeField];
  if (typeof explicit === "string" && explicit !== tenantId) {
    throw new CrossTenantViolationError(tenantId, explicit, model, operation);
  }

  return {
    ...(args ?? {}),
    [dataKey]: {
      ...existingData,
      [scopeField]: tenantId,
    },
  };
}

function withScopedCreateManyData(params: {
  args: QueryArgs | undefined;
  model: string;
  operation: string;
  tenantId: string;
  scopeField: string;
}): QueryArgs {
  const { args, model, operation, tenantId, scopeField } = params;

  const rawData = args?.["data"];
  const rows: QueryArgs[] = Array.isArray(rawData)
    ? rawData.filter(isRecord)
    : isRecord(rawData)
      ? [rawData]
      : [];

  const scopedRows = rows.map((row) => {
    const explicit = row[scopeField];
    if (typeof explicit === "string" && explicit !== tenantId) {
      throw new CrossTenantViolationError(tenantId, explicit, model, operation);
    }
    return { ...row, [scopeField]: tenantId };
  });

  return {
    ...(args ?? {}),
    data: Array.isArray(rawData) ? scopedRows : scopedRows[0],
  };
}
