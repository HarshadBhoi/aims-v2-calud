# SQS Queue Conventions

> Naming, structure, retry policy, and observability conventions for AWS SQS queues and EventBridge Scheduler rules in AIMS v2. Pairs with [ADR-0004](../references/adr/0004-sqs-for-worker-queuing.md).

---

## Why this document exists

Per ADR-0004, AWS SQS is the queue technology for all worker-tier background jobs. As the number of queues grows (outbox dispatch, document generation, SCIM sync, webhook delivery, etc.), consistent naming and configuration prevents ops-surprise and makes alerts and dashboards scale linearly with queue count.

This doc is the contract. Every new queue provisioned via Terraform follows these conventions; CI lints the Terraform module for compliance.

---

## Queue naming

### Format

```
<environment>-<domain>-<purpose>[-fifo].fifo?
```

- **`<environment>`** — `prod` / `staging` / `dev` / `preview-<pr-number>`
- **`<domain>`** — the feature domain the queue serves — `engagement`, `finding`, `report`, `outbox`, `auth`, `scim`, `webhook`, `billing`, `audit`
- **`<purpose>`** — the specific job type — `doc-gen`, `dispatch`, `verify`, `sync`, `email`, `revocation`
- **`.fifo` suffix** — required on FIFO queues (AWS enforces this)

### Examples

| Queue name | What it does |
|---|---|
| `prod-engagement-doc-gen` | Document generation for engagement reports (standard queue) |
| `prod-outbox-dispatch.fifo` | Transactional outbox → side-effect dispatch (FIFO, per-aggregate ordering) |
| `prod-webhook-delivery.fifo` | Outbound webhook HMAC-signed delivery (FIFO, per-aggregate) |
| `prod-scim-sync.fifo` | Per-tenant SCIM user-directory sync (FIFO, per-tenant) |
| `prod-audit-verify` | Weekly hash-chain verification over audit_event table |
| `prod-auth-revocation` | Session revocation — populates Redis blocklist (ADR-0005) |
| `staging-engagement-doc-gen` | Same as prod but for staging |
| `preview-42-outbox-dispatch.fifo` | Per-PR preview environment |

### DLQ naming

Every queue has a dead-letter queue at `<queue-name>-dlq`:

| Source queue | DLQ |
|---|---|
| `prod-engagement-doc-gen` | `prod-engagement-doc-gen-dlq` |
| `prod-outbox-dispatch.fifo` | `prod-outbox-dispatch-dlq.fifo` |

---

## Standard vs. FIFO — when to use which

Use **FIFO** when per-aggregate ordering matters:

- **Outbox dispatch** — events for the same aggregate (`engagement:abc123`) must deliver in order; partition key is the aggregate ID
- **SCIM sync** — per-tenant SCIM events must apply in order; partition key is the tenant ID
- **Webhook delivery** — a given consumer's webhooks must deliver in order; partition key is the consumer ID

Use **Standard** for everything else:

- Document generation — each job is independent; order doesn't matter
- Revocation — blocklist population is idempotent (adding an entry twice is a no-op)
- Email dispatch — per-recipient ordering doesn't matter at our scale

FIFO queues have lower per-partition throughput (300 msg/sec per message-group vs. unlimited for standard); reserve them for cases where ordering is actually required.

---

## Message shape

Every SQS message body is a JSON object conforming to a Zod schema in `packages/validation/jobs/`. Required fields:

```typescript
{
  // Identity
  jobId: string;                  // UUIDv7; unique per job, used for idempotency
  messageVersion: string;         // Schema version; allows evolution

  // Tenant context (required for tenant-scoped jobs)
  tenantId: string;

  // Observability
  traceparent: string;            // W3C traceparent; OpenTelemetry propagation
  originatingRequestId: string;   // Request ID that enqueued the job

  // Payload
  payloadUri?: string;            // S3 URI for heavy payloads (preferred)
  payload?: object;               // Inline payload for small jobs (<64 KB)

  // Idempotency
  idempotencyKey: string;         // Consumer uses to dedupe retries

  // Retry metadata (read-only to consumers)
  attemptCount?: number;
  firstAttemptAt?: string;        // ISO timestamp
}
```

**Payload rule**: anything over 64 KB goes to S3 via `payloadUri`, not inline. SQS's 256 KB message limit is the hard ceiling; 64 KB keeps us well below it and forces the S3-pointer discipline per ADR-0004.

**Message attributes** (SQS native attributes, not in the body):

- `tenantId` — copy of the body's tenantId, used for AWS CloudTrail filtering
- `traceparent` — copy for trace context propagation
- `MessageGroupId` (FIFO only) — the partition key (aggregate ID, tenant ID, consumer ID — whatever determines ordering)
- `MessageDeduplicationId` (FIFO only) — equals the `jobId`, prevents duplicate enqueues within 5 minutes

---

## Retry and DLQ policy

### Retry

All queues are configured with a redrive policy of **5 maximum receives** before a message moves to the DLQ. SQS handles the backoff via visibility-timeout dynamics:

```hcl
redrive_policy = jsonencode({
  deadLetterTargetArn = aws_sqs_queue.xxx_dlq.arn
  maxReceiveCount     = 5
})
```

### Visibility timeout (per queue)

Set to the expected p99 job duration + buffer. Too short → duplicate processing. Too long → delayed retries for legitimate failures.

