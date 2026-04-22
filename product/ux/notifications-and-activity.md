# UX — Notifications & Activity

> Notifications are how AIMS gets out of users' way when they're not looking, and brings them back precisely when they're needed. Activity feeds are how users catch up on what happened while they were away. Bad notification UX — either noisy (too many, unprioritized) or quiet (missed deadlines because no reminders) — destroys both trust and compliance. AIMS v2 aims for: signal > noise, contextual > generic, actionable > informational.
>
> **Feature spec**: [`features/notifications-and-activity.md`](../features/notifications-and-activity.md)
> **Related UX**: Appears in every other UX surface (banner, inbox, email), so this file documents the notification framework primarily
> **Primary personas**: All users — with differentiated defaults per role

---

## 1. UX philosophy

- **Three-channel strategy.** In-app (notification center), email (async), push/mobile (MVP 1.5+). Each channel has distinct delivery guarantees and UX expectations.
- **Priority drives channel.** Critical → in-app + email + (push). Normal → in-app + email digest. Low → in-app only.
- **Quiet hours honored.** Users set their own quiet hours; system holds non-urgent notifications.
- **Actionable notifications > informational.** Every notification has a primary action ("Review finding," "Approve CAP," "Sign report"). Informational-only events go to activity feed, not notification inbox.
- **Inbox zero is achievable.** Notifications are dismissible. Activity is immutable.
- **Digest over volume.** Default daily digest for normal-priority items; real-time only for critical.

---

## 2. Notification center (in-app)

Invoked from: bell icon in top nav.

### 2.1 Layout

```
┌─ Notifications ──────────────────────────────────── [Mark all read] [⚙]┐
│                                                                           │
│  4 unread · 12 in last 7 days                                            │
│                                                                           │
│  ┌─ Today ─────────────────────────────────────────────────────────────┐│
│  │ 🔴 F-2026-0042 returned for revision                   10 min ago   ││
│  │    David: "Please tighten the Cause element — see comments."         ││
│  │    [ Open finding → ]                                                 ││
│  │                                                                        ││
│  │ 🟡 PBC item overdue: Revenue recognition policy         2h ago      ││
│  │    Lisa has not submitted; due 2026-04-20 (2d overdue)               ││
│  │    [ Request update ]  [ Open PBC ]                                  ││
│  │                                                                        ││
│  │ 🟢 Lisa submitted PBC: Top-10 customer contracts        4h ago      ││
│  │    [ Review evidence ]                                                ││
│  │                                                                        ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  ┌─ Yesterday ─────────────────────────────────────────────────────────┐│
│  │ 🟢 APM v0.3 approved by Marcus                          20h ago     ││
│  │    Engagement phase gate: Planning → Fieldwork                       ││
│  │                                                                        ││
│  │ 🟡 CAP-042-01 reminder: due in 14 days                  1d ago      ││
│  │    [ Open CAP ]                                                       ││
│  │                                                                        ││
│  │ ⓘ New pack version available: GAGAS-2024.2              1d ago      ││
│  │    [ Review changes ]                                                 ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Older (8)  [Show]                                                        │
└───────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Priority indicators

- 🔴 **Critical** — immediate attention; delivered real-time; stays in inbox until acknowledged
- 🟡 **Normal** — within 24h; delivered real-time but batched into digest email
- 🟢 **Informational** — reference only; can be auto-dismissed
- ⓘ **System** — platform-level (pack updates, scheduled maintenance)

### 2.3 Notification item

- Icon (priority)
- Message (1-2 lines, human language, no jargon when possible)
- Timestamp (relative; absolute on hover)
- Primary action button(s) (up to 2)
- Mark as read / dismiss (X on hover)

### 2.4 Grouping

Same-topic notifications group ("3 CAP updates from Lisa Chen"). Click expands.

---

## 3. Notification settings

Invoked from: bell icon `⚙` or Profile → Notifications.

### 3.1 Layout

```
┌─ Notification preferences ────────────────────────────────────────────────┐
│                                                                              │
│  Channels:                                                                   │
│   In-app ✓ (always on)                                                       │
│   Email  [x] Enabled         [ harshad@company.com ]                        │
│   Mobile push: (configure on AIMS mobile app — MVP 1.5)                     │
│                                                                              │
│  Delivery mode:                                                              │
│   ( ) Real-time for everything                                              │
│   (●) Real-time for critical; daily digest at 8:00 AM for normal            │
│   ( ) Daily digest only (no real-time except critical)                      │
│                                                                              │
│  Quiet hours:                                                                │
│   [x] Respect quiet hours  [ 18:00 ] to [ 08:00 ]   Timezone: America/NY   │
│   Exceptions during quiet hours:  [x] Critical only                         │
│                                                                              │
│  Per-event preferences:                                                      │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ Event                              │ In-app │ Email  │ Priority       ││
│  │ Finding returned for revision      │   ✓    │   ✓    │ Critical       ││
│  │ Finding submitted for review       │   ✓    │   ✓    │ Normal         ││
│  │ CAP assigned to me                 │   ✓    │   ✓    │ Normal         ││
│  │ CAP reminder (T-7/T-3/T-0)         │   ✓    │   ✓    │ Normal         ││
│  │ CAP overdue                        │   ✓    │   ✓    │ Critical       ││
│  │ PBC item submitted                 │   ✓    │   ✗    │ Normal         ││
│  │ Weekly engagement summary          │   ✗    │   ✓    │ Info           ││
│  │ Pack version available             │   ✓    │   ✗    │ Info           ││
│  │ ... (more events)                                                       ││
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│                                                         [ Save ]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Role-based defaults

