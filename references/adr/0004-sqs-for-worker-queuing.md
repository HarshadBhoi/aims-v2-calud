# 0004 — AWS SQS for all worker-tier queuing, not Redis/BullMQ

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering, devops
- **Tags**: #api #workers #queuing #infrastructure

---

## Context

The worker tier introduced by [ADR-0003](0003-nestjs-scoped-to-workers.md) has real background-work responsibilities: document generation (multi-MB PDF/DOCX rendering per engagement — seven documents from a Single Audit), transactional outbox dispatch (HMAC-signed webhook delivery with retry + DLQ per ADR-0003 §3.4), scheduled jobs (SCIM provisioning sync, tenant-lifecycle tasks, audit-log hash-chain verification), data integrity checks, notification email fan-out.

ADR-0003 casually referenced `@nestjs/bull` when discussing the worker tier, implying BullMQ on Redis as the queue infrastructure. External domain review in April 2026 correctly flagged that this is not actually a decision — it's a default, and a default that works poorly for our real workloads:

- BullMQ stores job payloads in Redis memory. Multi-MB document-generation payloads stress Redis memory and cluster failover.
- BullMQ's at-least-once semantics are real but less battle-tested under network partition than SQS.
- BullMQ's observability story (BullBoard) is good for dev; less so for production correlated across OpenTelemetry.
- Redis-cluster operational complexity (sharding, failover, backup, recovery) is nontrivial; AWS SQS is managed with no per-host operational concern.

The decision needed to be made explicitly, and made before the first worker is implemented — migrating queue technology at scale is one of the more painful things a platform can do.

---

## Decision

The worker tier uses **AWS SQS** for all queuing. Standard queues for at-least-once delivery; FIFO queues where per-aggregate ordering matters (outbox dispatch keyed by `aggregate_id`; SCIM sync keyed by `tenant_id`; per-tenant scheduled jobs). NestJS workers consume via a thin SQS adapter (`@ssut/nestjs-sqs` or equivalent).

Scheduled jobs are dispatched via **Amazon EventBridge Scheduler** to SQS rather than via NestJS's in-worker `@nestjs/schedule`. This separates "what runs when" (EventBridge, observable and configurable via IaC) from "what does the work" (SQS + NestJS consumer, independently scalable).

Heavy job payloads (document generation, bulk export) are **not** serialised into the SQS message. The message carries metadata and pointers (S3 URI for input; target S3 URI for output; tenant context; idempotency key). The worker reads from S3, does the work, writes to S3, and emits a completion event. This keeps SQS message size bounded (<256 KB standard limit) and S3 as the payload substrate.

Dead-letter queues are configured per-source queue with sensible redrive policies (5 attempts, exponential backoff). DLQ depth is a CloudWatch metric with alerts.

`@nestjs/bull` and Redis-backed BullMQ are **not** used for queue infrastructure. Redis remains in the stack for session blocklists ([ADR-0005](0005-session-revocation-hybrid.md)), tRPC response caching, and rate-limit counters — all in-process-visible state that benefits from Redis semantics. Queue jobs, however, do not.

---

## Alternatives considered

### Option A — BullMQ on Redis  (rejected)

The implied default from ADR-0003. Queue infrastructure on a Redis cluster; NestJS workers via `@nestjs/bull`.

**Pros**
- Excellent developer ergonomics — BullBoard UI for job inspection, rich per-job metadata, familiar API
- Low-latency pickup (sub-millisecond)
- Single infrastructure dependency (Redis) that we'd run anyway for other uses
- Mature library ecosystem

**Cons**
- Job payloads live in Redis memory — multi-MB document-generation jobs stress memory and cluster failover
- Redis cluster operational complexity (sharding, failover, backup, recovery) is our problem, not AWS's
- Persistence is best-effort; under adverse partition + node-loss conditions, jobs can be lost
- Per-job observability is a side-channel (BullBoard) rather than integrated into OpenTelemetry/CloudWatch
- Scaling the queue tier means scaling the Redis cluster — expensive and brittle at volume

### Option B — AWS SQS everywhere  (chosen)

Standard SQS queues + FIFO where ordering matters. EventBridge Scheduler for cron. Heavy payloads via S3 pointers.

**Pros**
- Durable by design; effectively-infinite queue depth
- AWS-native — IRSA for auth, KMS for at-rest encryption, CloudWatch for metrics, DLQ primitives built-in
- Managed — no Redis cluster to run, shard, fail over, or back up
- Scales transparently to millions of messages; pay-per-use pricing
- Integrates with OpenTelemetry SDK out of the box
- EventBridge Scheduler + SQS is an idiomatic AWS pattern with strong operational maturity
- Separates scheduling concern (EventBridge) from work concern (SQS + worker)

**Cons**
- Less rich developer ergonomics than BullMQ — no BullBoard equivalent; LocalStack SQS for local dev is adequate but not feature-rich
- Message-size limit (256 KB) forces heavy payloads to S3; we live with the extra read/write
- Pickup latency slightly higher than BullMQ (tens of ms vs. sub-ms); not load-bearing for our workloads
- AWS vendor dependency — SQS is not trivially portable; mitigated by the thin adapter shape so worker code is cloud-generic

### Option C — Kafka / Amazon MSK  (rejected)

Kafka as the backbone for both events and jobs.

**Pros**
- Excellent for high-volume event streaming
- Retention and replay capabilities are unmatched
- Ordering guarantees are very strong

**Cons**
- Operational complexity is high — Kafka cluster management, topic-partition design, consumer group coordination
- Overkill for our queue workloads; we don't need stream replay, we need job dispatch
- Amazon MSK reduces operational pain but introduces significant cost ($200-1000+/month baseline)
- Learning curve for the team is real
- Ecosystem for NestJS + Kafka job-queue usage is thinner than SQS or BullMQ

