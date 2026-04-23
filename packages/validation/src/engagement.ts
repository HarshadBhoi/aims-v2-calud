/**
 * Zod schemas for the engagement domain. Shared between apps/api (server)
 * and apps/web (client) so the wire contract has one source of truth.
 */

import { z } from "zod";

import { CuidString, PaginationInput } from "./common";

const EngagementStatus = z.enum(["PLANNING", "FIELDWORK", "REPORTING", "CLOSED"]);
export type EngagementStatus = z.infer<typeof EngagementStatus>;

// ─── Inputs ────────────────────────────────────────────────────────────────

export const CreateEngagementInput = z.object({
  name: z.string().min(1).max(200),
  auditeeName: z.string().min(1).max(200),
  fiscalPeriod: z.string().min(1).max(50),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  plannedHours: z.number().int().positive().max(100_000).optional(),
  leadUserId: CuidString,
});
export type CreateEngagementInput = z.infer<typeof CreateEngagementInput>;

export const UpdateEngagementInput = z.object({
  id: CuidString,
  expectedVersion: z.number().int().min(1), // optimistic concurrency
  name: z.string().min(1).max(200).optional(),
  auditeeName: z.string().min(1).max(200).optional(),
  plannedHours: z.number().int().positive().max(100_000).optional(),
  status: EngagementStatus.optional(),
});
export type UpdateEngagementInput = z.infer<typeof UpdateEngagementInput>;

export const GetEngagementInput = z.object({ id: CuidString });
export type GetEngagementInput = z.infer<typeof GetEngagementInput>;

export const ListEngagementsInput = PaginationInput.extend({
  status: EngagementStatus.optional(),
  leadUserId: CuidString.optional(),
});
export type ListEngagementsInput = z.infer<typeof ListEngagementsInput>;

// ─── Outputs ───────────────────────────────────────────────────────────────

export type EngagementSummary = {
  readonly id: string;
  readonly name: string;
  readonly auditeeName: string;
  readonly fiscalPeriod: string;
  readonly status: EngagementStatus;
  readonly leadUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
};

export type EngagementDetail = EngagementSummary & {
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly plannedHours: number | null;
  readonly packStrategyLocked: boolean;
};
