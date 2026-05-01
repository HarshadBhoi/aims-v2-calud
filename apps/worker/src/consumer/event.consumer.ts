/**
 * Event consumer.
 *
 * Long-polls the configured SQS queue, dispatches each message to the
 * matching handler by `eventType`, and deletes the message on success.
 * On handler failure, leaves the message in-flight — SQS visibility-timeout
 * + the redrive policy (configured in `infra/localstack/init/01-bootstrap.sh`)
 * eventually shunts repeat-failures to the DLQ.
 *
 * Tests drive the per-message logic via `processMessage(body)` directly.
 * The continuous loop is started by `onModuleInit` and stopped by
 * `onModuleDestroy`.
 */

import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";

import { SQS_CLIENT, WORKER_CONFIG } from "../aws/aws.module";
import { type WorkerConfig } from "../config";
import {
  carrierFromPayload,
  runInExtractedContext,
} from "../lib/otel-propagation";

import {
  isReportPublishedEvent,
  ReportPublishedHandler,
} from "./report-published.handler";

@Injectable()
export class EventConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventConsumer.name);
  private running = false;

  constructor(
    @Inject(SQS_CLIENT) private readonly sqs: SQSClient,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
    // Explicit @Inject — tsx (used by `pnpm dev`) doesn't emit
    // emitDecoratorMetadata, so Nest can't resolve class-type params
    // by reflection. The token form avoids needing reflect-metadata.
    @Inject(ReportPublishedHandler)
    private readonly reportPublishedHandler: ReportPublishedHandler,
  ) {}

  onModuleInit(): void {
    this.running = true;
    void this.loop();
  }

  onModuleDestroy(): void {
    this.running = false;
  }

  async processMessage(body: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid event body (not JSON): ${message}`);
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Event body must be a JSON object");
    }

    const eventType = (parsed as { eventType?: unknown }).eventType;
    if (typeof eventType !== "string") {
      throw new Error("Event body missing string eventType");
    }

    // Resume the trace started by the API when it wrote the outbox row,
    // so the handler's spans nest under the original mutation (task 4.8).
    const carrier = carrierFromPayload((parsed as { payload?: unknown }).payload);

    switch (eventType) {
      case "report.published":
        if (!isReportPublishedEvent(parsed)) {
          throw new Error("report.published payload failed shape validation");
        }
        await runInExtractedContext(carrier, () =>
          this.reportPublishedHandler.handle(parsed),
        );
        return;
      default:
        this.logger.warn(`unknown eventType: ${eventType} — message ignored`);
    }
  }

  private async loop(): Promise<void> {
    this.logger.log(`polling ${this.config.outboxQueueUrl}`);
    while (this.running) {
      try {
        const result = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.config.outboxQueueUrl,
            MaxNumberOfMessages: 5,
            WaitTimeSeconds: this.config.sqsWaitTimeSeconds,
            VisibilityTimeout: this.config.sqsVisibilityTimeoutSeconds,
          }),
        );
        for (const msg of result.Messages ?? []) {
          if (!msg.Body || !msg.ReceiptHandle) continue;
          try {
            await this.processMessage(msg.Body);
            await this.sqs.send(
              new DeleteMessageCommand({
                QueueUrl: this.config.outboxQueueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `message ${msg.MessageId ?? "?"} failed; will redeliver: ${message}`,
            );
            // Don't delete — visibility-timeout + redrive policy handle it.
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`poll error; backing off: ${message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }
}
