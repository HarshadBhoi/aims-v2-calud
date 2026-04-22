# Runbook: Security Incident Response

<!--
REFERENCE IMPLEMENTATION — Step-by-step playbook for a confirmed or suspected
security incident. Distinct from ops runbook (devops/RUNBOOKS.md §6) which
handles availability incidents. Use this when evidence suggests unauthorized
access, data exfiltration, integrity compromise, or regulatory-threshold
privacy event.
-->

## Quick reference

| | |
|-|-|
| **Severity** | SEC-P1 (confirmed/material) or SEC-P2 (suspected/significant) |
| **Ack SLA** | 5 minutes |
| **IC assigned** | Within 15 minutes |
| **Customer notification** | Per DPA + regulatory — typically 72h from confirmation |
| **Postmortem** | Within 14 days |

---

## 0. Before You Do Anything

- **Preserve evidence** before you mutate it
- **Do not discuss details in open channels** where attacker might have visibility
- **Do not speculate on attribution** in writing
- **Default: inform, don't conceal** — visibility inside the team is correct

---

## 1. Declaration (T+0 to T+15 minutes)

### 1.1 Acknowledge page
- PagerDuty ack → on-call + secondary notified
- Join incident Slack channel (auto-created) OR create via `/incident declare-security SEV=p1 "<short description>"`
- Join Zoom bridge (link in channel)

### 1.2 Confirm severity
Run the SEC-P1 vs SEC-P2 test:
- SEC-P1: confirmed breach/compromise of production data OR regulatory-threshold event
- SEC-P2: strongly suspected; unconfirmed

If SEC-P3/P4: track but don't run full incident process.

### 1.3 Assign roles
- **Incident Commander (IC)** — drives; often the Security Lead
- **Technical Lead** — hands-on
- **Scribe** — timestamps decisions/actions in channel
- **Legal** — looped in IMMEDIATELY for any customer-data implications (page Legal via PagerDuty)
- **Comms Lead** — assigned when impact clearer
- **Forensics coordinator** — if firm being engaged

### 1.4 Notify leadership
- VP Eng / CTO: immediate
- CEO: within 30 min for SEC-P1
- Board: per incident comms matrix (typically material incidents only)

### 1.5 Announce (internal)
Auto-generated channel message:
> 🚨 SECURITY INCIDENT DECLARED — SEC-P1
> Summary: [1-line description]
> IC: @<person> · Tech: @<person> · Scribe: @<person>
> Bridge: [Zoom link]
> Status: Investigating

---

## 2. Evidence Preservation (within 1 hour)

### 2.1 Before mutating anything
Capture initial state. Failure to preserve = regulators + lawyers unhappy + investigation cripple.

### 2.2 What to preserve
- Screenshots (full-screen, with timestamp)
- Relevant logs (copy to incident-specific S3 bucket with Object Lock):
  - CloudTrail
  - Auth provider (Okta)
  - VPC Flow Logs
  - WAF logs
  - Application audit log
  - Kubernetes API logs
  - EDR alerts
- Running process state (pods, containers) if compromised
- Memory dumps (if forensics firm recommends)
- Disk snapshots for compromised EC2 / EBS volumes
- Email content if relevant (Google Vault for hold)

### 2.3 Chain of custody
- Timestamp (UTC)
- Who collected
- SHA-256 hash of each artifact
- Store in `s3://aims-incident-<id>-evidence/` (write-once, Object Lock 7y)

### 2.4 Engage forensics firm (for SEC-P1)
- Call pre-retained firm's incident line
- Outside counsel engages them (attorney-client privilege protection)
- Share evidence snapshot + initial findings
- They may direct further evidence collection

---

## 3. Containment (T+0 to T+2 hours — fastest possible)

**Goal: stop the bleeding. Not to fix. Not to understand fully. Just stop.**

### 3.1 Assess ongoing vs historical
Is attacker still active? Clues:
- Recent unusual API calls
- Open sessions from suspicious IPs
- New admin accounts created in last X minutes
- Data egress still occurring

### 3.2 If ongoing
Pick fastest containment that preserves evidence:

#### Compromised credential
- `okta.deactivate(<user>)` immediately
- Revoke active sessions: `okta.revoke-sessions(<user>)`
- Rotate any API keys associated
- Force password reset + MFA re-enroll