- **CAE**: more emails (report-signoff, material finding alerts)
- **Supervisor**: review queue alerts, team CAP overdue
- **Senior/Staff**: finding comments, CAP reminders
- **Auditee** (Lisa): PBC reminders, finding responses, CAP reminders
- **Tenant Admin**: user activity, SSO events, billing

---

## 4. Email notifications

### 4.1 Design principles

- Subject line = signal ("David returned F-2026-0042 for revision")
- First line = call to action ("Review David's comments and resubmit")
- Plain text first, HTML enhancement
- Unsubscribe link per mail (per type, not global)
- Footer with contextual links: open in app, notification settings, unsubscribe

### 4.2 Daily digest layout

```
Subject: Your AIMS digest — 4 items (April 22, 2026)

Good morning Jenna,

Here's what happened while you were away:

CRITICAL (1)
 • F-2026-0042 returned for revision by David
   [Open finding]

NORMAL (2)
 • Lisa submitted 3 PBC items — Top-10 customer contracts, …
   [Review submissions]
 • CAP-038-02 is due in 7 days
   [View CAP]

INFO (1)
 • New pack version GAGAS-2024.2 available
   [Review changes]

— AIMS
Manage notification preferences: [link]
```

### 4.3 Real-time email layout (critical only)

Single item. Large, clear, actionable. Primary action = URL button. No digest format — one email per event.

---

## 5. Activity feed (engagement-scoped)

Invoked from: engagement dashboard → Activity tab.

### 5.1 Layout

