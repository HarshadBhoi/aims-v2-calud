/**
 * Trace-context propagation helpers for outbox events.
 *
 * Captures the active OTel trace context as a W3C-formatted carrier so we
 * can embed it in an `OutboxEvent.payload` and the worker can resume the
 * trace when it processes the event. Per task 4.8.
 *
 * Returns an empty object when no active trace exists (e.g., NODE_ENV=test
 * with OTel disabled), which is safe to spread into a payload — the
 * consumer treats absent fields as "no parent context".
 */

import { context, propagation } from "@opentelemetry/api";

export type TraceCarrier = {
  readonly traceparent?: string;
  readonly tracestate?: string;
};

export function captureTraceCarrier(): TraceCarrier {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  const out: TraceCarrier = {};
  if (typeof carrier["traceparent"] === "string") {
    (out as { traceparent: string }).traceparent = carrier["traceparent"];
  }
  if (typeof carrier["tracestate"] === "string") {
    (out as { tracestate: string }).tracestate = carrier["tracestate"];
  }
  return out;
}
