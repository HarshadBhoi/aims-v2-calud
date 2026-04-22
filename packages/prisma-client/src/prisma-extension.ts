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

import { Prisma } from "@prisma/client";

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
 * Tenant-scoped models — must have a `tenantId` column. Matches the 13 models
 * beyond Tenant + StandardPack in the Slice A schema.
 */
const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
  "User",
  "MfaSecret",
  "Session",
  "SessionBlocklist",
  "Engagement",
  "PackAttachment",
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

export const tenantIsolationExtension = Prisma.defineExtension({
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
        });
      },
    },
  },
});

type ScopeParams = {
  readonly model: string;
  readonly operation: string;
  readonly args: QueryArgs | undefined;
  readonly query: QueryFn;
  readonly tenantId: string;
};

function applyTenantScope(params: ScopeParams): Promise<unknown> {
  const { model, operation, args, query, tenantId } = params;

  // For the Tenant model, scope by `id` (self-tenancy). All others by `tenantId`.
  const scopeField = model === TENANT_MODEL ? "id" : "tenantId";

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
      return query(withScopedWhere(args, scopeField, tenantId));
    }

    // ─── Single-row writes ──────────────────────────────────────────────
    case "create": {
      return query(
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
      return query(withScopedCreateManyData({ args, model, operation, tenantId, scopeField }));
    }

    // ─── Updates / deletes / upserts ────────────────────────────────────
    case "update":
    case "updateMany":
    case "delete":
    case "deleteMany": {
      return query(withScopedWhere(args, scopeField, tenantId));
    }

    case "upsert": {
      const withWhere = withScopedWhere(args, scopeField, tenantId);
      return query(
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
