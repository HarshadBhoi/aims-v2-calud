/**
 * Outbox + consumer integration test.
 *
 * Mirrors the apps/api business-test pattern: real Postgres + LocalStack
 * via testcontainers, real Prisma migrate-deploy. The publisher and consumer
 * are constructed directly (no NestJS DI) so we can drive `drainOnce()` and
 * `processMessage()` deterministically without the scheduled tick or the
 * receive loop.
 */

import { execSync } from "node:child_process";
import { resolve } from "node:path";

import {
  createEncryptionModule,
  createPrismaDekStore,
  type EncryptionModule,
} from "@aims/encryption";
import {
  createAdminPrismaClient,
  type AdminPrismaClient,
} from "@aims/prisma-client";
import {
  computeReportContentHash,
  type ReportSectionsInput,
} from "@aims/validation";
import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import {
  CreateBucketCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type WorkerConfig } from "../config";
import { EventConsumer } from "../consumer/event.consumer";
import {
  ReportPublishedHandler,
  type ReportPublishedEvent,
} from "../consumer/report-published.handler";

import { OutboxPublisher } from "./outbox.publisher";

// eslint-disable-next-line unicorn/prefer-module -- worker tsconfig is CommonJS; import.meta.url is unavailable here
const PRISMA_CLIENT_ROOT = resolve(__dirname, "../../../../packages/prisma-client");

let pg: StartedPostgreSqlContainer | undefined;
let ls: StartedTestContainer | undefined;
let prisma: AdminPrismaClient | undefined;
let sqsClient: SQSClient | undefined;
let s3Client: S3Client | undefined;
let kmsClient: KMSClient | undefined;
let encryption: EncryptionModule | undefined;
let queueUrl = "";
let workerConfig: WorkerConfig | undefined;
let tenantId: string;
let userId: string;
let engagementId: string;

function requireSetup() {
  if (
    !prisma ||
    !sqsClient ||
    !s3Client ||
    !kmsClient ||
    !encryption ||
    !workerConfig
  ) {
    throw new Error("beforeAll did not complete");
  }
  return {
    prisma,
    sqs: sqsClient,
    s3: s3Client,
    kms: kmsClient,
    encryption,
    config: workerConfig,
  };
}

beforeAll(async () => {
  pg = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("aims_worker_test")
    .withUsername("test_user")
    .withPassword("test_pw")
    .start();

  ls = await new GenericContainer("localstack/localstack:3.8")
    .withEnvironment({ SERVICES: "sqs,kms,s3", AWS_DEFAULT_REGION: "us-east-1" })
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forLogMessage(/Ready\./))
    .start();

  const dbUrl = pg.getConnectionUri();
  const awsEndpoint = `http://${ls.getHost()}:${ls.getMappedPort(4566).toString()}`;

  execSync("pnpm exec prisma migrate deploy", {
    cwd: PRISMA_CLIENT_ROOT,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "inherit",
  });

  prisma = createAdminPrismaClient({ datasources: { db: { url: dbUrl } } });

  const credentials = { accessKeyId: "test", secretAccessKey: "test" };

  sqsClient = new SQSClient({
    region: "us-east-1",
    endpoint: awsEndpoint,
    credentials,
  });
  s3Client = new S3Client({
    region: "us-east-1",
    endpoint: awsEndpoint,
    credentials,
    forcePathStyle: true,
  });
  kmsClient = new KMSClient({
    region: "us-east-1",
    endpoint: awsEndpoint,
    credentials,
  });

  const created = await sqsClient.send(
    new CreateQueueCommand({ QueueName: "aims-events-outbox-test" }),
  );
  if (!created.QueueUrl) throw new Error("queue not created");
  queueUrl = created.QueueUrl;

  await s3Client.send(
    new CreateBucketCommand({ Bucket: "aims-test-reports" }),
  );

  const keyResult = await kmsClient.send(
    new CreateKeyCommand({ Description: "worker test master KEK" }),
  );
  const masterKeyArn = keyResult.KeyMetadata?.Arn;
  if (!masterKeyArn) throw new Error("KMS master key not created");

  encryption = createEncryptionModule({
    kmsClient,
    masterKeyArn,
    dekStore: createPrismaDekStore(prisma),
  });

  workerConfig = {
    nodeEnv: "test",
    awsRegion: "us-east-1",
    awsEndpointUrl: awsEndpoint,
    outboxQueueUrl: queueUrl,
    outboxBatchSize: 25,
    outboxIntervalMs: 2000,
    sqsWaitTimeSeconds: 1,
    sqsVisibilityTimeoutSeconds: 30,
    outboxMaxAttempts: 5,
    kmsMasterKeyAlias: masterKeyArn,
    reportsBucket: "aims-test-reports",
    databaseAdminUrl: undefined,
  };

  // Seed: standard pack (FK target for Report.attestsToPack* in slice B) +
  // tenant + DEK + user + engagement.
  await prisma.standardPack.create({
    data: {
      code: "GAGAS",
      version: "2024.1",
      name: "GAGAS 2024",
      issuingBody: "GAO",
      publishedYear: 2024,
      contentHash: "sha256:worker-test-pack",
      packContent: {},
    },
  });

  const tenant = await prisma.tenant.create({
    data: { slug: "worker-test", name: "Worker Test Tenant" },
  });
  tenantId = tenant.id;
  await encryption.provisionTenantDek(tenantId);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: "lead@worker.test",
      name: "Worker Lead",
      role: "Senior",
      status: "ACTIVE",
    },
  });
  userId = user.id;

  const engagement = await prisma.engagement.create({
    data: {
      tenantId,
      name: "Worker Render Engagement",
      auditeeName: "BizCo Worker",
      fiscalPeriod: "FY26 Worker",
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      leadUserId: userId,
    },
  });
  engagementId = engagement.id;
}, 240_000);

