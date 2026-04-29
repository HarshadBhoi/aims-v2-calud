/**
 * OpenTelemetry bootstrap (slice A).
 *
 * Per VERTICAL-SLICE-PLAN.md §4 W4 task 4.8: traces flow browser → Fastify
 * → Prisma → Postgres → outbox → SQS → worker → S3. Slice A uses the
 * console exporter so spans land in stdout; the OTel Collector / Grafana /
 * Tempo wiring lands in W5+.
 *
 * IMPORTANT: this module MUST be imported before any other module that
 * the auto-instrumentations need to patch (Fastify, Prisma, AWS SDK, pg).
 * In `index.ts` it sits at the very top of the import list.
 *
 * Disabled when `NODE_ENV === "test"` so vitest runs aren't drowned in
 * span output. Set `AIMS_OTEL_DISABLED=1` to opt out in dev too.
 */

import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

const DISABLED =
  process.env["NODE_ENV"] === "test" || process.env["AIMS_OTEL_DISABLED"] === "1";

let sdk: NodeSDK | null = null;

if (!DISABLED) {
  // Quiet by default; flip via OTEL_LOG_LEVEL=debug.
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "aims-api",
      [ATTR_SERVICE_VERSION]: process.env["npm_package_version"] ?? "0.0.0",
      "deployment.environment": process.env["NODE_ENV"] ?? "development",
    }),
    spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    instrumentations: [
      getNodeAutoInstrumentations({
        // Quiet down the very chatty ones for slice A; flip back when we add
        // a real exporter and want full coverage.
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  });

  sdk.start();

  const shutdown = async (): Promise<void> => {
    try {
      await sdk?.shutdown();
    } catch (err) {
      console.error("OTel shutdown failed", err);
    }
  };

  process.once("SIGTERM", () => {
    void shutdown();
  });
  process.once("SIGINT", () => {
    void shutdown();
  });
}
