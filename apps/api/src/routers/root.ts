/**
 * Root tRPC router — composes sub-routers per domain area.
 *
 * Currently: auth only. Milestone C adds `engagement`, `pack`. Milestone D
 * wires Next.js to this router type via type-level import.
 */

import { router } from "../trpc";

import { authRouter } from "./auth";
import { engagementRouter } from "./engagement";
import { packRouter } from "./pack";

export const appRouter = router({
  auth: authRouter,
  engagement: engagementRouter,
  pack: packRouter,
});

export type AppRouter = typeof appRouter;