#### Compromised AWS role
- Revoke active STS sessions: `aws iam create-policy-version` (deny-all policy attached)
- OR delete role (harder to undo, but fast)
- Audit CloudTrail for last 48h of that role

#### Compromised EKS pod
- `kubectl delete pod <pod> --grace-period=0` (after snapshot)
- Node drained + terminated if suspected persistence
- New image built with mitigation

#### Exploited vulnerability in code
- Emergency feature flag OFF (if available)
- Hotfix branch: block or revert vulnerable endpoint
- WAF rule: block exploit pattern
- Take affected endpoint offline if critical

#### Data exfiltration via API abuse
- Revoke API key
- WAF rule: block source IP / user-agent
- Rate limit tighter
- Review which tenants' data accessed

### 3.3 If historical (attacker gone)
- Focus on scope assessment + eradication
- Preserve evidence while mitigating recurrence

### 3.4 Don't do these during containment
- Power off systems needed for forensics (unless last resort)
- Wipe + rebuild before snapshot
- Delete logs to "clean up"
- Dismiss indicators as "probably false positive"

---

## 4. Analysis (parallel to containment)

### 4.1 Determine
- **What happened** — chain of events
- **Which data was involved** — classifications, tenants
- **Scope** — individuals, records, tenants affected
- **Timeline** — first access vs first detection
- **Root cause** — technical + systemic

### 4.2 Confidence levels
Record in incident ticket:
- **High**: concrete evidence (extracted data on pastebin, etc.)
- **Medium**: strong indicators (impossible-travel login + data access)
- **Low**: suspicious but ambiguous

Initial containment often happens at Medium/Low — better to over-contain than wait.

### 4.3 Scope of data impact
Prioritize:
1. Did any **Regulated** data get accessed?
2. Did any **Confidential** data get exfiltrated?
3. How many **tenants**?
4. How many **individuals**?

These drive regulatory notification decisions.

---

## 5. Eradication (T+2 to T+24 hours)