### Option D — Split by workload (SQS for durable, BullMQ for ephemeral)  (rejected)

Durable/heavy work on SQS; ephemeral/light work on BullMQ.

**Pros**
- Each workload uses the queue technology best suited to it
- In-process cache invalidation via BullMQ is very fast

**Cons**
- Two queue technologies to maintain, monitor, alert on, document
- Worker teams must know when to use which
- The ephemeral workloads BullMQ would handle (cache invalidation, rate-limit counter increments) are arguably not even queues — they can be in-process or direct Redis writes
- Complexity cost not worth the ergonomic win

---

## Consequences

### Positive
- Durable job delivery — no "we lost the document-generation request" class of bug is possible
- AWS-native integration — IRSA, KMS, CloudWatch, DLQ, and retention all work out of the box without custom tooling
- Scales to production volume without queue-tier engineering — SQS is managed
- Heavy-payload pattern (S3 pointers, not inline messages) scales document generation cleanly to arbitrary file sizes
- EventBridge Scheduler makes cron schedules observable and configurable via Terraform rather than hidden in worker code
- DLQ handling is first-class; failed jobs are visible in CloudWatch dashboards rather than logged and lost

### Negative
- Developer ergonomics step down from BullMQ — no BullBoard-equivalent UI; job inspection requires CloudWatch + custom tooling or a lightweight in-house viewer
- Local dev via LocalStack SQS works but is less feature-rich than BullMQ + Redis locally
- Pickup latency higher than BullMQ (tens of ms vs. sub-ms) — not load-bearing for any current workload but measurable
- SQS message-size limit forces heavy payloads to S3, adding one read + one write per job
- AWS vendor dependency — the SQS adapter is a thin wrapper, but migrating to another queue technology is a real project

### Neutral
- EventBridge Scheduler is a separate AWS service to manage; schedules live in Terraform alongside the queue definitions
- Per-queue naming conventions documented in `devops/QUEUE-CONVENTIONS.md` (to be added): `<environment>-<domain>-<purpose>` e.g., `prod-engagement-doc-gen`, `prod-outbox-dispatch`
- Every worker emits OpenTelemetry spans on `ReceiveMessage` → `DeleteMessage`, correlated with the originating request via trace context stored in message attributes

---

## Validation

- **Job delivery reliability** — if we observe any job-loss incident after rollout, it is a P1 investigation. SQS durability should make this a "never happens" class of bug.
- **Pickup latency** — if worker pickup p99 exceeds 1 second under baseline load, revisit (likely fixable via worker concurrency tuning, not queue-technology change).
- **DLQ depth** — if DLQ depth trends up without matching burst cause, revisit worker idempotency or retry policy.
- **Developer-ergonomic signal** — if engineers repeatedly request BullBoard-style job inspection, build the internal "SQS inspector" UI rather than switch queues.
- **Cost** — SQS pricing is usage-based; at projected volumes it's well under $500/month. If we ever find SQS cost exceeding BullMQ + Redis-cluster cost materially, revisit.

---

## Rollout plan

- **Phase 1 — Scaffold** (pre-launch): provision one SQS queue per worker type via Terraform; set up EventBridge Scheduler rules for the scheduled jobs; implement the NestJS SQS adapter in `packages/queue-sqs/`; stand up LocalStack SQS for local development; write integration tests against LocalStack + against real SQS in a CI job.
- **Phase 2 — First workers** (launch readiness): outbox dispatcher runs on SQS; document generation runs on SQS with S3-pointer payloads; SCIM sync runs on SQS via EventBridge Scheduler. Observability: OpenTelemetry spans across request → outbox → worker → destination.
- **Phase 3 — Build the SQS inspector** (post-launch, when developer requests accumulate): lightweight internal UI that reads SQS queue state, message attributes, DLQ contents. Not BullBoard; enough to answer "what's in the queue right now and what just failed?"

---

## Threats considered

- **Message poisoning (malicious payload triggers a worker to misbehave)** — mitigated by Zod validation of message bodies at the consumer; invalid messages go to DLQ, not to the handler.
- **DLQ overflow during an outage** — mitigated by CloudWatch alerts on DLQ depth > N; automated DLQ-drain worker for the common "transient failure" case with operator review for persistent failures.
- **Cross-tenant leakage via a misdirected message** — mitigated by tenant ID in message attributes checked against the worker's active tenant context before processing; mismatch is a fatal error.
- **Worker deadlock on a long-running job holding visibility-timeout** — mitigated by job-type-specific visibility timeouts (doc gen: 15 min, outbox dispatch: 30 s, SCIM sync: 5 min); heartbeat extension during long jobs.
- **Secrets in message attributes leaking into CloudWatch** — mitigated by a lint rule: no sensitive field (anything labeled `encrypted-at-rest` per ADR-0001) appears in message attributes; only in the encrypted S3 object the message points to.

---

## References

- [`docs/06-design-decisions.md` §3.8 — Queuing decision narrative](../../docs/06-design-decisions.md#38-aws-sqs-for-all-worker-tier-queuing-not-redisbullmq)
- [`docs/04-architecture-tour.md` §3.3 — API layer walkthrough (outbox pattern)](../../docs/04-architecture-tour.md#33-at-the-api-layer)
- Gemini domain review, April 2026 (R1 on 06-design-decisions.md)
- AWS SQS documentation — best practices, FIFO queue semantics, DLQ patterns
- Amazon EventBridge Scheduler documentation
- Related ADRs: [ADR-0003](0003-nestjs-scoped-to-workers.md) (the worker tier itself; ADR-0004 specifies its queue infrastructure); [ADR-0001](0001-ale-replaces-pgcrypto.md) (encryption rules apply to S3-stored payloads too)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
