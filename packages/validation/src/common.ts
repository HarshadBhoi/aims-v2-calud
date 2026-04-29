/**
 * Common validation primitives shared across domain schemas.
 *
 * Keep this file small — it's re-imported on every request. Avoid
 * computing heavy schemas at module load.
 */

import { z } from "zod";

/** CUID-shaped string (matches Prisma's cuid() output). */
export const CuidString = z.string().min(10).max(64);

/** Cursor-based pagination input used by list endpoints. */
export const PaginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: CuidString.optional(),
});
export type PaginationInput = z.infer<typeof PaginationInput>;

/** Shape returned by every list endpoint. */
export type PaginatedResult<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
};
