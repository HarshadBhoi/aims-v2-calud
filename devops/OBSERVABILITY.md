# Observability

> OpenTelemetry-native: logs, metrics, traces through one collector. Sentry for errors. Grafana for dashboards. PagerDuty for alerts. SLO-driven alerting — page when the customer experience degrades, not when CPU spikes.

---

## 1. The Three Pillars + Errors

| Pillar | What | Tool | Retention |
|--------|------|------|-----------|
| **Logs** | Structured events ("user X created finding Y") | Pino → OTel Collector → CloudWatch Logs / Loki | 30d hot, 1y warm, 7y cold (audit logs) |
| **Metrics** | Time-series numbers (RPS, latency p95, queue depth) | OTel SDK → Prometheus (AMP) → Grafana | 15mo in AMP |
| **Traces** | Distributed request flow across services | OTel SDK → Tempo / Honeycomb | 7d full, 30d sampled |
| **Errors** | Exceptions with stack, source map, release | Sentry | 90d |

OpenTelemetry is the **single instrumentation surface** — app code emits OTel signals; collector routes them.

---

## 2. Why OTel-First

- **Vendor-neutral**: can swap Prometheus for Datadog, Tempo for Honeycomb, Loki for CloudWatch — no app code changes
- **One SDK**: don't learn Pino-specific + Prom-specific + Tempo-specific clients
- **Correlation**: a `traceId` threads through logs → metrics exemplars → traces automatically
- **Future-proof**: W3C standard, growing industry adoption

---

## 3. Data Flow

```
    Application pods (Next.js, NestJS, Workers)
           │
           │ OTel SDK (auto + manual instrumentation)
           │    - Logs (pino-otel transport)
           │    - Metrics (OTLP)
           │    - Traces (OTLP)
           ▼
    OTel Collector (DaemonSet on every node)
      ├── Processors:
      │     - batch (efficient export)
      │     - resource (inject service.name, k8s.* attributes)
      │     - attributes (redact PII)
      │     - tail_sampling (keep errors + slow + random 10%)
      │     - memory_limiter (backpressure)
      ├── Exporters:
      │     - otlp/prom:      → Prometheus (metrics)
      │     - otlp/tempo:     → Tempo (traces)
      │     - otlp/loki:      → Loki (logs)      [OR]
      │     - awscloudwatch:  → CloudWatch Logs  [alt for logs]
      │     - sentry:         → Sentry (errors only)
      └── Queue + retry (prevents telemetry loss on downstream outage)

    Dashboards + alerts:
      - Grafana (federates Prometheus + Tempo + Loki) → dashboards
      - Alertmanager → PagerDuty / Slack
      - Sentry → Slack + email (non-paging)
      - Statuspage updated on incident severity
```

---

## 4. Logging

### Library — Pino
- Fast (sync) structured JSON logger
- No string interpolation in hot paths
- Child loggers carry context (`logger.child({ tenantId, userId })`)

### Log Format (JSON, one per line)
```json
{
  "level": "info",
  "time": "2026-04-19T14:30:22.123Z",
  "service": "aims-api",
  "env": "production",
  "region": "us-east-1",
  "traceId": "abc123def456",
  "spanId": "789xyz",
  "tenantId": "tnt_01H...",
  "userId": "usr_01H...",
  "route": "POST /api/trpc/finding.create",
  "status": 200,
  "durationMs": 42,
  "msg": "finding created",
  "findingId": "fnd_01H..."
}
```

### Required Fields in Every Log
- `time` (ISO-8601 UTC)
- `level` (`trace` / `debug` / `info` / `warn` / `error` / `fatal`)
- `service` (one of `aims-web`, `aims-api`, `aims-worker`, ...)
- `env`, `region`
- `msg` (short, lowercase, no trailing period)

### Plus Context (where applicable)
- `traceId`, `spanId` (from OTel)
- `tenantId`, `userId` (set once at request enter, propagated)
- `requestId` (X-Request-ID header or generated)
- HTTP: `method`, `route`, `status`, `durationMs`, `userAgent` (hash, not raw)

