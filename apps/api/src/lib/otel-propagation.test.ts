/**
 * Unit tests for `captureTraceCarrier`.
 *
 * Sets up a real W3C TraceContext propagator + AsyncHooks context manager,
 * starts a span, and asserts the helper produces a W3C-formatted carrier
 * that round-trips back through `propagation.extract`.
 */

import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { beforeAll, describe, expect, it } from "vitest";

import { captureTraceCarrier } from "./otel-propagation";

beforeAll(() => {
  const ctxManager = new AsyncHooksContextManager();
  ctxManager.enable();
  context.setGlobalContextManager(ctxManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());

  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(new InMemorySpanExporter())],
  });
  trace.setGlobalTracerProvider(provider);
});

describe("captureTraceCarrier", () => {
  it("returns an empty object outside an active span", () => {
    const carrier = captureTraceCarrier();
    expect(carrier.traceparent).toBeUndefined();
  });

  it("returns a W3C traceparent when called inside an active span", () => {
    const tracer = trace.getTracer("propagation-test");
    let captured: string | undefined;
    tracer.startActiveSpan("root", (span) => {
      captured = captureTraceCarrier().traceparent;
      span.end();
    });
    expect(captured).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/);
  });
});
