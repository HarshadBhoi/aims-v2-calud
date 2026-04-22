# Performance Testing

> k6-based load, soak, spike, and stress testing. Budgets that cover response latency, throughput, resource utilization, and UX metrics. Nightly + pre-release; not per-PR (too slow, too noisy).

---

## 1. Performance Testing Goals

Different tests answer different questions:

| Test type | Question answered | Typical duration |
|-----------|-------------------|-------------------|
| **Smoke** | Does the app respond at all under minimal load? | 1 min |
| **Load** | Does it meet SLOs under expected traffic? | 15–30 min |
| **Soak (endurance)** | Does it stay healthy over hours? (memory leaks, connection exhaustion) | 4–12 h |
| **Spike** | How does it react to sudden 10× traffic? | 10 min |
| **Stress** | Where does it break? What's the ceiling? | 30–60 min |
| **Breakpoint** | At what load does error rate cross 1%? | 30 min |
| **Scalability** | As we add replicas, does throughput scale linearly? | 30 min |

All of them are **scheduled, not per-PR**. Per-PR checks are limited to unit-level micro-benchmarks + bundle budgets (cheap).

---

## 2. Tool — k6

### Why k6
- **JavaScript scenarios** — engineers can author tests; no proprietary DSL
- **HTTP + WebSocket + gRPC** — covers our stack
- **k6 Cloud or self-hosted** — flexible
- **Built-in SLO assertions** — threshold failures fail the test
- **Good Prometheus + Grafana integration** — results feed same observability plane
- **xk6 extensions** — for WebSocket tRPC or custom protocols

### Alternatives considered
- **Artillery** — fine, but k6 has better ecosystem
- **JMeter** — UI-heavy, XML scenarios, less engineer-friendly
- **Gatling** — Scala; cognitive overhead for a mostly-TS team
- **Locust** — Python; team is TS-first

---

## 3. Test Layout

```
load-tests/
├── k6/
│   ├── scenarios/
│   │   ├── smoke.js                # 1-user sanity
│   │   ├── baseline-load.js        # expected production load
│   │   ├── spike.js                # sudden 10× burst
│   │   ├── soak-4h.js              # endurance
│   │   ├── engagement-create.js    # single-flow stress
│   │   ├── approval-chain.js       # multi-step workflow
│   │   └── pdf-generation.js       # heavy background jobs
│   ├── lib/
│   │   ├── auth.js                 # login + token cache
│   │   ├── api.js                  # tRPC request helpers
│   │   ├── data.js                 # fixture generators
│   │   └── checks.js               # reusable assertions
│   ├── config/
│   │   ├── environments.js         # dev/staging/prod URLs
│   │   └── thresholds.js           # SLO thresholds
│   └── README.md
└── reports/
    └── .gitignore                  # outputs; not committed
```

### Running locally
```bash
k6 run load-tests/k6/scenarios/baseline-load.js \
  --env ENV=staging \
  --env TENANT=load-test-tenant
```

### CI
- Nightly: full suite (except stress/soak — those weekly)
- Pre-release: baseline-load + spike must pass
- Manual trigger: `workflow_dispatch` for targeted tests

---

## 4. Scenario Example — Baseline Load

```js
// load-tests/k6/scenarios/baseline-load.js
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";
import { login, createEngagement, createFinding } from "../lib/api.js";
import { THRESHOLDS } from "../config/thresholds.js";

export const options = {
  // Ramp up, hold, ramp down.
  stages: [
    { duration: "2m",  target: 50 },   // ramp to 50 VUs
    { duration: "15m", target: 50 },   // sustain
    { duration: "2m",  target: 0 },
  ],
  thresholds: THRESHOLDS.baselineLoad,
  tags: { scenario: "baseline-load" },
};

// Per-iteration setup runs once per VU.
export function setup() {
  // Optional: seed N tenants in parallel via admin API, return tokens.
  const tokens = [];
  for (let i = 0; i < 50; i++) {
    tokens.push(login(`loadtest-${i}@aims.test`, "password"));
  }
  return { tokens };
}

export default function (data) {
  const token = data.tokens[__VU % data.tokens.length];

  group("dashboard landing", () => {
    const r = http.get(`${__ENV.BASE_URL}/api/trpc/user.me`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    check(r, {
      "user.me 200": (r) => r.status === 200,
      "user.me < 300ms": (r) => r.timings.duration < 300,
    });
  });

  sleep(Math.random() * 2);      // think time

  group("list engagements", () => {
    const r = http.post(`${__ENV.BASE_URL}/api/trpc/engagement.list?batch=1`,
      JSON.stringify({ "0": { json: { status: ["IN_PROGRESS"], limit: 25 } } }),
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );
    check(r, {
      "engagement.list 200": (r) => r.status === 200,
      "engagement.list < 500ms": (r) => r.timings.duration < 500,
    });
  });

  sleep(Math.random() * 5 + 3);

  // 10% of VUs create a finding each iteration
  if (Math.random() < 0.1) {
    group("create finding", () => {
      const r = createFinding(token, { /* ... */ });
      check(r, {
        "finding.create 200": (r) => r.status === 200,
        "finding.create < 800ms": (r) => r.timings.duration < 800,
      });
    });
  }

  sleep(Math.random() * 3);
}
```

