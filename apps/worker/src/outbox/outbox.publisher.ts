/**
 * Outbox publisher.
 *
 * Drains rows from `audit.outbox_events` where `publishedAt IS NULL` and
 * sends them to the configured SQS queue. On success, sets `publishedAt`
 * + `sqsMessageId` so the row is never re-sent. On failure, increments
 * `attempts` + records `lastError`. Per the outbox-pattern contract, this
 * is the only thing that bridges the DB transaction boundary to the
 * message bus — atomicity at the source means at-least-once at the bus.
 *
 * The scheduled tick runs every `outboxIntervalMs`. The tested entry point
 * is `drainOnce()`; the tick is just a periodic invocation of that.
 */

import { type AdminPrismaClient } from "@aims/prisma-client";
import { SendMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";

import { SQS_CLIENT, WORKER_CONFIG } from "../aws/aws.module";
import { type WorkerConfig } from "../config";
import { ADMIN_PRISMA } from "../db/db.module";

export type DrainResult = {
  readonly published: number;
  readonly errors: number;
  readonly skipped: number;
};

@Injectable()
export class OutboxPublisher {
  private readonly logger = new Logger(OutboxPublisher.name);

  constructor(
    @Inject(ADMIN_PRISMA) private readonly prisma: AdminPrismaClient,
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  @Interval("outbox-drain", 2000)
  async tick(): Promise<void> {
    try {
      const result = await this.drainOnce();
      if (result.published > 0 || result.errors > 0) {
        this.logger.log(
          `drained ${result.published.toString()} (errors: ${result.errors.toString()}, skipped: ${result.skipped.toString()})`,
        );
      }
    } catch (err) {
      this.logger.error("drain tick failed", err);
    }
  }

  async drainOnce(): Promise<DrainResult> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        publishedAt: null,
        attempts: { lt: this.config.outboxMaxAttempts },
      },
      orderBy: { createdAt: "asc" },
      take: this.config.outboxBatchSize,
    });

    let published = 0;
    let errors = 0;

    for (const event of pending) {
      const body = JSON.stringify({
        id: event.id,
        tenantId: event.tenantId,
        eventType: event.eventType,
        payload: event.payload,
        createdAt: event.createdAt.toISOString(),
      });

      try {
        const result = await this.sqs.send(
          new SendMessageCommand({
            QueueUrl: this.config.outboxQueueUrl,
            MessageBody: body,
          }),
        );
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            publishedAt: new Date(),
            sqsMessageId: result.MessageId ?? null,
            attempts: { increment: 1 },
          },
        });
        published += 1;
      } catch (err) {
        errors += 1;
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`SQS send failed for event ${event.id}: ${message}`);
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            lastError: message,
          },
        });
      }
    }

    return { published, errors, skipped: 0 };
  }
}
