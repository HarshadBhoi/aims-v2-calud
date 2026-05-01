/**
 * Consumer module — SQS poller + per-event-type handlers.
 *
 * Slice A registers one handler (`report.published`). Future slices add
 * handlers for notifications, webhooks, etc. — register them here.
 */

import { Module } from "@nestjs/common";

import { AwsModule } from "../aws/aws.module";
import { DbModule } from "../db/db.module";

import { EventConsumer } from "./event.consumer";
import { ReportPublishedHandler } from "./report-published.handler";

@Module({
  imports: [AwsModule, DbModule],
  providers: [EventConsumer, ReportPublishedHandler],
  exports: [EventConsumer, ReportPublishedHandler],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker
export class ConsumerModule {}
