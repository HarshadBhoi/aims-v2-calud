# Notifications and Activity Center

> The unified notification layer across all modules. In-app bell, email digests, Microsoft Teams integration (MVP 1.0), Slack (MVP 1.5), @mention support, per-user preferences, per-event-type defaults, deep-links to entity context. Made a first-class module in Phase 1 R1 after reviewer flagged notifications as scattered fragments across features.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 16a
**Primary personas**: All users (everyone gets notifications)
**MVP phase**: 1.0 (core); Slack + DND + mobile push → 1.5/v2.1/v2.2+

---

## 1. Feature overview

Notifications surface relevant events to the right users through the right channels at the right time. Every module emits notification events; this module consumes and delivers them.

MVP 1.0 scope:
- In-app notification center (bell icon + inbox)
- @mention support in rich-text fields
- Email digest with configurable cadence
- Per-user notification preferences
- Per-event-type tenant defaults
- Microsoft Teams webhook integration
- Deep-links to entity context
- Outbound email identity (DKIM-signed tenant sender)

MVP 1.5 adds Slack integration + notification history. v2.1 adds DND hours. v2.2+ adds mobile push.

### 1.1 Integration pattern — outbox-driven

Per ADR-0004 transactional outbox pattern, notifications flow:
1. Module event (e.g., finding.issued) writes to `outbox_event` table in same transaction as state change
2. NestJS outbox worker reads event
3. Notification service determines: who should be notified, via which channel, with what template
4. Dispatches to channels (in-app queue, email, Teams webhook)
5. Marked delivered

This is the architectural contract from [`docs/06 §3.4`](../../docs/06-design-decisions.md) transactional outbox.

---

## 2. User stories — In-app notification center

### 2.1 US-NOTIF-001 — Priya sees notification bell

```gherkin
GIVEN Priya has 5 unread notifications
WHEN she looks at top-right corner of app
THEN bell icon shows badge "5"
WHEN she clicks bell
THEN dropdown opens with:
  - Recent notifications (unread bold)
  - Each with:
    - Icon (feature context)
    - Title + brief description
    - Timestamp
    - Deep-link to entity
  - "View all" link to full notification center
  - "Mark all read" action
```

**Acceptance criteria**:
- Badge count real-time or near-real-time
- Dropdown shows last 10 notifications
- Unread styling distinguishable
- Deep-link on click navigates to relevant entity with context

### 2.2 US-NOTIF-002 — Full notification center

```gherkin
WHEN Priya clicks "View all"
THEN notification center opens with:
  - Chronological list (newest first)
  - Filter by: type, source, date, read/unread
  - Search by keyword
  - Bulk actions (mark read, archive)
  - Pagination (50 per page)
  - Per-notification: full description, deep-link, timestamp, source module
```

### 2.3 US-NOTIF-003 — Mark notifications read

```gherkin
WHEN Priya opens a notification
  OR clicks "Mark as read"
  OR clicks on deep-linked entity
THEN notification marked read
  AND badge count decrements
  AND notification preserved but styled as read
```

---

## 3. User stories — Email digests

### 3.1 US-NOTIF-004 — Priya configures email preferences

```gherkin
GIVEN Priya wants fewer email notifications
WHEN she opens Account → Notifications
THEN she sees settings per event category:
  - Critical (immediate): always email
  - Standard: immediate / daily digest / weekly digest
  - Low-priority: weekly / off
WHEN she sets "Standard" to "daily digest"
  AND saves
THEN immediate emails stop for standard events
  AND daily digest email at 9 AM local time
```

**Acceptance criteria**:
- Per-user overrides tenant defaults
- Daily digest scheduled per user's timezone
- Weekly digest configurable day
- "Off" option available (in-app only)

### 3.2 US-NOTIF-005 — Daily digest email

```gherkin
GIVEN digest fires at 9 AM local time
WHEN generating Priya's digest
THEN email aggregates:
  - Yesterday's events (sorted by priority)
  - Open items requiring action
  - Grouped by engagement / feature
  - Deep-links to each
  - Unsubscribe / configure link
```

**Acceptance criteria**:
- Template branded per tenant
- DKIM-signed per tenant's outbound domain (per `tenant-onboarding-and-admin.md §4.2`)
- Mobile-responsive
- Max 50 events per digest (overflow → "...and N more")

---

## 4. User stories — @mentions

### 4.1 US-NOTIF-006 — @mentioning a user in a finding

```gherkin
GIVEN Priya is drafting finding 2026-001
  AND she types "@An"
THEN autocomplete shows engagement team members starting with "An"
  AND Priya selects Anjali
  AND @Anjali rendered with formatting
  AND saved with mention metadata
WHEN finding saves
THEN @mention event fires
  AND Anjali receives in-app notification + email (per her preferences)
  AND notification contains context (engagement, finding, specific section)
  AND deep-link to the finding
```

**Acceptance criteria**:
- Autocomplete filters to users who have access to the entity (no outsider pings)
- @mention preserved in rich text
- Notification ordering: @mentions prioritised over general notifications

### 4.2 US-NOTIF-007 — Team-wide @mentions