afterAll(async () => {
  sqsClient?.destroy();
  s3Client?.destroy();
  kmsClient?.destroy();
  await prisma?.$disconnect();
  await pg?.stop();
  await ls?.stop();
});

// ─── Helpers shared by render tests ─────────────────────────────────────────

const SLICE_SECTIONS: ReportSectionsInput = {
  engagement_overview: {
    kind: "data",
    content: "Engagement: Worker Render Engagement\nFY26 Worker",
  },
  pack_disclosure: { kind: "data", content: "GAGAS 2024 (placeholder)" },
  findings_summary: { kind: "data", content: "1 finding (placeholder)" },
  executive_summary: {
    kind: "editorial",
    content: "Author narrative: significant deficiencies remain.",
  },
  recommendations: { kind: "editorial", content: "Implement controls." },
  closing: { kind: "editorial", content: "End of report." },
};

async function seedSignedReportVersion(): Promise<{
  reportId: string;
  versionId: string;
  contentHash: string;
}> {
  const { prisma, encryption } = requireSetup();
  const cipher = await encryption.encryptJson(tenantId, SLICE_SECTIONS);
  const contentHash = computeReportContentHash(SLICE_SECTIONS);

  const report = await prisma.report.create({
    data: {
      tenantId,
      engagementId,
      templateKey: "engagement-report-v1",
      title: "Worker render fixture",
      status: "PUBLISHED",
      authorId: userId,
      // Slice B: every report attests to a specific pack. The test fixture
      // attaches GAGAS-2024.1 as primary, so the report attests to it.
      attestsToPackCode: "GAGAS",
      attestsToPackVersion: "2024.1",
    },
  });
  const version = await prisma.reportVersion.create({
    data: {
      tenantId,
      reportId: report.id,
      versionNumber: "v1.0",
      isDraft: false,
      contentCipher: cipher,
      contentHash,
      signedBy: userId,
      signedAt: new Date(),
    },
  });
  return { reportId: report.id, versionId: version.id, contentHash };
}

