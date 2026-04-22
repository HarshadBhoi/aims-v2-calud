# Security Incident Response

> Security incidents are distinct from operational incidents: different response model, different comms, different regulatory + legal obligations. Playbook for confirmed or suspected security events — detection, containment, eradication, recovery, lessons, notification.

---

## 1. Security Incident vs Ops Incident

| | Security Incident | Ops Incident |
|-|-------------------|---------------|
| Trigger | Suspected breach, data exfiltration, unauthorized access, abuse | Service degradation, outage, performance |
| Priority | Always elevated (data/trust risk) | Per customer impact |
| Roles | Security-led + Legal + Comms + Eng | SRE-led + Eng |
| External comms | Regulatory, legal-drafted | Statuspage, customer notice |
| Preservation | Evidence chain-of-custody | Logs, but no forensic hold |
| Postmortem | Blameless + legal-sensitive writing | Blameless |
| Legal involvement | Always; early | Usually not |
| Timeline | Ongoing for days to months | Minutes to hours typically |

Any ops incident MAY escalate to a security incident if evidence of unauthorized access / data exfiltration / integrity compromise emerges. Escalation trigger: paging the Security on-call.

---

## 2. Incident Severity (Security-Specific)

Separate from but correlated with operational severity:

| Severity | Definition | Examples |
|----------|-----------|----------|
| **SEC-P1** | Confirmed breach of customer data OR critical production compromise OR regulatory-breach threshold | Tenant data exfiltrated; prod DB unauthorized access; ransomware; root account compromise |
| **SEC-P2** | Unconfirmed suspected breach; or confirmed compromise of non-prod systems; or regulatory close-call | Suspicious access patterns in prod logs; dev-env compromised with confidential data; insider alert |
| **SEC-P3** | Security-relevant event without active compromise indicators | Failed exploit attempt blocked by WAF; single phished credential detected + rotated; vulnerable artifact found in prod but not exploited |
| **SEC-P4** | Low-signal security event | Spam failed-login brute force; single click on phishing simulation; expired cert warning |

Any **SEC-P1** or sustained **SEC-P2** triggers formal incident process. P3/P4 tracked but not full ceremony.

---

## 3. Detection Sources

### Automated
- **AWS GuardDuty** — unusual API calls, impossible travel, known bad IPs
- **CloudTrail + AWS Config** — IAM changes, resource modifications outside Terraform
- **WAF logs** — blocked exploit attempts, patterns
- **Sentry** — application errors indicative of probe/exploit
- **Auth provider** (Okta) — abnormal login patterns, MFA failures
- **DLP** (Phase 3+) — confidential data leaving boundary
- **EDR** — endpoint detection on laptops (CrowdStrike, SentinelOne, or similar)
- **IDS** (AWS-managed) — network-level intrusion patterns

### Human
- **Staff-reported** — observed suspicious activity, device loss, etc.
- **Customer-reported** — their security team flags anomaly
- **Researcher-reported** — via VDP or bounty
- **Law enforcement** — served with subpoena / notice

### Hunt
- **Threat hunting** — Security team proactively investigates patterns (Phase 3+)
- **Red team findings**
- **Pen test findings**

---

## 4. The Six Phases (NIST SP 800-61 + practical)

```
  1. Prepare  →  2. Detect + Analyze  →  3. Contain  →  4. Eradicate
                                                              │
                                                              ▼
                       6. Lessons + Improve  ←  5. Recover  ←─┘
```

Not strictly linear — phases overlap, iterate.

---

## 5. Phase 1 — Prepare (Continuous)

Everything we do before an incident happens:
- Policies + runbooks maintained
- Tooling deployed + tested (logging, SIEM, SSO audit trails)
- On-call roster + escalation tree
- Training + tabletop exercises
- Legal + comms templates ready
- Customer notification templates
- Forensic readiness (can we capture evidence if needed?)
- Relationships: outside counsel, forensic firm retained, PR firm retained, cyber insurance contact

### Retained relationships
- **Outside counsel** (data-privacy specialist)
- **Forensics firm** (Mandiant, CrowdStrike, NCC) — retainer + on-call
- **PR / comms firm** for public incidents (Phase 3+)
- **Insurance broker** — named contact for cyber claims

Having these pre-signed saves hours during an incident.