### 5.1 Remove all attacker presence
- Identify all IOCs (IPs, accounts created, backdoors, modified files)
- Search everywhere for these IOCs
- Remove every instance
- Rebuild (don't clean) compromised systems from trusted images

### 5.2 Fix the underlying vulnerability
- Patch the vulnerability / misconfiguration that enabled entry
- Add detection rules to prevent recurrence
- Test the fix

### 5.3 Rotate potentially-exposed credentials
- Wider than just the known-compromised
- If attacker had access to a system, assume all credentials on that system exposed
- Coordinate rotation to minimize disruption

---

## 6. Customer + Regulatory Notification

### 6.1 Assess obligations
Legal + DPO lead this. Factors:
- What personal data was involved?
- Which jurisdictions (EU, UK, CA, other US states)?
- HIPAA PHI involved?
- Contractual notification timelines per customer DPA?

### 6.2 Timelines (non-exhaustive)
- **GDPR**: supervisory authority within 72h if risk to data subjects; subjects "without undue delay" if high risk
- **UK GDPR**: same 72h
- **CCPA**: "without unreasonable delay"
- **State laws (US)**: vary — some 30 days, some "as soon as feasible"
- **HIPAA**: affected individuals within 60 days; HHS within 60 days for <500; concurrent notification for ≥500
- **SEC** (if material + public co): 4 business days (Item 1.05 8-K)
- **DPA-specific**: review contract — some customers demand 24 or 48h

### 6.3 Notification content
Include:
- What happened (plain language; technical appendix if sophisticated recipient)
- What data was / may have been affected
- When detected + confirmed
- What we've done (containment, eradication)
- What we're doing (investigation, future prevention)
- What the customer / subject should do (if anything)
- How to contact us
- Their rights

Do NOT include:
- Attribution speculation
- Uncontrolled technical details attackers could weaponize
- Blame / liability posturing

### 6.4 Drafting
- Legal writes or heavily reviews
- CISO + Comms Lead contribute
- CEO approves material customer-facing notifications
- Outside counsel review for regulatory filings

### 6.5 Delivery
- Customer notifications: email to tenant admins + Statuspage update (if availability impact)
- Large impact: personalized outreach from CS + CEO
- Regulatory: per jurisdictional portal / procedure

---

## 7. Recovery (post-containment)

### 7.1 Resume normal operations
- Validate attacker truly gone (re-scan, re-audit)
- Re-enable access blocked during containment
- Communicate to staff + customers that service normal

### 7.2 Heightened monitoring (30 days)
- Enhanced alerts for incident-specific IOCs
- Watch for attacker return via different path
- Watch for related activity at peer companies (threat intel)

### 7.3 Evidence retention
- Incident evidence bucket: 7 years
- Investigation documents: attorney-client privilege preserved
- Incident record in compliance tool

---

## 8. Post-Incident Review (T+5 to T+14 days)

### 8.1 Schedule
- Blameless post-mortem review meeting
- 90 minutes typical
- Attendees: IC, Security Lead, affected engineering team, Legal, CISO
- Not: anyone whose presence would chill discussion

### 8.2 Agenda
1. Review timeline (detailed)
2. What went well
3. What didn't
4. Root cause analysis (5-whys for systemic)
5. Action items
6. Communication review

### 8.3 Output
- Incident report (technical) — internal
- Executive summary (sanitized) — leadership + Board
- Public summary — if appropriate (material + publicly disclosed)
- Action items tracked to closure

### 8.4 Share learnings
- Internal: `#security` + engineering all-hands
- External: blog post / trust center update if material
- Peer sharing: consider ISAC, private sharing groups

---

## 9. Communication Cadence (During Incident)

### Internal
- IC status update every 30 min (P1) or hourly (P2) in channel
- Leadership briefing every 2 hours (P1) or EOD (P2)
- Board notification for material incidents

### External
- Statuspage: updated when customer-visible impact confirmed
- Customer email: after initial assessment (usually 24-72h from declaration)
- Regulatory: per timeline

---

## 10. Special Scenarios (Quick-Reference)

### Ransomware
- Isolate + preserve evidence before anything
- Do NOT pay (company policy)
- Restore from immutable backup
- Engage forensics + outside counsel + cyber insurance immediately

### Insider (malicious)
- HR + Legal immediately
- Coordinate access revocation with termination if applicable
- Criminal referral considered
- Discretion — minimize Slack chatter

### SSO/IdP compromise
- Activate break-glass
- Force re-auth everyone
- Rotate JWT signing key (assume exposed)
- Coordinate with IdP vendor

### Data exfiltration via API
- Revoke API key + source IPs
- Audit logs for scope
- Affected tenants notified per contract

### Subpoena / lawful request
- Legal ONLY handles
- Never comply without review
- Customer notification unless gag order

---

## 11. Post-Incident Checklist

- [ ] Evidence preserved + chain of custody recorded
- [ ] Containment verified + sustained
- [ ] Eradication confirmed (IOCs cleared)
- [ ] Vulnerability patched
- [ ] Credentials rotated
- [ ] Enhanced monitoring in place
- [ ] Customer notifications sent
- [ ] Regulatory notifications filed
- [ ] Statuspage updated
- [ ] Internal postmortem complete
- [ ] Action items tracked
- [ ] Lessons shared internally
- [ ] External communication (if warranted) published
- [ ] Insurance claim filed (if material)
- [ ] Incident record archived (7y retention)

---

## 12. Contacts

Keep updated + printed + in break-glass safe:

| Role | Contact |
|------|---------|
| CISO | [phone, email] |
| CEO | [phone] |
| Outside counsel (privacy/cyber) | [firm, 24h line] |
| Forensics firm | [retainer contract, incident line] |
| Insurance broker | [contact, claim line] |
| PR firm | [contact, for public-facing incidents] |
| PagerDuty | [admin for escalation overrides] |

---

## 13. Related Documents

- `../INCIDENT-RESPONSE.md` — policy + framework
- `../../devops/RUNBOOKS.md` — ops incident process
- `../PRIVACY.md` — privacy-specific obligations
- `../HIPAA.md` — HIPAA breach rule
- `../SECURITY-PROGRAM.md` — governance
- `breach-notification.md` — notification drafting guide
- `subpoena-lawful-request.md` — legal process handling