```gherkin
GIVEN Priya wants to notify entire engagement team
WHEN she types "@team"
THEN selects "Engagement Team"
  AND saves
THEN all team members notified
```

---

## 5. User stories — Teams integration

### 5.1 US-NOTIF-008 — Sofia configures Teams webhook

```gherkin
GIVEN Oakfield wants engagement notifications in Teams channel #audit-team
WHEN Sofia opens Tenant Settings → Notifications → Teams
  AND pastes Teams webhook URL
  AND selects event types to post:
    - Report issued
    - Material finding issued
    - CAP overdue (critical/material only)
  AND optionally maps specific engagements to channels
  AND saves
THEN integration active
WHEN matching event fires
THEN message posted to Teams channel with:
  - Card with event details
  - Deep-link to AIMS
  - Actionable button where applicable
```

**Acceptance criteria**:
- Multiple Teams webhooks per tenant (different channels)
- Event-type filtering
- Engagement-to-channel routing
- HMAC-signed outbound messages
- Failed deliveries retried + DLQ

### 5.2 US-NOTIF-009 — Slack (MVP 1.5)

Similar pattern but Slack-specific. Incoming webhooks, slash commands to query status, interactive buttons.

---

## 6. User stories — Outbound email identity

### 6.1 US-NOTIF-010 — Tenant configures sender domain

```gherkin
GIVEN Oakfield wants emails from `audits@oakfield.edu` not `noreply@aims.io`
WHEN Sofia configures outbound email identity
  AND verifies DKIM for `oakfield.edu`
  AND verifies SPF
THEN emails sent from Oakfield's domain
  AND auditees see legitimate-looking sender
  AND reduces phishing concerns
```

**Acceptance criteria**:
- DKIM + SPF verification required
- Verification via DNS TXT records
- Fallback to default sender if verification fails

---

## 7. User stories — Activity feed integration

### 7.1 US-NOTIF-011 — Engagement activity feed

Covered in [`engagement-management.md §2.6`](engagement-management.md). The notification center and the engagement activity feed share event infrastructure — both consume the same outbox events; the notification center surfaces user-personalised events, the activity feed surfaces engagement-scoped events.

### 7.2 US-NOTIF-012 — Cross-module unified feed

Notifications spanning multiple modules appear with consistent metadata:
- Module badge (engagement / finding / CAP / etc.)
- Timestamp in user's timezone
- Actor identity
- Action description
- Deep-link

---

## 8. Edge cases

### 8.1 Notification storm

If multiple events fire for the same user in short time, deduplicated/bundled:
- "Priya, you have 3 new findings to review" instead of 3 separate notifications

### 8.2 Offline user

Notifications queue until user is online; email arrives regardless.

### 8.3 Deactivated user

Deactivated users don't receive notifications; their previously-queued notifications purged.

### 8.4 Cross-tenant isolation

Notifications scoped per tenant via RLS. No leakage.

### 8.5 External email bounce

Bounce handled per SES bounce protocol; tenant admin alerted for persistent failures.

---

## 9. Data model

- `Notification` — per-user
- `NotificationPreference` — per-user per-event-type
- `TenantNotificationDefault` — per-tenant event routing
- `TeamsWebhookConfig` — per-tenant Teams setup
- `DigestDelivery` — scheduled digest tracking
- `OutboundEmailIdentity` — per-tenant sender config

---

## 10. API endpoints

```typescript
notification.list(input: {filter, pagination}): Notification[]
notification.markRead(input: {notificationIds}): void
notification.markAllRead(input: {}): void
notification.archive(input: {notificationIds}): void

preferences.get(input: {userId}): Preferences
preferences.update(input: PreferencesUpdate): Preferences

tenantAdmin.configureTeams(input: TeamsConfig): TeamsWebhookConfig
tenantAdmin.configureEmailIdentity(input: EmailConfig): EmailIdentity
tenantAdmin.setEventDefaults(input: DefaultsInput): EventDefaults
```

---

## 11. Permissions

| Role | Configure own prefs | Configure tenant defaults | Configure Teams webhook |
|---|---|---|---|
| Any user | ✅ | ❌ | ❌ |
| Sofia | ✅ | ✅ | ✅ |

---

## 12. Observability

- `notification.sent.count` (by channel)
- `notification.read.count`
- `notification.email.delivered.count` / `.bounced.count`
- `notification.teams.delivered.count` / `.failed.count`
- `notification.queue.depth` (at-a-glance health)

---

## 13. Performance

- In-app notification list p99 < 500ms
- Preference update p99 < 300ms
- Digest email generation: batch-async (not real-time); per-user digest < 10s

---

## 14. Dependencies

- Outbox pattern (per ADR-0004)
- Email service (SES per `devops/`)
- Teams / Slack webhook endpoints
- All feature modules emit events here

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 16a
- [`docs/06-design-decisions.md §3.4`](../../docs/06-design-decisions.md) — outbox pattern
- [`features/engagement-management.md §2.6`](engagement-management.md) — activity feed
- [`rules/workflow-state-machines.md`](../rules/workflow-state-machines.md) — events that trigger notifications

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged no specific changes for this file. The outbox-driven notification architecture was called out as a "massive differentiator that enterprise buyers will love."

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