### Reusable thresholds

```js
// load-tests/k6/config/thresholds.js
export const THRESHOLDS = {
  baselineLoad: {
    "http_req_duration": [
      "p(95)<300",
      "p(99)<800",
    ],
    "http_req_failed": ["rate<0.01"],      // < 1% errors
    "checks": ["rate>0.99"],               // > 99% checks pass
  },
  spike: {
    "http_req_duration": [
      "p(95)<1000",   // tolerate higher latency under spike
      "p(99)<3000",
    ],
    "http_req_failed": ["rate<0.05"],      // < 5% errors acceptable briefly
  },
  soak: {
    "http_req_duration": ["p(95)<400"],
    "http_req_failed": ["rate<0.01"],
    "data_received": ["count>10000"],
  },
};
```

---

## 5. Performance Budgets (Per Endpoint)

We budget per **endpoint**, not just overall. Bound to the SLO sheet:

| Endpoint | Baseline (50 VU) p95 | Spike (500 VU) p95 | Notes |
|----------|----------------------|---------------------|-------|
| `GET /api/user.me` | < 100 ms | < 500 ms | Cached heavily |
| `POST /api/engagement.list` | < 300 ms | < 1 s | Paginated |
| `POST /api/engagement.create` | < 500 ms | < 1.5 s | Writes |
| `POST /api/finding.create` | < 800 ms | < 2 s | Heaviest happy-path write |
| `POST /api/finding.approve` | < 600 ms | < 1.5 s | Workflow transition |
| `POST /api/report.generate` (async) | Enqueue < 200 ms | < 500 ms | Real work in worker |
| `GET /api/healthz` | < 20 ms | < 50 ms | Must stay fast |

Endpoint-level budgets enforced via per-tag thresholds in k6:

```js
thresholds: {
  "http_req_duration{endpoint:engagement.create}": ["p(95)<500"],
  "http_req_duration{endpoint:finding.create}":    ["p(95)<800"],
}
```

---

## 6. Frontend Performance Testing

### Lighthouse CI (per-PR, already in CI-CD.md §14)
Every PR runs Lighthouse against preview:
- Performance score ≥ 85 on top 10 routes
- LCP < 2.5 s, INP < 200 ms, CLS < 0.1 (lab conditions)
- Bundle size budgets per route (enforced in CI)

### Real User Monitoring (RUM) — production
`web-vitals` library → telemetry → Prometheus → SLO alerts:
- p75 LCP across all tenants < 2.5 s (30-day rolling)
- p75 INP < 200 ms
- p75 CLS < 0.1

Alerts when p75 regresses > 20% vs 7-day baseline.

### Synthetic (Checkly or Datadog Synthetics)
Critical flows run every 1 min from US, EU, APAC:
- Login + dashboard load — full page timing
- Create engagement wizard — flow timing
- View finding detail — p95 time
Failures page on-call.

---

## 7. Database Performance Testing

### Query budgets
Every procedure has a DB-time budget:
- Simple list (p95 < 100 ms DB time)
- Aggregated dashboard query (p95 < 300 ms)
- Write with side effects (p95 < 250 ms including triggers)

### pg_stat_statements
Always-on in staging + prod. Top-20 slowest queries reviewed weekly by backend + DBA. Regressions → ticket.

### Explain plan capture
Integration tests that touch new queries capture `EXPLAIN ANALYZE` output → committed as test artifact. Plan change on future PR → reviewer sees it.

