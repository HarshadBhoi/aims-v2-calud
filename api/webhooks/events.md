# AIMS v2 Webhooks

> Outbound event notifications for customer integrations.

---

## Overview

Tenants register webhook endpoints to receive real-time event notifications when things happen in AIMS. Alternative to polling.

Design follows **Stripe / GitHub webhook conventions** — widely understood in industry.

---

## Event Envelope

Every webhook delivery follows the same envelope shape:

```json
{
  "id": "evt_01HXKZT3BY9WQZQGEVJGAXF4K",
  "type": "finding.issued",
  "api_version": "2026-04-19",
  "tenant_id": "clxyz_01h7m8n4a0000...",
  "occurred_at": "2026-04-19T10:32:11.458Z",
  "data": {
    "object": { ...resource payload... },
    "previous_attributes": { ...changed fields (for `updated` events)... }
  },
  "request_id": "01HXKZT3BY9WQZQGEVJGAXF4K",
  "livemode": true
}
```

### Field Semantics
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique event ID (ULID); use for deduplication |
| `type` | string | Event type (see catalog below) |
| `api_version` | string | Pinned API version for this webhook subscription |
| `tenant_id` | string | Tenant the event belongs to |
| `occurred_at` | string | ISO 8601 timestamp when event happened |
| `data.object` | object | Current state of the resource |
| `data.previous_attributes` | object (optional) | For `*.updated` events, fields that changed |
| `request_id` | string | Links to audit log / tRPC request that caused the event |
| `livemode` | boolean | `true` for production, `false` for sandbox |

---

## Signature Verification (HMAC-SHA256)

Every request includes a signature header:

```
X-AIMS-Signature: t=1713559289,v1=5257a869e7ecebeda32affa62cdc0dec7878d2030d2854fe8ccb1c5fafa4cf6d
X-AIMS-Event-Id: evt_01HXKZT3BY9WQZQGEVJGAXF4K
```

### How to Verify

```typescript
import crypto from 'node:crypto';

function verifyAimsWebhook(
  body: string,               // raw request body (NOT parsed JSON)
  signatureHeader: string,    // value of X-AIMS-Signature
  secret: string,             // your endpoint secret (whsec_...)
  toleranceSeconds = 300,     // 5 min
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => p.split('=') as [string, string])
  );
  const timestamp = parseInt(parts.t, 10);
  const providedSig = parts.v1;

  // 1. Reject old timestamps (prevents replay)
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
    return false;
  }

  // 2. Compute expected signature
  const signedPayload = `${timestamp}.${body}`;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // 3. Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(providedSig, 'hex'),
    Buffer.from(expectedSig, 'hex'),
  );
}
```

### Why This Pattern
- Follows **Stripe's webhook signing** convention (familiar to most developers)
- **Timestamped** to prevent replay attacks
- **HMAC-SHA256** — industry-standard signature algorithm
- **Constant-time compare** — prevents timing attacks

---

## Event Catalog

### Engagements

| Event | When |
|-------|------|
| `engagement.created` | New engagement created |
| `engagement.updated` | Any field updated (non-status) |
| `engagement.status_changed` | Status transitioned (see `previous_attributes.status`) |
| `engagement.team_member_added` | Team member assigned |
| `engagement.team_member_removed` | Team member removed |
| `engagement.issued` | Engagement locked with e-signature |
| `engagement.closed` | Engagement closed |
| `engagement.deleted` | Soft-deleted (not hard delete) |

### Findings

| Event | When |
|-------|------|
| `finding.created` | New finding created |
| `finding.updated` | Finding updated (non-status) |
| `finding.submitted_for_review` | Submitted to approval workflow |
| `finding.approved` | Approval step approved |
| `finding.rejected` | Approval step rejected |
| `finding.issued` | Finding locked with e-signature |
| `finding.withdrawn` | Previously issued finding retracted |
| `finding.repeat_detected` | Finding flagged as repeat of prior |

### Management Responses

| Event | When |
|-------|------|
| `management_response.submitted` | Auditee submitted response |
| `management_response.evaluated` | Auditor evaluated response |

### Recommendations & Corrective Actions

| Event | When |
|-------|------|
| `recommendation.created` | Created |
| `recommendation.risk_accepted` | Management accepted risk (IIA Standard 15.x) |
| `cap.created` | CAP created |
| `cap.status_changed` | Status transitioned |
| `cap.overdue` | CAP passed due date without completion |
| `cap.completed` | Evidence uploaded, awaiting verification |
| `cap.verified` | Auditor verified completion |
| `cap.escalated` | Escalated to supervisor due to overdue |

### Reports

