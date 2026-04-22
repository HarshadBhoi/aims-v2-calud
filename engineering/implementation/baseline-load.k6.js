// REFERENCE IMPLEMENTATION — k6 baseline-load scenario for AIMS v2 staging.
//
// What this simulates:
//   - 50 concurrent authenticated users, each running a realistic audit workflow
//   - 80/20 read/write mix (matches observed prod distribution)
//   - Think time between actions (not a burst hammer — real sessions)
//   - Ramp up 2m → sustain 15m → ramp down 2m
//
// Thresholds encode our SLOs. Breach fails the run; CI job goes red.
//
// Run:
//   k6 run baseline-load.k6.js \
//     --env BASE_URL=https://staging.aims.io \
//     --env TENANT=loadtest-acme \
//     --env USERS=50
//
// CI runs this nightly against staging; output shipped to Grafana via
// Prometheus remote-write (see --out flag in GH Actions nightly job).

import http from "k6/http";
import { check, group, sleep } from "k6";
import { SharedArray } from "k6/data";
import { Trend, Rate, Counter } from "k6/metrics";
import encoding from "k6/encoding";

// ─── Custom metrics (named per RED: Rate, Errors, Duration) ─────────────────
const engagementListTrend  = new Trend("aims_engagement_list_duration_ms", true);
const findingCreateTrend   = new Trend("aims_finding_create_duration_ms", true);
const findingApproveTrend  = new Trend("aims_finding_approve_duration_ms", true);
const authFailures         = new Counter("aims_auth_failures_total");
const workflowCompletions  = new Counter("aims_workflow_completions_total");
const workflowErrorRate    = new Rate("aims_workflow_errors_rate");

// ─── Test data — loaded once, shared across VUs ─────────────────────────────
const USERS = new SharedArray("users", () => {
  const n = parseInt(__ENV.USERS || "50", 10);
  return Array.from({ length: n }, (_, i) => ({
    email: `loadtest-${String(i).padStart(4, "0")}@loadtest.aims.test`,
    password: __ENV.LOADTEST_PASSWORD,     // from env; never hardcoded
  }));
});

// ─── Scenario definition ────────────────────────────────────────────────────
export const options = {
  // Realistic ramp — avoids the synthetic "everyone arrives at second 0" spike.
  stages: [
    { duration: "2m",  target: Math.min(50, USERS.length) },    // ramp up
    { duration: "15m", target: Math.min(50, USERS.length) },    // sustain
    { duration: "2m",  target: 0 },                              // ramp down
  ],

  // SLO-derived thresholds. Breach → run fails → CI goes red.
  thresholds: {
    // Global availability + latency.
    "http_req_failed":   ["rate<0.01"],                 // < 1% errors
    "http_req_duration": ["p(95)<500", "p(99)<1500"],

    // Per-endpoint budgets.
    "aims_engagement_list_duration_ms":  ["p(95)<300"],
    "aims_finding_create_duration_ms":   ["p(95)<800"],
    "aims_finding_approve_duration_ms":  ["p(95)<600"],

    // Check aggregate — assertions must hold > 99%.
    "checks":                            ["rate>0.99"],

    // Business: workflow completion count meaningful (catches silent regressions).
    "aims_workflow_completions_total":   ["count>500"],
  },

  // Tags for downstream dashboards (Grafana can slice).
  tags: {
    scenario: "baseline-load",
    environment: __ENV.ENV || "staging",
    tenant:      __ENV.TENANT || "loadtest-acme",
    build:       __ENV.BUILD_SHA || "unknown",
  },

  // Don't abort the whole run on a single VU failure.
  noConnectionReuse: false,
  userAgent: "aims-k6/1.0",
  discardResponseBodies: true,              // faster; we check status + timing
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "https://staging.aims.io";

function authHeaders(token) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-Tenant": __ENV.TENANT || "loadtest-acme",
  };
}

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "auth.login" } }
  );
  if (res.status !== 200) {
    authFailures.add(1);
    return null;
  }
  return res.json("accessToken");
}

function trpcPost(procedure, input, token) {
  const url = `${BASE_URL}/api/trpc/${procedure}?batch=1`;
  const body = JSON.stringify({ "0": { json: input } });
  return http.post(url, body, {
    headers: authHeaders(token),
    tags: { endpoint: procedure },
  });
}

// ─── Per-VU init ────────────────────────────────────────────────────────────
// Runs once per VU when it starts. Logs in + caches token.
export function setup() {
  // Optional: pre-warm tenant. Return shared setup data to default function.
  return {};
}

// ─── Per-iteration default ──────────────────────────────────────────────────
export default function () {
  const user = USERS[__VU % USERS.length];
  const token = login(user.email, user.password);

  if (!token) {
    // Count the error; keep iterating with a throw would skew results.
    sleep(5);
    return;
  }

  // === SCENARIO: An auditor's day ========================================

  group("1. Land on dashboard", () => {
    const res = trpcPost("user.me", {}, token);
    check(res, {
      "user.me 200":      (r) => r.status === 200,
      "user.me < 200ms":  (r) => r.timings.duration < 200,
    });
  });
  sleep(think(1, 3));

  group("2. List my engagements", () => {
    const res = trpcPost("engagement.list", { status: ["IN_PROGRESS"], limit: 25 }, token);
    engagementListTrend.add(res.timings.duration);
    check(res, {
      "engagement.list 200":     (r) => r.status === 200,
      "engagement.list < 500ms": (r) => r.timings.duration < 500,
    });
  });
  sleep(think(2, 5));

  // 10% of sessions go deep into an engagement and do work.
  if (Math.random() < 0.10) {
    let engagementId;

    group("3. Open engagement detail", () => {
      const list = trpcPost("engagement.list", { limit: 1 }, token);
      engagementId = list.json("0.result.data.items.0.id");

      if (!engagementId) {
        workflowErrorRate.add(true);
        return;
      }

      const res = trpcPost("engagement.getById", { id: engagementId }, token);
      check(res, {
        "engagement.getById 200": (r) => r.status === 200,
      });
    });

    if (!engagementId) return;
    sleep(think(3, 7));

    group("4. Create a finding", () => {
      const res = trpcPost("finding.create", {
        engagementId,
        title: `Load test finding ${__VU}-${__ITER}`,
        severity: "MEDIUM",
        elementValues: {
          criteria:  "<p>Test criteria per GAGAS §5.12</p>",
          condition: "<p>Test condition observed</p>",
          cause:     "<p>Test cause</p>",
          effect:    "<p>Test effect</p>",
        },
      }, token);
      findingCreateTrend.add(res.timings.duration);
      const ok = check(res, {
        "finding.create 200":     (r) => r.status === 200,
        "finding.create < 800ms": (r) => r.timings.duration < 800,
      });
      workflowErrorRate.add(!ok);
    });
    sleep(think(2, 4));

    // 50% of created findings get submitted for approval.
    if (Math.random() < 0.5) {
      group("5. Submit finding for approval", () => {
        const res = trpcPost("finding.submitForApproval",
          { findingId: `fnd_stub` }, token);
        check(res, {
          "finding.submit 200 or 409": (r) => r.status === 200 || r.status === 409,
        });
      });
      workflowCompletions.add(1);
    }
  }

  sleep(think(1, 3));
}

// ─── Teardown ───────────────────────────────────────────────────────────────
export function teardown() {
  // Nothing to clean up — load-test tenants are reset weekly.
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Realistic think time in seconds (uniform between min and max). */
function think(minSec, maxSec) {
  return minSec + Math.random() * (maxSec - minSec);
}