```ts
const explain = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`);
expect(explain[0]["Plan"]["Total Cost"]).toBeLessThan(500);
```

### Migration performance
Migrations against a DB cloned from prod (sanitized) measure lock times, duration. If > 30 s for non-CONCURRENT: reject — expand-migrate-contract instead.

---

## 8. Worker / Queue Performance

Workers (BullMQ) have their own perf tests:

### Throughput
- PDF worker: ≥ 20 jobs/min per pod (baseline)
- Generic worker: ≥ 100 jobs/min per pod
- Tests measure queue drain time for N jobs; assert rate

### Tail latency
- p95 job time in queue + processing < 5 min (high-priority)
- p99 < 10 min

### Failure handling
- Simulate 20% random failures; assert retries + DLQ routing works; assert no job loss

---

## 9. Test Data Strategy for Performance

### Dedicated load-test tenants
- In staging: `loadtest-0001` through `loadtest-0999`
- Pre-seeded with realistic data (500 engagements, 2000 findings, etc.)
- Reset weekly via script
- Isolated from real tenants in dashboards via tag

### Data shape matters
- Don't test with all trivial-sized engagements; use prod-like distribution (long tail)
- Include large findings (50KB+ rich text)
- Include engagements with many files attached

### Real-world distributions
- 80% reads, 20% writes (measured from prod)
- Query patterns match real: mostly "list my engagements," not "list all findings cross-tenant"
- Bursts around quarter-end (business drives traffic pattern)

---

## 10. Stress Testing — Finding The Ceiling

Quarterly stress test to find where the system actually breaks:

```js
export const options = {
  stages: [
    { duration: "5m", target: 100 },
    { duration: "5m", target: 500 },
    { duration: "5m", target: 1000 },
    { duration: "5m", target: 2000 },   // find the limit
    { duration: "5m", target: 0 },
  ],
};
```

Observe:
- Where does p99 latency spike?
- Where does error rate exceed 5%?
- What resource saturates first (CPU, DB connections, memory, Redis)?
- Do auto-scalers respond fast enough?

Output: **capacity plan** — "our current prod can handle 3× baseline; we scale out at 2.5×". Updated quarterly.

---

## 11. Chaos / Resilience Testing (Phase 2)

Injected faults in staging:
- Random pod kills (verify no request loss; retries work)
- Network latency injection between api and DB (verify timeouts + graceful degradation)
- Simulated DB failover (verify app reconnects, queued writes retry)
- Simulated Redis outage (verify fallback paths; no cascading failure)
- AZ "outage" (drain one AZ; verify other two absorb load)

Tool: **Chaos Mesh** on EKS. Run during game days; not continuously.

---

## 12. Performance Regressions In CI (Light-Touch)

### Per-PR
- Bundle size budgets (fast)
- Lighthouse CI budgets
- Micro-benchmarks of hot path functions (Tinybench or `vitest --bench` for pure functions)

### NOT per-PR
- Full k6 load test (too slow, noisy, flaky at scale)

### Nightly
- k6 baseline-load on staging
- k6 spike test
- Lighthouse full scan (all routes)
- DB query plan drift check

### Weekly
- Soak test (4-hour)
- Chaos scenarios (in staging)

### Monthly
- Stress test to capacity limit
- Report to engineering leadership

---

## 13. Reporting + Dashboards

### k6 → Grafana
k6 outputs to Prometheus remote-write or Loki logs. Grafana dashboards show:
- Per-run summary: VUs, throughput, error rate, p50/p95/p99
- Diff against previous run (regression detection)
- Per-endpoint breakdown

### Thresholds → CI annotations
k6 threshold failures mark CI job red with specific threshold name + actual value — easy to read in PR comment.

### Slack bot
Nightly summary to `#performance`:
> Baseline-load (2026-04-20): p95=287ms (budget 300ms ✅) · err=0.8% · throughput=142 req/s · vs yesterday -2% latency, +1% throughput

---

## 14. Known Performance Traps We Test For

- **N+1 queries**: tRPC endpoints that look cheap but fan out to DB
- **Connection pool exhaustion** under load (Prisma connection pool tuning)
- **Redis hot keys** (e.g., shared cache key for all tenants)
- **Memory leaks**: long-soak tests watch RSS growth
- **Garbage collection pauses**: Node.js GC hints in metrics
- **Slow startup**: cold-pod startup time budget (must stay < 30s for HPA)
- **Long-running transactions** holding locks
- **Puppeteer resource leaks** in PDF worker (Chromium processes)

Each has a specific test case in the suite.

---

## 15. Benchmark vs Load Test

**Don't confuse them:**

| | Benchmark | Load test |
|-|-----------|-----------|
| Scope | Single function/endpoint | Full system under realistic mix |
| Duration | Seconds | Minutes to hours |
| Goal | Optimize hot path | Verify SLOs |
| Where | `vitest --bench`, Criterion | k6 |
| When | Before/after optimization PR | Nightly / pre-release |
| Environment | Local or isolated | Staging cluster |

Both have value. Don't use one as substitute for the other.

---

## 16. Cost of Performance Testing

### AWS costs
- Staging stress test: ~$50 per quarterly run (spin up extra node group)
- Load-test tenants: seeded once; marginal cost
- k6 Cloud (optional): ~$300/month for shared org seat

### Engineering time
- Nightly suite: self-service; no one-off maintenance
- Quarterly stress test: 1 engineer-day per quarter
- Pre-release perf review: 2 engineer-hours
- Regression investigation: variable; target < 5% of engineering hours

Budget for this. Skimping on perf testing → prod outages → far more expensive.

---

## 17. Common Pitfalls

- **Testing on dev** (too small — doesn't represent prod). Always staging.
- **Testing at off-hours when dependencies are quiet** — use realistic concurrent load.
- **Not warming caches** — always include a ramp-up before steady-state measurement.
- **Treating p50 as success** — p99 is what users feel on bad days.
- **Ignoring variance** — 3 runs with wide variance hide real regressions.
- **Rubber-stamping** — "test passed" without reading the numbers.
- **No capacity plan** — knowing your max load is table stakes for SaaS.

---

## 18. Related Documents

- `TESTING-STRATEGY.md` — where perf tests fit in the pyramid
- `BACKEND-TESTING.md` — integration-level perf checks (query plan)
- `../devops/OBSERVABILITY.md` — SLOs + error-budget mapping
- `../devops/RELEASE.md` — perf gates on canary promotion
- `../database/PERFORMANCE.md` — DB-side tuning
- `../frontend/PERFORMANCE.md` — Core Web Vitals + bundle budgets
