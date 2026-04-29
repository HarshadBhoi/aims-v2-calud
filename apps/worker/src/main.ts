/**
 * AIMS v2 — NestJS worker tier bootstrap.
 *
 * Per ADR-0003, NestJS is scoped to workers: SQS consumers, PDF render,
 * audit-log hash chain append, scheduled jobs. NOT on the hot path —
 * that's apps/api (Fastify).
 *
 * Slice A wiring (task 4.4): OutboxModule scheduled-drain into SQS, plus
 * ConsumerModule long-polling SQS for inbound events. Task 4.5 fills in
 * the actual PDF render in `ReportPublishedHandler`.
 *
 * The OTel bootstrap MUST stay at the top — it patches the module loader
 * before NestJS / Prisma / AWS-SDK / pg modules resolve, which is how
 * auto-instrumentations attach (task 4.8).
 */

import "./otel";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.enableShutdownHooks();
  const logger = new Logger("Worker");
  logger.log("AIMS worker started — outbox drain + SQS consumer active");

  await new Promise<void>((resolve) => {
    const stop = (signal: string) => () => {
      logger.log(`received ${signal}, shutting down…`);
      void app
        .close()
        .catch((err: unknown) => {
          logger.error("clean shutdown failed", err);
        })
        .finally(() => {
          resolve();
        });
    };
    process.once("SIGINT", stop("SIGINT"));
    process.once("SIGTERM", stop("SIGTERM"));
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Worker bootstrap failed:", err);
  throw err;
});
