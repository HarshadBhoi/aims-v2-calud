/**
 * tRPC initialization + shared procedures.
 *
 *   publicProcedure       — no auth required (sign-in, refresh)
 *   authenticatedProcedure — requires a valid session; sets tenant context
 *                            via AsyncLocalStorage so queries are scoped
 *   mfaFreshProcedure     — extends authenticated; requires the session's
 *                            mfaFreshUntil to be in the future (ADR-0005
 *                            step-up)
 */

import { runWithTenantContext } from "@aims/prisma-client";
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import { type AuthenticatedSession, type RequestContext } from "./context";

const t = initTRPC.context<RequestContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const authenticatedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
  }

  // Hoist to a local non-null binding so closures see the narrowed type.
  const session: AuthenticatedSession = ctx.session;

  return runWithTenantContext(
    { tenantId: session.tenantId, userId: session.userId, sessionId: session.sessionId },
    () => next({ ctx: { ...ctx, session } }),
  );
});

export const mfaFreshProcedure = authenticatedProcedure.use(({ ctx, next }) => {
  const { mfaFreshUntil } = ctx.session;
  if (!mfaFreshUntil || mfaFreshUntil < new Date()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Step-up required: re-verify your MFA code before performing this action.",
    });
  }
  return next();
});