### Log Levels — When to Use
| Level | When |
|-------|------|
| `trace` | Dev-only deep debugging (disabled in prod) |
| `debug` | Verbose ops detail (prod: off by default, toggleable per-pod) |
| `info` | Normal operations (request completed, entity created, job done) |
| `warn` | Recoverable issues (retry succeeded after 1 failure, deprecated API used) |
| `error` | Unrecoverable in scope (request failed, job failed) — fires Sentry |
| `fatal` | Process must exit (config invalid, DB connection string missing) |

### What NOT to Log
- **Restricted data** (passwords, tokens, PHI, SSN, credit cards) — enforced via pino redact config
- Entire request/response bodies at `info` level (just summary + IDs)
- PII in free text (email, full name) in production at default levels
- Successful health check hits (not useful; floods logs)

### Pino Redaction Rules
```ts
const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password', 'token', 'apiKey', 'secret',
      '*.password', '*.token', '*.apiKey',
      'user.ssn', 'user.dob',
    ],
    censor: '[REDACTED]',
  },
});
```

Complementary sanity check in otel-collector: regex processor catches obvious patterns (`\b\d{3}-\d{2}-\d{4}\b` for SSNs) and drops or redacts.

### Log Retention (Compliance-Aware)
| Log type | Hot | Warm | Cold | Immutable? |
|----------|-----|------|------|------------|
| Application logs | 30d | 90d | — | No |
| HTTP access logs (CloudFront) | 30d | 90d | 1y | No |
| VPC Flow logs | 30d | 90d | 1y | No |
| CloudTrail (AWS API) | 90d | 1y | 7y | Yes (log archive account + Object Lock) |
| Audit Event logs (app — see database/) | Forever | — | — | Yes (hash-chained in DB + S3 mirror) |
| Security / auth logs | 90d | 1y | 7y | Yes |

---

## 5. Metrics

### The Four Golden Signals (per service)
1. **Latency** — histogram of request durations
2. **Traffic** — requests per second
3. **Errors** — error rate (% of requests with 5xx / exception)
4. **Saturation** — CPU/memory utilization, queue depth, DB connection pool usage

### Metric Naming Convention
OTel convention + Prometheus-compatible:
- `http.server.duration` (histogram, ms)
- `http.server.request.count` (counter)
- `db.client.operations.duration`
- `queue.jobs.waiting` (gauge)
- `queue.jobs.completed` (counter)
- `cache.operations.count` (counter with `result=hit/miss`)

### Custom Business Metrics
Tracked for product & SRE visibility:
- `aims.engagements.created.total`
- `aims.findings.created.total` (labels: `severity`, `pack`)
- `aims.approvals.decision.total` (labels: `decision=approved/rejected`)
- `aims.reports.generated.total` (labels: `standard`)
- `aims.pdf.generation.duration.ms` (histogram)
- `aims.login.total` (labels: `method=password/mfa/sso`, `result=success/failure`)
- `aims.signup.total`

### Label Discipline
- **Never high-cardinality labels** (no `userId`, `findingId`, no free-text)
- Labels: `service`, `route`, `method`, `status_class`, `tenant_plan` (not `tenant_id`)
- Exemplars attach high-cardinality info (e.g., traceId → jump to trace)

### RED Method per Endpoint
- **R**ate: requests/s
- **E**rrors: errors/s
- **D**uration: p50, p95, p99 histogram

### USE Method per Resource (infra)
- **U**tilization
- **S**aturation
- **E**rrors

---

## 6. Traces

### Sampling
- **Head-based**: 100% for `/api/auth/*`, 100% for errors (via Sentry), 10% baseline
- **Tail-based** (in collector): keep all traces with latency > p99 or errors
- Preview/dev: 100% sampling (low volume)

### Required Spans
Each request root span:
- `service.name` (aims-api / aims-web / aims-worker)
- `http.route`, `http.method`, `http.status_code`
- `tenant.id` (for filtering in Tempo; not a metric label)
- `user.id` (for debugging user-specific issues)

Auto-instrumented by OTel:
- Incoming HTTP (Next.js, NestJS)
- Outgoing HTTP (fetch, axios)
- Database (Prisma)
- Redis / BullMQ
- Kafka (Phase 3)

