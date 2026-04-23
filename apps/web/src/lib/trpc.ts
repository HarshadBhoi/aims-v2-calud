/**
 * Typed tRPC client bound to apps/api's AppRouter.
 *
 * End-to-end type safety: the router type flows through the workspace
 * dep (@aims/api/router), so changes to a procedure's signature in the
 * backend surface as TypeScript errors in the frontend at compile time.
 */

import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@aims/api/router";

export const trpc = createTRPCReact<AppRouter>();