| Event | When |
|-------|------|
| `report.created` | Draft report created |
| `report.pdf_generated` | PDF generation complete |
| `report.approval_completed` | All approvals done, ready to issue |
| `report.issued` | Report issued with e-signature |
| `report.distributed` | Report sent to recipients |

### Approvals (workflow)

| Event | When |
|-------|------|
| `approval.requested` | New approval task assigned to user |
| `approval.approved` | User approved |
| `approval.rejected` | User rejected |
| `approval.delegated` | User delegated to another |
| `approval.sla_approaching` | Approaching SLA breach (80% of budget) |
| `approval.sla_breached` | Past SLA target |
| `approval.recalled` | Submitter recalled before first decision |

### Workpapers

| Event | When |
|-------|------|
| `workpaper.uploaded` | New workpaper uploaded |
| `workpaper.new_version` | New version uploaded |
| `workpaper.reviewed` | Workpaper reviewed |
| `workpaper.approved` | Workpaper approved |

### Users & Tenancy

| Event | When |
|-------|------|
| `user.invited` | User invited to tenant |
| `user.joined` | User accepted invitation |
| `user.role_changed` | Role updated |
| `user.deactivated` | User deactivated |

### Independence & QAIP

| Event | When |
|-------|------|
| `independence_declaration.signed` | User signed declaration |
| `independence_declaration.impairment_disclosed` | Impairment disclosed (alert) |
| `qaip_assessment.completed` | QAIP assessment completed |
| `peer_review.scheduled` | Peer review scheduled |
| `peer_review.completed` | Peer review complete |

### CPE

| Event | When |
|-------|------|
| `cpe.record_added` | CPE record added |
| `cpe.deadline_approaching` | Approaching CPE cycle end with hours short |
| `cpe.compliance_failed` | Cycle ended without meeting requirement |

### Platform (tenant admin only)

| Event | When |
|-------|------|
| `standard_pack.published` | New pack version available |
| `standard_pack.effective_date_reached` | Pack transitioned to EFFECTIVE |
| `standard_pack.superseded` | Old pack superseded by new version |

---

## Subscription Model

Tenants subscribe to specific event types:

```http
POST /v1/webhooks
Content-Type: application/json

{
  "url": "https://yourapp.example.com/aims-hooks",
  "events": [
    "finding.issued",
    "cap.overdue",
    "report.published"
  ],
  "description": "Slack bridge for audit notifications",
  "metadata": { "team": "compliance" }
}
```

Response:
```json
{
  "id": "wh_01HXKZT3BY9...",
  "url": "https://yourapp.example.com/aims-hooks",
  "events": [...],
  "secret": "whsec_abc123...",    // Save this — won't be shown again!
  "created_at": "...",
  "status": "active"
}
```

### Wildcard Subscription
Subscribe to all events of a category:
```json
{ "events": ["finding.*", "cap.*"] }
```

Or everything (discouraged):
```json
{ "events": ["*"] }
```

---

## Delivery Guarantees

### At-Least-Once
Webhooks are delivered **at least once**. Always include the `id` field in your idempotency check to avoid duplicate processing:

```typescript
async function handleWebhook(event: AimsEvent) {
  if (await alreadyProcessed(event.id)) return;
  await markProcessing(event.id);
  try {
    await doWork(event);
    await markCompleted(event.id);
  } catch (err) {
    await markFailed(event.id);
    throw err;
  }
}
```

### Ordering
- Events for the **same resource** are delivered in order
- Events for **different resources** may be out of order
- If strict ordering matters, process based on `occurred_at` timestamp

---

## Retry Policy

Failed deliveries (non-2xx response or timeout) are retried with exponential backoff:

| Attempt | Delay after previous |
|---------|---------------------|
| 1 (initial) | Immediate |
| 2 | 1 minute |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 6 hours |
| 7 (final) | 24 hours |

After 7 failures (~32 hours elapsed), webhook is marked as failed and:
1. Tenant admin notified via email
2. Webhook endpoint may be auto-disabled if failure rate > 50% over 24 hours
3. Failed events available in admin UI for **manual replay** (up to 7 days)

### Timeout
- HTTP request timeout: **30 seconds**
- Responses must be sent within this window
- Return `2xx` quickly; do heavy processing asynchronously in your own queue

---

## Your Endpoint — Best Practices

### 1. Respond Quickly (< 5 seconds)
```typescript
app.post('/aims-hooks', async (req, res) => {
  // 1. Verify signature
  if (!verifyAimsWebhook(req.rawBody, req.headers['x-aims-signature'], SECRET)) {
    return res.status(400).end();
  }

  // 2. Enqueue for async processing
  await queue.add('process-aims-event', req.body);

  // 3. Respond quickly
  res.status(200).end();

  // Don't block the webhook on your business logic
});
```

