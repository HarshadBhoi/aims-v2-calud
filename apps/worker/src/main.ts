/**
 * AIMS v2 — NestJS worker tier bootstrap.
 *
 * Per ADR-0003, NestJS is scoped to workers: SQS consumers, PDF render,
 * audit-log hash chain append, scheduled jobs. It is NOT on the hot path
 * — that's apps/api (Fastify).
 *
 * SLICE A SCAFFOLD: Minimal bootstrap. Real consumers arrive in:
 *   - Task 4.4: outbox poll → SQS send (report.published event)
 *   - Task 4.5: SQS consume → PDF render via Puppeteer → audit-log append
 *               → S3 archive
 *
 * See VERTICAL-SLICE-PLAN.md §4 Week 4 and ADR-0004 for queue conventions.
 */

import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["log", "warn", "error"],
  });

  const logger = app.get(AppModule).constructor.name;
  console.warn(`[${logger}] AIMS worker started (scaffold — no consumers yet)`);

  // Keep the process alive. Real implementations attach SQS pollers here.
  await new Promise(() => {
    // intentional never-resolves
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Worker bootstrap failed:", err);
  throw err;
});
