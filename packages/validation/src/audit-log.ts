/**
 * Zod schemas for the audit-log domain.
 *
 * The audit log is append-only and hash-chained at the DB layer; this surface
 * is read-only from the app's perspective. Slice A scope:
 *   - paginated list scoped to current tenant (RLS + extension both enforce)
 *   - optional filter by entityType + entityId for "show me everything that
 *     happened to this finding / report / engagement"
 *   - chain-verification trigger
 */

import { z } from "zod";

import { CuidString } from "./common";

// ─── Inputs ────────────────────────────────────────────────────────────────

export const ListAuditLogInput = z
  .object({
    entityType: z.string().min(1).max(64).optional(),
    entityId: CuidString.optional(),
    limit: z.number().int().min(1).max(200).default(50),
    cursor: z.string().min(1).max(128).optional(),
  })
  .default({ limit: 50 });
export type ListAuditLogInput = z.infer<typeof ListAuditLogInput>;

// ─── Outputs ───────────────────────────────────────────────────────────────

export type AuditLogEntry = {
  readonly id: string;
  readonly tenantId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly userId: string | null;
  readonly beforeData: unknown;
  readonly afterData: unknown;
  readonly previousHash: string | null;
  readonly contentHash: string;
  readonly chainPosition: bigint;
  readonly loggedAt: Date;
};

export type VerifyChainResult = {
  readonly ok: boolean;
  readonly brokenAt: bigint | null;
  readonly totalRows: bigint;
  readonly reason: string;
};