| Queue | Visibility timeout | Reason |
|---|---|---|
| `prod-engagement-doc-gen` | 15 minutes | Document generation can take minutes for large engagements |
| `prod-outbox-dispatch.fifo` | 30 seconds | HTTP webhook delivery is fast |
| `prod-scim-sync.fifo` | 5 minutes | Full tenant sync can be medium-weight |
| `prod-audit-verify` | 30 minutes | Hash-chain verification over months of audit_event data |
| `prod-auth-revocation` | 10 seconds | Redis GET+SET operations are milliseconds |

Long-running jobs should **extend visibility** periodically via `ChangeMessageVisibility` rather than setting a large initial timeout — this way, crashed workers have faster retry without the job being held hostage for 15 minutes.

### DLQ handling

DLQ depth alarms at `>0` for a sustained period (5 minutes). On-call engineer investigates:

1. Inspect the DLQ's messages (CloudWatch or internal SQS inspector)
2. Determine if the failure is transient (bug in worker, fix and redrive) or permanent (bad input, move to archive)
3. Redrive to source queue via `aws sqs start-message-move-task` or drop via `aws sqs delete-message`

We do not auto-redrive DLQ contents. Failed jobs stay in the DLQ until a human decides what to do with them. Alerts on DLQ depth catch accumulation early.

---

## EventBridge Scheduler rules — scheduled jobs

Cron-style jobs (CAP-overdue reminders, CPE reminders, monthly archival, audit-integrity checks) are scheduled via EventBridge Scheduler, not via `@nestjs/schedule` running in-worker.

### Rule naming

```
<environment>-<domain>-<purpose>-schedule
```

Examples:

- `prod-cap-overdue-reminder-schedule` — daily reminder for CAPs past their due date
- `prod-cpe-reminder-schedule` — weekly CPE hour-accumulation reminders
- `prod-audit-verify-schedule` — weekly hash-chain verification
- `prod-archival-schedule` — monthly cold-storage archival

### Rule definition

```hcl
resource "aws_scheduler_schedule" "audit_verify" {
  name       = "${var.environment}-audit-verify-schedule"
  group_name = "aims"

  schedule_expression          = "cron(0 2 ? * SUN *)"  # Every Sunday 02:00 UTC
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_sqs_queue.audit_verify.arn
    role_arn = aws_iam_role.scheduler_to_sqs.arn

    input = jsonencode({
      jobId           = "${context.execution-id}",
      messageVersion  = "1",
      traceparent     = "${context.execution-id}-auto",
      idempotencyKey  = "audit-verify-${formatdate("YYYY-MM-DD-hh", timestamp())}",
    })
  }

  flexible_time_window {
    mode                      = "FLEXIBLE"
    maximum_window_in_minutes = 15  # Tolerate small scheduling drift
  }
}
```

### Why not `@nestjs/schedule`?

- **Visibility**: EventBridge rules are visible in the AWS console and modifiable via IaC without code deploys.
- **Reliability**: EventBridge is a managed service with 99.99% SLA; in-worker cron has the worker's reliability.
- **Scaling**: multiple worker replicas do not each run the cron — EventBridge fires once, the single message is consumed by one worker.
- **Audit trail**: CloudTrail logs every EventBridge rule execution; in-worker cron logging is what we build.

`@nestjs/schedule` is not disabled at the framework level (it works for things like per-process cache refresh that *should* run on every replica), but it is not used for business-logic scheduled jobs.

---

## Observability

Every queue exports these CloudWatch metrics (AWS-native, no work required):

- `ApproximateNumberOfMessagesVisible` — current queue depth
- `ApproximateAgeOfOldestMessage` — if this trends up, consumers are falling behind
- `NumberOfMessagesSent` — production rate
- `NumberOfMessagesReceived` — consumption rate
- `NumberOfEmptyReceives` — zero-message polls (indicates over-provisioned consumers)

DLQ-specific:

- `ApproximateNumberOfMessages` — DLQ depth (alert at >0 sustained)

Alarm thresholds per queue are tuned; defaults are in the Terraform module.

---

## Consumer contract (what workers must do)

1. **Call `ReceiveMessage`** with appropriate `MaxNumberOfMessages` (1-10 depending on batch strategy) and `WaitTimeSeconds` (20 — long polling) for the queue's visibility timeout
2. **Validate the message body** against the Zod schema in `packages/validation/jobs/`; malformed messages go to DLQ without processing
3. **Check the idempotency key** against the worker's idempotency store (Redis or DB); skip if already processed
4. **Propagate trace context** — open an OpenTelemetry span linked to the message's `traceparent`
5. **Execute the job** — whatever the worker actually does
6. **Call `DeleteMessage`** on successful completion; SQS redelivers on failure via visibility timeout
7. **Record idempotency result** to prevent duplicate work on redelivery

Workers that fail this contract (skip steps, lose messages, don't delete on success) are caught by integration tests and by the DLQ-depth alarms.

---

## References

- [ADR-0004 — SQS for worker queuing](../references/adr/0004-sqs-for-worker-queuing.md)
- [api/ARCHITECTURE.md — Decision 14](../api/ARCHITECTURE.md)
- [docs/06-design-decisions.md §3.8 — AWS SQS](../docs/06-design-decisions.md#38-aws-sqs-for-all-worker-tier-queuing-not-redisbullmq)
- [docs/04-architecture-tour.md §8.7 — Event outbox](../docs/04-architecture-tour.md#87-event-outbox--the-only-durable-happens-before-edge-we-trust)
- AWS SQS documentation — [Best practices for FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html)
- Amazon EventBridge Scheduler documentation

---

*Last reviewed: 2026-04-20.*