### 2. Idempotent Processing
```typescript
async function processEvent(event: AimsEvent) {
  const existing = await db.processedEvents.findById(event.id);
  if (existing) return;  // Already processed

  // Your logic here

  await db.processedEvents.create({ id: event.id, processedAt: new Date() });
}
```

### 3. Handle Schema Evolution
Our envelopes may add **new fields** over time (never remove). Be liberal:

```typescript
// GOOD
const { id, type, data } = event;

// BAD (rejects unknown fields)
const strict: WebhookEvent = { ...event, extraCheck: true } satisfies WebhookEvent;
```

### 4. Use Strong Secrets
- Generate long random secrets (`whsec_...` prefix, 32+ bytes entropy)
- Never commit secrets to git
- Store in your secrets manager (AWS Secrets Manager, Vault, etc.)

### 5. Monitor Failures
- Alert if your endpoint returns 5xx often (we might disable it)
- Alert if signature verification fails (possible attack)
- Log `event.id` for every processed event

---

## Testing Webhooks

### Sandbox Mode
- Test webhook endpoints receive events from sandbox tenant
- Set `livemode: false` in event envelope
- Separate secret from production

### Manual Triggers (Admin UI)
Tenant admins can manually trigger a test event:
- Select event type
- Customize payload (simulate real data)
- Sends to registered endpoints with real signature

### CLI Tool (planned)
```bash
aims webhooks listen --forward-to http://localhost:3000/hooks
```
Forwards live events to your local dev server (Stripe CLI-style).

---

## Event Versioning

### API Version Pinning
When creating a webhook, the current API version is pinned:
```json
{
  "url": "...",
  "events": [...],
  "api_version": "2026-04-19"
}
```

### Versioned Payloads
Breaking changes to payload shape trigger a new `api_version`. Your webhook continues receiving old shape until you opt into the new version.

### Deprecation
When a version is deprecated:
- Tenant admin notified 6 months ahead
- New webhooks can't use deprecated version
- Existing webhooks given 12 months to migrate

---

## Audit Trail

Every webhook delivery (success or failure) is logged:
- Event ID
- Endpoint URL
- Request/response status
- Latency
- Number of attempts
- Final status

Tenant admins can view in `/admin/webhooks/{id}/deliveries` and replay failed deliveries manually.

---

## Example Payloads

### finding.issued
```json
{
  "id": "evt_01HXKZT3BY9WQZQGEVJGAXF4K",
  "type": "finding.issued",
  "api_version": "2026-04-19",
  "tenant_id": "clxyz_01h7m8n4a0000...",
  "occurred_at": "2026-04-19T10:32:11.458Z",
  "data": {
    "object": {
      "id": "clfnd_01h7m8n4a0000...",
      "findingNumber": "FIN-2026-001-003",
      "engagementId": "cleng_...",
      "title": "Inadequate segregation of duties in accounts payable",
      "status": "ISSUED",
      "classification": "MATERIAL_WEAKNESS",
      "classificationScheme": "GAGAS_DEFICIENCY_TIER",
      "riskRating": "HIGH",
      "elementValues": {
        "CRITERIA": "...",
        "CONDITION": "...",
        "CAUSE": "...",
        "EFFECT": "..."
      },
      "lockedAt": "2026-04-19T10:32:11.458Z",
      "signedHash": "a7c9d2e4f5...",
      "signedBy": "clusr_...",
      "createdAt": "2026-04-01T..."
    }
  },
  "request_id": "01HXKZT3BY9WQZQGEVJGAXF4K",
  "livemode": true
}
```

### cap.overdue
```json
{
  "id": "evt_01HXKZT3BZAAQ...",
  "type": "cap.overdue",
  "api_version": "2026-04-19",
  "tenant_id": "clxyz_...",
  "occurred_at": "2026-04-19T00:00:00.000Z",
  "data": {
    "object": {
      "id": "clcap_...",
      "recommendationId": "clrec_...",
      "title": "Implement automated purchase approval workflow",
      "status": "OVERDUE",
      "dueDate": "2026-03-31",
      "daysOverdue": 19,
      "responsiblePerson": "Jane Doe"
    }
  },
  "livemode": true
}
```

### approval.requested
```json
{
  "id": "evt_...",
  "type": "approval.requested",
  "tenant_id": "...",
  "occurred_at": "...",
  "data": {
    "object": {
      "id": "clapr_...",
      "entityType": "finding",
      "entityId": "clfnd_...",
      "workflowCode": "FINDING_APPROVAL",
      "stepOrder": 2,
      "stepLabel": "Supervisor Approval",
      "assignedToId": "clusr_...",
      "slaDueAt": "2026-04-22T10:32:11Z"
    }
  },
  "livemode": true
}
```