Manual spans where critical:
- `dynamic-form.validate` (pack-driven validation)
- `pdf.render` (long-running operation)
- `approval.advance` (multi-step workflow)

### Propagation
- W3C `traceparent` header across service boundaries
- Browser → backend: Next.js middleware extracts client-sent `traceparent`
- Backend → worker (via BullMQ): job payload carries context; worker continues trace
- Async boundaries explicit in code (OTel `context.with()` pattern)

---

## 7. Error Tracking — Sentry

### What Goes to Sentry
- Unhandled exceptions (backend + frontend)
- Explicitly captured errors (`Sentry.captureException(err, { extra: {...} })`)
- React error boundaries
- Client-side console errors (auto-captured)
- Performance transactions exceeding SLO (opt-in)

### What Does NOT Go to Sentry
- 4xx client errors (expected — validation, permission)
- Canceled requests (user nav away)
- Known-noise errors (whitelisted via `ignoreErrors`)
- Low-severity log warnings (they live in Loki/CloudWatch)

### Release Tracking
- Every deploy creates a Sentry Release with git SHA
- Source maps uploaded (and frontend build maps) for stack-trace symbolication
- "First seen in release vX.Y.Z" — sets regression detection

### Alerting from Sentry
- `error_rate > 2× baseline in 5 min` → Slack `#sentry`
- New issue type in prod → Slack
- Sentry does NOT page (PagerDuty pages; Sentry informs)

### Privacy
- User data scrubbed before send (Sentry `beforeSend` hook)
- Server: no request body in Sentry event; only sanitized context
- Frontend: no form values; only interaction + error context
- Breadcrumbs redacted per same rules as Pino

---

## 8. SLIs, SLOs, SLAs

### SLI Definitions (what we measure)

| SLI | Definition | Measurement window |
|-----|-----------|--------------------|
| Availability | % of requests that complete with 2xx/3xx in < 1 min | 30d rolling |
| Latency (p95) | 95th pct of request duration, excluding heavy endpoints | 30d rolling |
| Latency (p99) | Same, 99th | 30d rolling |
| Correctness | % of CI+E2E passing without flakes | 7d rolling |
| Durability | % of customer-uploaded files retrievable | 30d rolling |

### SLOs (our targets, tighter than SLA)

| Service | SLO | Error budget (30d) |
|---------|-----|---------------------|
| Web availability | 99.95% | 22 min |
| API availability | 99.95% | 22 min |
| API p95 latency | < 300 ms | — |
| API p99 latency | < 800 ms | — |
| DB availability | 99.99% | 4.3 min |
| Jobs (high-prio) | 95% < 5 min | — |
| PDF generation | 95% < 30 s | — |
| File durability | 99.999999999% (S3 native) | — |

### Customer-Facing SLAs (from contracts)
- Availability: **99.9%** monthly (Standard tier)
- Availability: **99.95%** monthly (Enterprise tier)
- Support P1: < 1 h response; P2: < 4 h; P3: < 1 business day

We target tighter internal SLOs than SLA so we have buffer before SLA is breached.

### Error Budget Policy
- Error budget "burn rate" tracked continuously
- If burn rate indicates SLO will breach within current window:
  - **< 50% budget used**: normal development
  - **50–80%**: only bug fixes and planned deploys; extra review
  - **> 80%**: freeze new feature deploys; SRE decides when to resume
  - **Budget exhausted**: incident review, root cause required

### Multi-Burn-Rate Alerts (per Google SRE book)
Two windows to catch both fast + slow burns:
- **Fast burn** (5m window, threshold 14.4× budget burn) — page
- **Slow burn** (1h window, threshold 6× burn) — page
- Both required to fire — reduces false alarms

---

## 9. Dashboards (Grafana)

### Dashboards-as-Code
All dashboards in `infrastructure/observability/grafana-dashboards/` as JSON (exported from Grafana). PR-reviewed. No click-saving.

### Dashboard Catalog

