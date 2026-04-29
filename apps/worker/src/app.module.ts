/**
 * Root NestJS module for the AIMS v2 worker tier.
 *
 * Slice A wiring (per VERTICAL-SLICE-PLAN.md §4 W4):
 *   - OutboxModule    — drains audit.outbox_events into SQS (task 4.4)
 *   - ConsumerModule  — long-polls SQS, dispatches by eventType (task 4.4)
 *
 * Future modules:
 *   - PdfRenderModule     (Task 4.5)  — Puppeteer/pdfmake + S3 archive
 *   - AuditLogModule      (Task 4.5)  — worker-side audit-log appends
 *   - ScheduledJobsModule  (later)    — PBC reminders, CPE nudges, etc.
 */

import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";

import { ConsumerModule } from "./consumer/consumer.module";
import { OutboxModule } from "./outbox/outbox.module";

@Module({
  imports: [ScheduleModule.forRoot(), OutboxModule, ConsumerModule],
  controllers: [],
  providers: [],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker class
export class AppModule {}