function buildEvent(
  reportId: string,
  versionId: string,
  contentHash: string,
): ReportPublishedEvent {
  return {
    id: `evt-${reportId}`,
    tenantId,
    eventType: "report.published",
    payload: {
      reportId,
      reportVersionId: versionId,
      contentHash,
      signedBy: userId,
      signedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
  };
}

function newHandler(): ReportPublishedHandler {
  const { prisma, encryption, s3, config } = requireSetup();
  return new ReportPublishedHandler(prisma, encryption, s3, config);
}

describe("OutboxPublisher.drainOnce", () => {
  it("sends pending events to SQS and stamps publishedAt + sqsMessageId", async () => {
    const { prisma, sqs, config } = requireSetup();
    const publisher = new OutboxPublisher(prisma, sqs, config);

    const event = await prisma.outboxEvent.create({
      data: {
        tenantId,
        eventType: "report.published",
        payload: {
          reportId: "rep-test-1",
          reportVersionId: "rv-test-1",
          contentHash: "a".repeat(64),
          signedBy: "user-test-1",
          signedAt: new Date().toISOString(),
        },
      },
    });

    const result = await publisher.drainOnce();
    expect(result.published).toBe(1);
    expect(result.errors).toBe(0);

    const updated = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: event.id },
    });
    expect(updated.publishedAt).toBeInstanceOf(Date);
    expect(updated.sqsMessageId).toBeTruthy();
    expect(updated.attempts).toBe(1);

    // Pull the message off SQS and verify the envelope.
    const received = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.outboxQueueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 5,
      }),
    );
    expect(received.Messages?.length).toBe(1);
    const body = JSON.parse(received.Messages?.[0]?.Body ?? "{}") as {
      eventType: string;
      tenantId: string;
      payload: { reportId: string; contentHash: string };
    };
    expect(body.eventType).toBe("report.published");
    expect(body.tenantId).toBe(tenantId);
    expect(body.payload.reportId).toBe("rep-test-1");

    // Clean up.
    await sqs.send(
      new DeleteMessageCommand({
        QueueUrl: config.outboxQueueUrl,
        ReceiptHandle: received.Messages?.[0]?.ReceiptHandle ?? "",
      }),
    );
  });

  it("does not redeliver already-published rows", async () => {
    const { prisma, sqs, config } = requireSetup();
    const publisher = new OutboxPublisher(prisma, sqs, config);

    // First drain — already-published rows excluded.
    const before = await publisher.drainOnce();
    expect(before.published).toBe(0);
  });

  it("skips rows that have exhausted attempts", async () => {
    const { prisma, sqs, config } = requireSetup();
    const publisher = new OutboxPublisher(prisma, sqs, config);

    await prisma.outboxEvent.create({
      data: {
        tenantId,
        eventType: "report.published",
        payload: { reportId: "rep-test-exhausted" },
        attempts: config.outboxMaxAttempts,
        lastError: "earlier failures",
      },
    });

    const result = await publisher.drainOnce();
    expect(result.published).toBe(0);
  });
});

describe("EventConsumer.processMessage", () => {
  it("dispatches report.published to the typed handler", async () => {
    const { sqs, config } = requireSetup();
    const handler = newHandler();
    const calls: { reportId: string }[] = [];
    handler.handle = async (event: ReportPublishedEvent) => {
      calls.push({ reportId: event.payload.reportId });
      await Promise.resolve();
    };
    const consumer = new EventConsumer(sqs, config, handler);

    const body = JSON.stringify({
      id: "evt-1",
      tenantId,
      eventType: "report.published",
      payload: {
        reportId: "rep-direct-1",
        reportVersionId: "rv-direct-1",
        contentHash: "b".repeat(64),
        signedBy: "user-direct-1",
        signedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    });

    await consumer.processMessage(body);
    expect(calls).toEqual([{ reportId: "rep-direct-1" }]);
  });

  it("ignores unknown eventTypes without throwing", async () => {
    const { sqs, config } = requireSetup();
    const consumer = new EventConsumer(sqs, config, newHandler());
    const body = JSON.stringify({
      id: "evt-2",
      tenantId,
      eventType: "something.unrelated",
      payload: {},
      createdAt: new Date().toISOString(),
    });
    await expect(consumer.processMessage(body)).resolves.toBeUndefined();
  });

  it("rejects malformed report.published payload", async () => {
    const { sqs, config } = requireSetup();
    const consumer = new EventConsumer(sqs, config, newHandler());
    const body = JSON.stringify({
      id: "evt-3",
      tenantId,
      eventType: "report.published",
      payload: { reportId: "missing other fields" },
      createdAt: new Date().toISOString(),
    });
    await expect(consumer.processMessage(body)).rejects.toThrow(/shape validation/);
  });

  it("rejects bodies that aren't valid JSON objects", async () => {
    const { sqs, config } = requireSetup();
    const consumer = new EventConsumer(sqs, config, newHandler());
    await expect(consumer.processMessage("not json")).rejects.toThrow(/Invalid event body/);
    await expect(consumer.processMessage("[1,2,3]")).rejects.toThrow(/JSON object/);
  });
});

describe("end-to-end: outbox → SQS → consumer", () => {
  it("round-trips a report.published event from outbox row to handler", async () => {
    const { prisma, sqs, config } = requireSetup();
    const publisher = new OutboxPublisher(prisma, sqs, config);

    const handler = newHandler();
    const calls: string[] = [];
    handler.handle = async (event: ReportPublishedEvent) => {
      calls.push(event.payload.reportId);
      await Promise.resolve();
    };
    const consumer = new EventConsumer(sqs, config, handler);

    await prisma.outboxEvent.create({
      data: {
        tenantId,
        eventType: "report.published",
        payload: {
          reportId: "rep-e2e-1",
          reportVersionId: "rv-e2e-1",
          contentHash: "c".repeat(64),
          signedBy: "user-e2e-1",
          signedAt: new Date().toISOString(),
        },
      },
    });

    await publisher.drainOnce();

    // Pull all available messages and dispatch each through the consumer.
    const received = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: config.outboxQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 5,
      }),
    );

    for (const msg of received.Messages ?? []) {
      if (!msg.Body || !msg.ReceiptHandle) continue;
      await consumer.processMessage(msg.Body);
      await sqs.send(
        new DeleteMessageCommand({
          QueueUrl: config.outboxQueueUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }),
      );
    }

    expect(calls).toContain("rep-e2e-1");
  });
});

