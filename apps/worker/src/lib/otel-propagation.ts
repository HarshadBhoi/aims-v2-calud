/**
 * Trace-context propagation helpers for the SQS consumer.
 *
 * Extracts a W3C trace carrier embedded in an outbox-event payload and
 * runs the handler under the resumed context. The carrier shape mirrors
 * what `apps/api/src/lib/otel-propagation.ts` writes — a record with
 * optional `traceparent` + `tracestate` strings.
 *
 * If no traceparent is present, runs in the worker's current (root)
 * context. Per task 4.8.
 */

import { context, propagation } from "@opentelemetry/api";

export type TraceCarrier = {
  traceparent?: string;
  tracestate?: string;
};

export function runInExtractedContext<T>(
  carrier: TraceCarrier | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!carrier?.traceparent) return fn();
  const extracted = propagation.extract(context.active(), carrier);
  return context.with(extracted, fn);
}

/**
 * Pull the carrier out of an outbox-event payload (slice A convention:
 * `__traceparent` / `__tracestate` keys to mark them as metadata, not
 * domain data).
 */
export function carrierFromPayload(payload: unknown): TraceCarrier | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const obj = payload as Record<string, unknown>;
  const traceparent = obj["__traceparent"];
  const tracestate = obj["__tracestate"];
  if (typeof traceparent !== "string") return undefined;
  return {
    traceparent,
    ...(typeof tracestate === "string" ? { tracestate } : {}),
  };
}