| Dashboard | Audience | Content |
|-----------|----------|---------|
| **Service Overview** | Engineering, SRE | RED metrics per service, SLO status, error budget burn |
| **API Deep Dive** | API engineers | Per-endpoint RPS/latency/errors; slow query list |
| **Web Performance** | Frontend | CWV from RUM, bundle sizes, route-level perf |
| **Database** | SRE, DBAs | Connections, CPU, slow queries, replication lag, disk |
| **Redis** | SRE | Memory, hit rate, evictions, connection count |
| **Queues / Workers** | SRE, backend | Queue depth, job latency, failure rate, DLQ |
| **Kubernetes Cluster** | Platform | Node health, pod status, resource usage, deploys |
| **Cost** | Finance, Eng | Per-service, per-env, per-tenant estimated spend |
| **Security** | Security team | Failed logins, MFA failures, WAF blocks, anomaly detection |
| **Tenant Overview** (Phase 2) | CS, Support | Per-tenant activity, errors, usage |
| **Release Dashboard** | Release manager | Deploys in flight, canary status, rollback state |
| **SLO Summary** | All-hands | At-a-glance SLO compliance across services |

### Dashboard Standards
- Every panel has a title, unit, legend
- Every alert has a linked runbook panel
- Color scheme consistent: green=healthy, yellow=degraded, red=failing
- Panel density appropriate for zoom level (fewer on overviews, more on deep dives)

---

## 10. Alerting

### Alert Severity Matrix

| Severity | Example | Action | Who |
|----------|---------|--------|-----|
| **P1 — Critical** | Production down, data loss, security breach | Page immediately | On-call SRE + Eng Leadership |
| **P2 — High** | SLO burn rate critical, partial outage, error rate 5× baseline | Page | On-call SRE |
| **P3 — Medium** | Degradation, queue backlog, CI failing | Slack notify; no page outside business hours | Team channel |
| **P4 — Low** | Drift detected, cost anomaly, deprecation warning | Slack notify; review async | Team channel |

### Alert Definition Rules
- Every alert has: (1) clear name, (2) runbook link, (3) severity, (4) team owner
- Alerts that page must be actionable — runbook must end in a fix, not "investigate"
- Alerts must include current value vs threshold in message
- Use multi-burn-rate for SLO alerts (prevents noise from brief spikes)
- No "cpu > 80%" alerts — that's not symptomatic; customer impact is

### Sample Alert
```yaml
- alert: APIHighErrorRateFast
  expr: |
    (
      sum(rate(http_server_request_count{service="aims-api",status=~"5.."}[5m]))
      /
      sum(rate(http_server_request_count{service="aims-api"}[5m]))
    ) > (14.4 * 0.001)    # 14.4× burn of 99.9% target
  for: 2m
  labels:
    severity: p2
    team: backend
  annotations:
    summary: API error rate burning SLO fast
    runbook: https://docs.aims.internal/runbooks/api-high-error-rate
    current: "{{ $value }}"
    dashboard: https://grafana.aims.internal/d/api-service
```

### Alert Hygiene
- Monthly review: which alerts paged? Which were actionable? Which were noise?
- Noise → tune threshold or delete
- Actionable alerts without runbook → create runbook or remove

---

## 11. Incident Response (High-Level)

Full playbook: `RUNBOOKS.md §4`. Summary:

1. **Alert fires** → PagerDuty
2. **On-call acks** within 5 min (SLO: ack < 5 min)
3. **Incident channel created** in Slack via `/incident` (Incident.io or custom bot)
4. **Roles assigned**: Incident Commander, Comms Lead, Technical Lead (may all be same person for small incidents)
5. **Statuspage updated** (if customer-visible): investigating → identified → monitoring → resolved
6. **Mitigation** (rollback, scale, feature flag) — ALWAYS before root-cause analysis
7. **Monitoring** → 30 min post-resolution observation
8. **Resolved** → page closed, Statuspage updated
9. **Postmortem** within 5 business days — blameless, actionable

---

## 12. Synthetic Monitoring

### Checkly (SaaS)
- Run every 1 min from 3 regions (US-east, EU-west, AP)
- Check: `/healthz`, login flow, create-engagement flow
- Alerts if any region fails 2 consecutive runs

