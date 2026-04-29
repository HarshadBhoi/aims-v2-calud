/**
 * Root tRPC router — composes sub-routers per domain area.
 *
 * Currently: auth only. Milestone C adds `engagement`, `pack`. Milestone D
 * wires Next.js to this router type via type-level import.
 */

import { router } from "../trpc";

import { auditLogRouter } from "./audit-log";
import { authRouter } from "./auth";
import { engagementRouter } from "./engagement";
import { findingRouter } from "./finding";
import { packRouter } from "./pack";
import { reportRouter } from "./report";

export const appRouter = router({
  auditLog: auditLogRouter,
  auth: authRouter,
  engagement: engagementRouter,
  finding: findingRouter,
  pack: packRouter,
  report: reportRouter,
});

export type AppRouter = typeof appRouter;
