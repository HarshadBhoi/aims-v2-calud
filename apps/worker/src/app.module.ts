/**
 * Root NestJS module for the AIMS v2 worker tier.
 *
 * SLICE A SCAFFOLD: Empty. Modules are added task-by-task:
 *   - OutboxPollerModule  (Task 4.4)
 *   - PdfRenderModule     (Task 4.5)
 *   - AuditLogModule      (Task 4.5)
 *   - ScheduledJobsModule (later — PBC reminders, CPE nudges, etc.)
 */

import { Module } from "@nestjs/common";

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class
export class AppModule {}