### Kubernetes-level Probes
- Liveness, readiness, startup probes (see `CONTAINERS.md §5`)
- Prometheus blackbox exporter → alert if DNS/TLS expires

### Dependency Health
- External services (SES, Stripe, IdP) — poll every 5 min; track availability vs their published status

---

## 13. RUM — Real User Monitoring

### Frontend Performance (from browsers)
- `web-vitals` library sends CWV metrics to our analytics endpoint
- Fields: route, device type, connection type, metric name (LCP/INP/CLS/FCP/TTFB), value
- Aggregated in Prometheus via pushgateway or custom scrape endpoint
- Alerts on p75 regression vs previous 7-day baseline

### User-Facing Error Capture
- Sentry browser SDK
- Source-mapped stacks
- Breadcrumbs (last 50 UI interactions before error)
- Session replay (sanitized — no input values captured) for critical errors

---

## 14. Audit Logging (Distinct from Ops Logs)

Application audit events (who did what when) live in the database (`database/functions/audit-log-triggers.sql`) — hash-chained for tamper evidence. Replicated to immutable S3 daily.

**Ops observability logs ≠ audit events**:
- Ops logs: what the system did, ephemeral (30d), may contain PII
- Audit events: what users did, permanent, redacted, tamper-evident

Both exist; don't confuse them.

### Admin Action Logging (Platform)
- Any SRE/admin action on production (JIT role assumed, `kubectl`, `terraform apply`) → CloudTrail + audit log
- Forwarded to Security team's SIEM (Splunk/Datadog)
- Reviewed weekly

---

## 15. Cost Observability

- CloudWatch + Cost Explorer → Grafana panels
- Labels: `env`, `service`, `tenant_plan`, `region`
- Per-tenant attribution via S3 object tags + DB row counts (imperfect but useful)
- Budget: alerts at 80%, 100%, 120% per env
- FinOps dashboard reviewed monthly

---

## 16. Telemetry Budgets (Keep Costs Sane)

Observability cost can rival compute cost if not managed. Targets:

| Item | Budget | Mechanism |
|------|--------|-----------|
| Logs ingested | < 500 GB / month / env | Sampling at info+, drop debug in prod |
| Trace spans | < 1B / month | Tail sampling |
| Metrics series | < 1M active | Cardinality governance |
| Sentry events | < 500k / month | Throttle noisy errors |

Quarterly: review top talkers, prune.

---

## 17. Local Observability for Development

Developers run a small stack via `docker-compose.otel.yml`:
- Jaeger or Tempo (local, in-memory) — view traces at `http://localhost:16686`
- Grafana + Prometheus (local, scraping dev services)
- Loki (local log aggregation)
- otel-collector (local)

Turns on with `pnpm dev:otel`. Optional — default `pnpm dev` skips the stack.

---

## 18. What We Do Not Do

- **No PII in metrics labels** (would blow up cardinality + leak data)
- **No sampling errors** (always keep 100% of error traces)
- **No logging of health checks** at info (use debug or drop)
- **No proprietary APM agent** (Datadog, New Relic) as only instrumentation — OTel is the SDK; vendor is just an exporter destination
- **No manual log aggregation** (no `cat *.log | grep`) — Loki/CW queries only
- **No staring at logs for monitoring** — dashboards & alerts do that
- **No alert without runbook** — adding one requires linking a runbook

---

## 19. Observability Ownership

| Component | Owner |
|-----------|-------|
| OTel Collector config | Platform/SRE |
| App instrumentation (SDK use) | Service teams |
| Dashboards | Service teams (own their dashboard) |
| Alerts | Service teams (own their alert) |
| SLOs | Service team + SRE (defined together) |
| Grafana access | SSO; roles: Viewer (all), Editor (Eng), Admin (SRE) |
| Sentry access | SSO; project-level permissions |

---

## 20. Related Documents

- [`CONTAINERS.md`](CONTAINERS.md) — OTel Collector DaemonSet config
- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — AMP, AMG, CloudWatch, S3 log archive
- [`RUNBOOKS.md`](RUNBOOKS.md) — incident response + common issue playbooks
- [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) — logs/metrics during DR
- [`../database/`](../database/) — app-level audit events (different from ops logs)
