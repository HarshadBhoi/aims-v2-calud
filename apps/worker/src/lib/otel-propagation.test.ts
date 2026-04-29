/**
 * Unit tests for the trace-propagation helpers.
 *
 * Sets up a real W3C TraceContext propagator + AsyncHooks context manager
 * so `propagation.extract` and `context.with` actually carry trace IDs
 * across the call. These primitives are what NodeSDK installs in
 * production; importing them directly from OTel core lets us verify
 * propagation without bringing up the full SDK in tests.
 */

import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncHooksContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { beforeAll, describe, expect, it } from "vitest";

import { carrierFromPayload, runInExtractedContext } from "./otel-propagation";

beforeAll(() => {
  const ctxManager = new AsyncHooksContextManager();
  ctxManager.enable();
  context.setGlobalContextManager(ctxManager);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});

describe("carrierFromPayload", () => {
  it("returns the carrier for a payload with __traceparent", () => {
    const c = carrierFromPayload({
      __traceparent: "00-1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
    });
    expect(c?.traceparent).toBe(
      "00-1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
    );
  });

  it("includes tracestate when present", () => {
    const c = carrierFromPayload({
      __traceparent: "00-1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
      __tracestate: "vendor=value",
    });
    expect(c?.tracestate).toBe("vendor=value");
  });

  it("returns undefined when __traceparent is missing", () => {
    expect(carrierFromPayload({})).toBeUndefined();
    expect(carrierFromPayload({ __tracestate: "x" })).toBeUndefined();
  });

  it("returns undefined for non-object payloads", () => {
    expect(carrierFromPayload(null)).toBeUndefined();
    expect(carrierFromPayload("foo")).toBeUndefined();
    expect(carrierFromPayload(undefined)).toBeUndefined();
  });
});

describe("runInExtractedContext", () => {
  it("continues a remote trace context inside fn", async () => {
    const traceId = "1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const traceparent = `00-${traceId}-bbbbbbbbbbbbbbbb-01`;

    let observedTraceId: string | undefined;
    await runInExtractedContext({ traceparent }, () => {
      observedTraceId = trace
        .getSpanContext(context.active())
        ?.traceId;
      return Promise.resolve();
    });

    expect(observedTraceId).toBe(traceId);
  });

  it("runs fn in the current context when carrier is undefined", async () => {
    let invoked = false;
    await runInExtractedContext(undefined, () => {
      invoked = true;
      return Promise.resolve();
    });
    expect(invoked).toBe(true);
  });

  it("runs fn even when carrier has no traceparent", async () => {
    let invoked = false;
    await runInExtractedContext({}, () => {
      invoked = true;
      return Promise.resolve();
    });
    expect(invoked).toBe(true);
  });
});
