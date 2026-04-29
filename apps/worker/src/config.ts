/**
 * Worker runtime configuration.
 *
 * Resolved once at startup. Reads env vars; falls back to dev defaults so
 * `pnpm dev` against the docker-compose stack just works.
 */

export type WorkerConfig = {
  readonly nodeEnv: "development" | "test" | "production";
  readonly awsRegion: string;
  readonly awsEndpointUrl: string | undefined;
  readonly outboxQueueUrl: string;
  readonly outboxBatchSize: number;
  readonly outboxIntervalMs: number;
  readonly sqsWaitTimeSeconds: number;
  readonly sqsVisibilityTimeoutSeconds: number;
  readonly outboxMaxAttempts: number;
  readonly kmsMasterKeyAlias: string;
  readonly reportsBucket: string;
};

function optional(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

const DEFAULT_OUTBOX_QUEUE_URL =
  "http://localhost:4566/000000000000/aims-events-outbox";

export function loadConfig(): WorkerConfig {
  const rawNodeEnv = process.env["NODE_ENV"] ?? "development";
  const nodeEnv: WorkerConfig["nodeEnv"] =
    rawNodeEnv === "production"
      ? "production"
      : rawNodeEnv === "test"
        ? "test"
        : "development";

  return {
    nodeEnv,
    awsRegion: process.env["AWS_REGION"] ?? "us-east-1",
    awsEndpointUrl: optional("AWS_ENDPOINT_URL"),
    outboxQueueUrl: process.env["AIMS_OUTBOX_QUEUE_URL"] ?? DEFAULT_OUTBOX_QUEUE_URL,
    outboxBatchSize: Number.parseInt(process.env["AIMS_OUTBOX_BATCH_SIZE"] ?? "25", 10),
    outboxIntervalMs: Number.parseInt(
      process.env["AIMS_OUTBOX_INTERVAL_MS"] ?? "2000",
      10,
    ),
    sqsWaitTimeSeconds: Number.parseInt(
      process.env["AIMS_SQS_WAIT_TIME_SECONDS"] ?? "10",
      10,
    ),
    sqsVisibilityTimeoutSeconds: Number.parseInt(
      process.env["AIMS_SQS_VISIBILITY_TIMEOUT_SECONDS"] ?? "30",
      10,
    ),
    outboxMaxAttempts: Number.parseInt(
      process.env["AIMS_OUTBOX_MAX_ATTEMPTS"] ?? "5",
      10,
    ),
    kmsMasterKeyAlias:
      process.env["AWS_KMS_MASTER_KEY_ALIAS"] ?? "alias/aims-dev-master",
    reportsBucket: process.env["AIMS_REPORTS_BUCKET"] ?? "aims-dev-reports",
  };
}
