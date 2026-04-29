/**
 * OpenTelemetry bootstrap (slice A) — worker tier.
 *
 * Mirrors apps/api/src/otel.ts. Loaded as the very first import in
 * `main.ts` so the auto-instrumentations attach before NestJS / Prisma /
 * AWS SDK modules resolve. Uses the console exporter; OTLP/Collector
 * arrives in W5+.
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
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "aims-worker",
      [ATTR_SERVICE_VERSION]: process.env["npm_package_version"] ?? "0.0.0",
      "deployment.environment": process.env["NODE_ENV"] ?? "development",
    }),
    spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())],
    instrumentations: [
      getNodeAutoInstrumentations({
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