### Preservation pre-readiness
- Logging has hash-chain + immutable retention (see `database/` audit log + S3 Object Lock)
- AWS CloudTrail to log-archive account (can't be altered from workload account)
- Playbook: who captures what evidence, how, within 1 hour of incident declaration

---

## 6. Phase 2 — Detect + Analyze

### Detection
Alert from any source → Security on-call paged via PagerDuty.

### Initial triage (within 30 minutes)
- Acknowledge page
- Validate: is this real? (most alerts aren't incidents)
- Severity estimate
- If SEC-P2 or higher → declare incident + spin up response

### Declare incident
Via `/incident declare-security SEV=p1 "Suspected data exfiltration via compromised API key"` → bot automation:
- Creates Slack channel `#incident-sec-YYYY-MM-DD-<slug>`
- Opens Zoom bridge
- Pages Incident Commander (IC), Security Lead, Legal
- Starts timeline tracker
- Notifies leadership (CEO, VP Eng)
- Captures initial evidence snapshot

### Analyze
- What happened?
- What systems / data affected?
- What's the timeline (first observation, first activity, ongoing)?
- Attribution (if possible)?
- Is the attacker still active?

### Confidence levels
Incident records confidence:
- **High confidence** — evidence concrete (e.g., data seen on pastebin)
- **Medium** — strong indicators (unusual API access pattern from sanctioned IP)
- **Low** — suspicious but ambiguous (may be false positive)

Low-confidence incidents can still warrant containment; honest labeling helps leadership + customer comms.

---

## 7. Phase 3 — Contain

### Goal
Stop further damage. Not to "fix" — just to stop bleeding.

### Tactics (pick based on situation)
- **Isolate**: disable compromised account; revoke API key; block IP at WAF/firewall
- **Segment**: network-isolate a compromised pod / service
- **Freeze**: read-only mode on affected tenants; disable new signups
- **Rotate**: emergency rotation of potentially-exposed secrets
- **Evict**: kill sessions; re-issue tokens
- **Force logout + password reset** for affected users
- **Snapshot**: preserve state for forensics BEFORE mutation-heavy containment

### Tradeoffs
- **Speed vs evidence**: wiping a pod kills the attacker's foothold but also kills evidence. Snapshot first, then wipe.
- **User impact vs security**: disabling SSO widely stops attacker but disrupts legitimate users. Weigh carefully.
- **Short-term fix vs long-term**: patch the vulnerability later; right now, just block the exploit.

### Short-term vs long-term containment
- **Short-term (minutes)**: stop bleeding (revoke, block)
- **Medium-term (hours)**: safe state (isolate systems, move traffic)
- **Long-term (days)**: architecturally stronger (rotate all keys of that type, implement missing control)

---

## 8. Phase 4 — Eradicate

### Goal
Remove attacker's access + foothold entirely.

### Activities
- Identify all IOCs (Indicators of Compromise): IP addresses, malware hashes, created accounts, backdoors
- Search + remove all instances
- Patch vulnerability that enabled entry
- Change all potentially-compromised credentials (not just the known ones)
- Rebuild compromised systems from trusted images (don't "clean" — replace)
- Update detection rules to catch recurrence

### Scope creep is normal
Once you find one thing, look for others. Assume compromise is broader than initial detection.

---

## 9. Phase 5 — Recover

### Return to normal operations
- Restore service if disrupted
- Re-enable access that was blocked during containment
- Validate: is attacker really gone? Re-scan, re-audit
- Gradual ramp-back: not "full speed" day 1

### Heightened monitoring
For 30 days post-incident: enhanced monitoring specific to the incident pattern. Attacker may try again via a different path.

### Evidence preservation
Forensic artifacts retained minimum 7 years (SOC 2, legal holds). Chain of custody documented.

---

## 10. Phase 6 — Lessons + Improve

### Post-Incident Review (PIR)
Within 14 days of closure:
- Incident Commander + Security + affected team leads + Legal
- Blameless: focus on systemic causes
- Document:
  - Timeline (detailed, minute-by-minute for critical phases)
  - Detection: how + when?
  - Response: what went well? What didn't?
  - Root cause (technical + systemic)
  - Data impact
  - Customer / regulatory impact
  - Action items: preventive + detective + response improvements

### Action items
Each action item:
- Owner (specific person)
- Priority (P1 / P2 / P3)
- Due date
- Tracked to completion

### Share learnings
- Incident-specific: internal-only details
- Lessons in general: engineering-wide share (sanitized)
- Public postmortem: for incidents with customer impact or if transparency adds trust (with legal review)

---

## 11. External Communications

### Customer notification

| Impact | Notification path | Timeline |
|--------|-------------------|----------|
| No customer data affected | Internal only | N/A |
| Customer data potentially accessed | Direct notification to affected tenant admins | Per contract (usually 24–72h after confirmation) |
| Customer data confirmed accessed / exfiltrated | Notification + regulator notification | Per regulation (GDPR: 72h) |
| Systemic (multi-tenant) | Statuspage + email + possibly blog | ASAP after containment |

### Notification content
Required (generally):
- What happened (technical summary in plain language)
- What data was / may have been affected
- When it was detected
- What we've done / are doing
- What the customer should do
- How to contact us for questions
- Support resources (e.g., credit monitoring if applicable — usually not for our data type)

NOT in first notification:
- Attribution speculation
- Full technical details
- Blame
- Legal posturing

### Regulatory notification

| Regulator | Trigger | Timeline |
|-----------|---------|----------|
| Supervisory Authority (GDPR) | Breach involving EU personal data likely to cause risk | **72 hours** |
| UK ICO | Breach under UK GDPR | 72 hours |
| US state AG (varies) | PII breach involving state residents | Varies: some 30 days, some "without unreasonable delay" |
| HHS (HIPAA) | PHI breach | **60 days** of discovery (with exceptions for < 500 affected) |
| SEC (if we become public company or customer is SEC-regulated) | Material cyber incident | **4 business days** for material incidents (Item 1.05 8-K) |
| FTC | Consumer data breach (if applicable) | ASAP |
| Sector-specific (NYDFS, etc.) | Varies | Often 72h |

Legal drives regulatory notifications; Security provides facts.

### Law enforcement
- Voluntary notification for criminal activity (FBI IC3, Secret Service for financial)
- Required if subpoenaed
- Outside counsel advises whether to involve — balances criminal case progression vs other obligations

### Public disclosure
Timing balances:
- Transparency commitment to customers
- Preserving investigation integrity
- Legal + regulatory coordination

Typical: coordinated disclosure when containment complete + primary customers notified. Blog post or public advisory on trust.aims.io.

---

## 12. Roles in a Security Incident

### Incident Commander (IC)
- Owns the incident end-to-end
- Makes decisions; others defer
- Doesn't personally do technical work (delegates)
- Usually most experienced available person

### Security Lead
- Technical direction on security aspects
- Coordinates with forensics firm
- Owns evidence preservation
- Often becomes IC in big incidents

### Technical Lead (by affected system)
- Hands-on fixes
- Coordinates engineering response
- Reports status to IC every 30 min

### Legal Lead
- Regulatory notification decisions
- Outside counsel liaison
- Reviews customer comms
- Law enforcement coordination

### Comms Lead
- External: customer notifications, Statuspage, press
- Internal: staff comms, leadership briefings
- Coordinates with Legal on content

### Scribe
- Timestamped record of decisions + actions
- Slack channel summary
- Critical for legal + postmortem

### Leadership
- CEO briefed every 2 hours (P1) or EOD (P2)
- VP Eng / CTO in tight loop
- Board notified for material incidents
- Not operational; consulted on strategic calls

Small incidents may have one person play multiple roles. Big incidents have strict role separation.

---

## 13. Evidence + Forensics

### Chain of custody
Any evidence collected (logs, memory dumps, disk images, screen captures):
- Timestamped (system + UTC)
- Collector identified
- Hash for integrity
- Stored in chain-of-custody bucket (write-once)
- Access logged

### Logs to preserve
- CloudTrail (AWS API activity) — already in log-archive account with Object Lock
- Application audit log (AuditEvent table) — hash-chained; mirrored to immutable S3
- Auth provider logs (Okta)
- Network flow logs (VPC Flow Logs)
- WAF logs
- Kubernetes API audit logs
- Any suspicious artifact (malware, webshell, etc.)

### Forensics firm engagement
- Pre-retained firm on call
- Engaged for SEC-P1 or significant SEC-P2
- Our Security team coordinates + provides access
- Firm's report becomes part of incident record
- Under attorney-client privilege (outside counsel engages firm)

---

## 14. Specific Scenarios

Short playbooks. Full detail in `implementation/runbooks/`.

### Compromised credential
- Rotate/revoke immediately
- Audit access by that credential since suspected compromise
- Force password reset + MFA re-enroll if human
- Check for persistence (additional sessions, MFA devices added)
- Assess what the attacker saw / did

### Ransomware on infrastructure
- Isolate immediately (network segment, shutdown if needed)
- Do NOT pay (company policy + often legally restricted)
- Restore from immutable backups
- Forensics to determine initial access + scope
- Regulatory + customer notification
- External counsel + cyber insurance engaged early

### Insider threat (malicious)
- HR + Legal involved early
- Access revocation coordinated with termination if applicable
- Evidence preservation critical (possible criminal case)
- Investigation separate from normal incident flow (more discretion)

### Data exfiltration via API
- Disable compromised API keys
- Block source IPs
- Analyze access logs for scope (what queries / how much data)
- Affected tenants identified + notified
- Rate limits + anomaly detection strengthened

### Supply chain (compromised dependency)
- Pin to safe version / remove dep
- Rebuild all images
- Assess exposure window
- Review what the compromised code had access to (often container network = more)
- Customer notification if exploit used on prod

### SSO IdP outage / compromise
- Switch to secondary SSO path (break-glass credentials)
- Work with IdP vendor
- Force re-authentication after recovery
- Consider whether our session tokens were signed with compromised keys; rotate JWT signing key if so

### Physical theft of employee device
- Remote wipe (MDM)
- Revoke device trust (SSO)
- Assess what data was on device
- File police report (for warranty + paper trail)
- Issue replacement

### Subpoena / lawful request for customer data
- Legal handles exclusively
- Don't comply without legal review (may be overbroad or require narrowing)
- Notify affected customer unless gag order
- Log request in transparency report (Phase 3+)

---

## 15. Tabletops + Drills

Practice monthly (Security team) + quarterly (broader). Scenarios:
- Classic data breach
- Ransomware
- Insider exfiltration
- IdP compromise
- Zero-day in a critical dep
- Whistleblower complaint triggering regulatory inquiry
- Subpoena
- Data-center outage + ransom demand
- Supply-chain (compromised CI)

Each run:
- Measure response time
- Identify runbook gaps
- Update templates + runbooks
- Share summary (internal)

Annual live drill: actual chaos-engineered scenario in staging, full response exercised. ~4 hours.

---

## 16. Insurance Claim Process

For incidents with material cost:
1. Notify insurance broker within hours of declaration (most policies require prompt notice)
2. Engage outside counsel (insurance often covers)
3. Forensics firm engaged (insurance typically covers)
4. Document all expenses (breach notification costs, monitoring credits, legal fees)
5. File claim with supporting documentation
6. Coordinate with underwriter

Cyber insurance is not a replacement for controls — but reduces financial blowup from incidents.

---

## 17. Program Metrics

- Mean time to detect (MTTD) — target varies by severity; Critical < 30 min ideal
- Mean time to contain (MTTC) — target < 1h for SEC-P1
- Mean time to recover (MTTR) — target < 24h for SEC-P1
- Incident volume by severity trends
- Training completion
- Tabletop scenario completion rate
- Action items from PIRs closed on-time

Reviewed with Security Steering Committee quarterly.

---

## 18. Special Cases

### When the incident IS us (we're compromised, attacker's internal)
- Higher IC privilege / secrecy during investigation
- Minimal Slack / internal chatter (attacker may be watching)
- Use out-of-band comms (phone, in-person for sensitive)
- HR + Legal + CEO in tight loop
- Consider law enforcement (if insider criminal)

### When the incident is at a vendor
- Our response depends on blast radius
- Request vendor's incident details
- Own comms to our customers if their data potentially affected
- Review vendor relationship post-incident (may result in offboarding)

### When the incident is at a customer's side (their compromise)
- Assist if asked
- Check if our systems were leveraged (credential stuffing, etc.)
- Document as a related incident (own) if any impact to us
- Offer security review / lessons afterward

---

## 19. What We Don't Do

- **Cover up** — transparency wins long-term; cover-ups always surface
- **Blame first** — postmortems are blameless; accountability is about systems
- **"Wait and see"** on customer notification when in doubt — notify per policy
- **Speculate on attribution** publicly — attribution is hard + often wrong
- **Negotiate with attackers / pay ransoms** — policy decision, approved by CEO + Board
- **Silence researchers** — respect VDP; engage constructively
- **Skip tabletop drills** ("too busy") — exactly when drills matter

---

## 20. Related Documents

- [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) — program context
- [`VULNERABILITY-MANAGEMENT.md`](VULNERABILITY-MANAGEMENT.md) — when a vuln becomes an incident
- [`PRIVACY.md`](PRIVACY.md) — GDPR breach notification rules
- [`HIPAA.md`](HIPAA.md) — HIPAA breach rules
- [`../devops/RUNBOOKS.md`](../devops/RUNBOOKS.md) — ops-incident process (shares some mechanics)
- [`../devops/DISASTER-RECOVERY.md`](../devops/DISASTER-RECOVERY.md) — recovery mechanics
- `implementation/runbooks/security-incident.md` — step-by-step
- `implementation/runbooks/breach-notification.md` — notification drafting
- `implementation/runbooks/subpoena-lawful-request.md` — legal process handling