describe("ReportPublishedHandler.handle (real PDF render)", () => {
  it("decrypts, renders, archives to S3, and stamps pdfS3Key + pdfRenderedAt", async () => {
    const { prisma, s3, config } = requireSetup();
    const handler = newHandler();
    const { reportId, versionId, contentHash } = await seedSignedReportVersion();

    await handler.handle(buildEvent(reportId, versionId, contentHash));

    const updated = await prisma.reportVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(updated.pdfS3Key).toBe(
      `reports/${tenantId}/${reportId}/${versionId}.pdf`,
    );
    expect(updated.pdfRenderedAt).toBeInstanceOf(Date);

    // Pull the object back from S3 and confirm it's a non-trivial PDF.
    const s3Object = await s3.send(
      new GetObjectCommand({
        Bucket: config.reportsBucket,
        Key: updated.pdfS3Key ?? "",
      }),
    );
    expect(s3Object.ContentType).toBe("application/pdf");
    const bytes = await s3Object.Body?.transformToByteArray();
    expect(bytes?.length ?? 0).toBeGreaterThan(1000);
    // PDFs always start with "%PDF-".
    expect(Buffer.from(bytes ?? new Uint8Array()).subarray(0, 5).toString()).toBe(
      "%PDF-",
    );
  });

  it("is idempotent — second invocation skips when pdfRenderedAt is set", async () => {
    const { prisma } = requireSetup();
    const handler = newHandler();
    const { reportId, versionId, contentHash } = await seedSignedReportVersion();

    await handler.handle(buildEvent(reportId, versionId, contentHash));
    const after1 = await prisma.reportVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(after1.pdfRenderedAt).not.toBeNull();

    // Re-run; pdfRenderedAt should not move.
    await handler.handle(buildEvent(reportId, versionId, contentHash));
    const after2 = await prisma.reportVersion.findUniqueOrThrow({
      where: { id: versionId },
    });
    expect(after2.pdfRenderedAt?.getTime()).toBe(after1.pdfRenderedAt?.getTime());
  });

  it("rejects when the event's contentHash differs from the DB", async () => {
    const handler = newHandler();
    const { reportId, versionId } = await seedSignedReportVersion();

    const tampered = buildEvent(reportId, versionId, "0".repeat(64));

    await expect(handler.handle(tampered)).rejects.toThrow(/contentHash mismatch/);
  });

  it("rejects when the DB cipher has been tampered with", async () => {
    const { prisma, encryption } = requireSetup();
    const handler = newHandler();
    const { reportId, versionId, contentHash } = await seedSignedReportVersion();

    // Mutate the encrypted payload so the recomputed hash won't match.
    const tamperedSections: ReportSectionsInput = {
      ...SLICE_SECTIONS,
      executive_summary: { kind: "editorial", content: "Tampered narrative." },
    };
    const tamperedCipher = await encryption.encryptJson(tenantId, tamperedSections);
    await prisma.reportVersion.update({
      where: { id: versionId },
      data: { contentCipher: tamperedCipher },
    });

    await expect(
      handler.handle(buildEvent(reportId, versionId, contentHash)),
    ).rejects.toThrow(/contentHash mismatch vs DB/);
  });

  it("rejects when the event's tenantId doesn't match the DB row", async () => {
    const handler = newHandler();
    const { reportId, versionId, contentHash } = await seedSignedReportVersion();

    const wrongTenantEvent = {
      ...buildEvent(reportId, versionId, contentHash),
      tenantId: "tenant-mismatch",
    };
    await expect(handler.handle(wrongTenantEvent)).rejects.toThrow(/tenant mismatch/);
  });
});
