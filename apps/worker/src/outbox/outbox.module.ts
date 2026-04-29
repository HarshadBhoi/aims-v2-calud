/**
 * Outbox module — bundles the publisher with its AWS + DB deps.
 *
 * Importing this module registers the scheduled tick that drains the
 * outbox into the SQS bus.
 */

import { Module } from "@nestjs/common";

import { AwsModule } from "../aws/aws.module";
import { DbModule } from "../db/db.module";

import { OutboxPublisher } from "./outbox.publisher";

@Module({
  imports: [AwsModule, DbModule],
  providers: [OutboxPublisher],
  exports: [OutboxPublisher],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker
export class OutboxModule {}
