/**
 * Root tRPC Router
 *
 * Composes all feature routers into the main app router.
 * Exported type `AppRouter` is imported by the Next.js client.
 */

import { router } from './middleware';

// Feature routers
import { engagementRouter } from './routers/engagement.router';
import { findingRouter } from './routers/finding.router';
import { approvalRouter } from './routers/approval.router';
import { standardPackRouter } from './routers/standard-pack.router';

// Placeholder imports (to implement as separate routers)
// import { authRouter } from './routers/auth.router';
// import { userRouter } from './routers/user.router';
// import { tenantRouter } from './routers/tenant.router';
// import { recommendationRouter } from './routers/recommendation.router';
// import { capRouter } from './routers/cap.router';
// import { workpaperRouter } from './routers/workpaper.router';
// import { reportRouter } from './routers/report.router';
// import { checklistRouter } from './routers/checklist.router';
// import { independenceRouter } from './routers/independence.router';
// import { timeEntryRouter } from './routers/time-entry.router';
// import { cpeRouter } from './routers/cpe.router';
// import { auditUniverseRouter } from './routers/audit-universe.router';
// import { annualPlanRouter } from './routers/annual-plan.router';
// import { notificationRouter } from './routers/notification.router';
// import { fileRouter } from './routers/file.router';
// import { dashboardRouter } from './routers/dashboard.router';
// import { adminRouter } from './routers/admin.router';

export const appRouter = router({
  // Core audit entities
  engagement: engagementRouter,
  finding: findingRouter,
  approval: approvalRouter,

  // Platform
  standardPack: standardPackRouter,

  // Additional routers (follow same patterns — see engagement.router.ts as reference)
  // auth: authRouter,
  // user: userRouter,
  // tenant: tenantRouter,
  // recommendation: recommendationRouter,
  // cap: capRouter,
  // workpaper: workpaperRouter,
  // report: reportRouter,
  // checklist: checklistRouter,
  // independence: independenceRouter,
  // timeEntry: timeEntryRouter,
  // cpe: cpeRouter,
  // auditUniverse: auditUniverseRouter,
  // annualPlan: annualPlanRouter,
  // notification: notificationRouter,
  // file: fileRouter,
  // dashboard: dashboardRouter,
  // admin: adminRouter,
});

export type AppRouter = typeof appRouter;