```
┌─ Activity · FY26 Q1 Revenue Cycle Audit ─────────────────────────────────┐
│                                                                             │
│  ┌─ Filter ──────────────────────────────────────────────────────────┐   │
│  │ User: [All ▼]  Type: [All ▼]  Date range: [Last 30 days ▼]       │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Apr 22  10:47 AM                                                           │
│   🟢 Marcus Thompson approved the APM (v0.4 → APPROVED)                   │
│       Engagement phase gate: Planning → Fieldwork                           │
│                                                                             │
│  Apr 22   9:15 AM                                                           │
│   🟡 David Chen returned F-2026-0042 for revision                          │
│       Comment: "Please tighten the Cause element — see inline comments."  │
│                                                                             │
│  Apr 21   3:22 PM                                                           │
│   🟢 Lisa Chen submitted PBC: Top-10 customer contracts                    │
│       3 attachments · Total 2.1 MB                                          │
│                                                                             │
│  Apr 21   2:10 PM                                                           │
│   🟢 Jenna Patel created F-2026-0042                                       │
│       Classification: Significant · Escalated from OBS-2026-0042            │
│                                                                             │
│  Apr 20  11:45 AM                                                           │
│   🟢 David Chen signed WP-0089                                             │
│                                                                             │
│  ... (older entries)                                                         │
│                                                                             │
│  [Show 30 more]   [Export CSV]                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

Activity is read-only, immutable history. Different from the audit log (which is cryptographically verifiable; see [audit-trail-and-compliance.md](audit-trail-and-compliance.md)). Activity is for humans; audit log is for compliance/legal.

### 5.2 Tenant-wide activity

Admin → Activity monitor. Same layout, cross-engagement scope. Used for team pulse-check and anomaly investigation.

---

## 6. Alerts & banners (in-context)

Event-driven banners within the app surface:

### 6.1 Per-surface banners

- **Engagement dashboard, APM pending CAE approval**: amber banner "APM awaiting CAE approval (submitted 2 days ago). [View in approvals]"
- **Finding editor, blocking comments**: red banner "3 unresolved comments prevent submission. [View]"
- **CAP overdue**: red banner on CAP detail "This CAP is 21 days overdue. [Request extension] [Update now]"
- **Pack version available**: amber banner on engagement dashboard (dismissible) "GAGAS-2024.2 available. [Review changes]"

### 6.2 Toast notifications

Transient feedback (3-5s):
- "Finding saved"
- "Evidence attached"
- "Approval request sent to David"
- "Unable to save. [Retry]"

Toasts dismissible, but appear/disappear automatically. Not persisted.

---

## 7. Unsubscribe / mute flows

### 7.1 Per-type unsubscribe

Each email footer has "Unsubscribe from this type" link → lands on AIMS with pre-toggled preference and confirmation.

### 7.2 Pause notifications (vacation)

Profile → Notifications → "Pause all notifications (vacation)":
- Date range picker
- Exceptions: [ ] Allow critical through anyway
- All non-exception notifications queue, delivered as a digest on return OR discarded (user preference)

### 7.3 Mute an engagement

Engagement dashboard → Mute. Stops all notifications from that engagement for the user (useful when reassigned away or finishing a phase). Critical notifications still flow.

---

## 8. Loading, empty, error states

| State | Treatment |
|---|---|
| No notifications | Notification center: "All caught up. 🎉" Icon not visible. |
| Notification delivery failure (email bounce) | In-app banner to user: "Your email bounced. [Update email]" |
| Notification center pagination | Infinite scroll or "Show older (12)" button. |
| Quiet hours active with queued items | Bell icon shows subtle "paused" indicator; clicking explains "Queued during quiet hours; will deliver at 8am." |
| User opts out of all channels (not allowed) | "In-app notifications cannot be disabled — they're required for some platform events." |

---

## 9. Responsive behavior

- Notification center is mobile-native (drawer from right on tablet, full-screen on mobile)
- Activity feed scrolls fine on all sizes
- Email templates are mobile-responsive HTML

---

## 10. Accessibility

- Notification count is `aria-live="polite"` announcement when new arrive
- Priority icons always paired with text labels
- Time ago uses `<time datetime>` with absolute fallback
- Notification items are `<article>` with proper heading hierarchy
- Dismiss actions keyboard-accessible

---

## 11. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `g n` | Go to notifications |
| `j` / `k` | Next / prev notification |
| `Enter` | Open notification's primary action |
| `e` | Mark focused as read |
| `Shift+E` | Mark all read |

---

## 12. Microinteractions

- **New notification**: bell icon pulses once; count bubble bumps; subtle sound (user preference)
- **Notification read**: fades from unread (bold) to read (normal) with 200ms transition
- **Dismissed**: slides out left with 150ms animation
- **Toast**: slides up from bottom with 200ms; exits with 200ms fade + slide down

---

## 13. Analytics & observability

- `ux.notif.delivered { event_type, channel, priority }`
- `ux.notif.opened { event_type, channel }`
- `ux.notif.action_clicked { event_type, action_id }`
- `ux.notif.dismissed { event_type, was_unread }`
- `ux.notif.unsubscribed { event_type, channel }`
- `ux.notif.digest_sent { user_id, item_count }`
- `ux.notif.quiet_hours_queued { user_id, count }`

KPIs:
- **Notification engagement rate** (delivered → opened/acted; target ≥60%)
- **Dismiss-without-action rate** (target ≤30%; high = noise problem)
- **Digest open rate** (target ≥50%)
- **Critical notification response time** (p90 ≤ 4 business hours)
- **Unsubscribe rate** (target ≤1% per type)

---

## 14. Open questions / deferred

- **Mobile push notifications**: MVP 1.5 (requires mobile app)
- **Slack/Teams integration for notification delivery**: MVP 1.5
- **ML-based notification ranking** (surface what the user likely cares about): v2.1
- **Cross-user ACK workflows** ("did you see this?"): deferred
- **SMS notifications for auditees as default**: tenant-configurable; default off

---

## 15. References

- Feature spec: [`features/notifications-and-activity.md`](../features/notifications-and-activity.md)
- Related UX: [`audit-trail-and-compliance.md`](audit-trail-and-compliance.md) (distinction between activity feed and audit log)
- API: [`api-catalog.md §3.15`](../api-catalog.md) (`notification.*`)

---

*Last reviewed: 2026-04-22. Phase 6 (UX) draft — pending external review.*
