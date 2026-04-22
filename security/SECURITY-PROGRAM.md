# Security Program

> Governance, organizational structure, security training, risk management, and operating cadence. The security "how we run as a company" document. Distinct from code-level security ( `engineering/SECURITY-TESTING.md`) and auth-specific ( `auth/SECURITY.md`).

---

## 1. Program Purpose

A security program is the set of policies, people, processes, and tools that together:
- Protect customer data + our own intellectual property
- Enable enterprise + regulated-sector sales
- Satisfy compliance obligations (SOC 2, ISO 27001, GDPR, etc.)
- Build customer + partner trust
- Minimize loss from incidents

Without a formal program, security is ad-hoc — it works until it doesn't.

---

## 2. Organizational Structure

### CISO (Chief Information Security Officer)

**Phase 1 (current)**: VP Engineering wears the CISO hat.
**Phase 3 (post-SOC 2 Type II)**: Dedicated CISO hire or fractional CISO (part-time from advisory firm).
**Phase 5+**: Full CISO reports to CEO; security team of 3–5.

### Responsibilities
- Own the security program; propose budget; report to CEO + Board
- Final approval on high-risk decisions (new major vendor, significant CVE triage)
- Ratify policies + annual review
- Chair Security Steering Committee
- Manage security team (as it grows)
- Customer-facing for escalations (security reviews, incident comms with enterprise customers)
- Regulatory-facing (breach notifications, inquiries)

### Security Team Structure (by phase)

```
Phase 1 (pre-GA):      1 part-time (CISO hat on VP Eng)
Phase 2 (SOC 2 Type I): 1 FTE (Security Engineer)
Phase 3 (SOC 2 Type II):2 FTE — Security Engineer + Compliance Analyst
Phase 4 (ISO 27001):   3 FTE — + AppSec Engineer
Phase 5 (HIPAA):       4 FTE — + Privacy Engineer / Technical DPO
Phase 6 (FedRAMP):     6+ FTE — + GovCloud specialist(s), 3PAO liaison
```

### Distributed Security (Champions)
See `engineering/SECURITY-TESTING.md §14`. Every engineering team has a rotating Security Champion:
- Attends weekly AppSec sync
- Ambassadors security practices to team
- First-line triage for team's findings
- Rotates annually; growth opportunity

Keeps security distributed + lightweight — AppSec team doesn't become a bottleneck.

### Security Steering Committee
Quarterly meeting. Attendees:
- CISO (chair)
- CEO
- CTO / VP Engineering
- Head of Legal
- Head of Operations
- Customer Success representative
- External advisor (optional — e.g., fractional CISO firm)

Reviews: quarterly risk register, major incidents, compliance roadmap, budget, customer security feedback trends.

### RACI (summary)

| Activity | Responsible | Accountable | Consulted | Informed |
|----------|-------------|-------------|-----------|----------|
| Security policy authoring | Security team | CISO | Legal, Engineering leads | All employees |
| Policy approval | CISO | CEO | Legal, Board (major) | All |
| Incident response (technical) | Incident Commander | CISO | Engineering, Legal | Customers, staff |
| Incident comms (external) | Comms Lead + Legal | CISO | CEO, Customer Success | Customers, regulators |
| Customer security reviews | Security + CS | CISO | Legal | Sales |
| Vendor risk assessment | Security | CISO | Procurement, Legal | Sponsor team |
| Training program | Security + HR | CISO | Engineering leads | All employees |
| Audit prep (SOC 2, ISO) | Compliance Analyst | CISO | All heads-of | Leadership |
| Regulatory notifications | Legal (drafts) | DPO / CISO | External counsel | Board |
| Risk register maintenance | Security | CISO | Engineering leads | Steering Committee |

Full RACI per activity lives in `implementation/policies/information-security.md`.

---

## 3. Security Policy Catalog

See [`POLICIES.md`](POLICIES.md) for full catalog. Summary:

| Policy | Required by |
|--------|------------|
| Information Security (master) | SOC 2, ISO 27001, HIPAA |
| Acceptable Use (AUP) | SOC 2, ISO 27001 |
| Access Control | SOC 2, ISO 27001 |
| Data Classification + Handling | SOC 2, ISO 27001, HIPAA, GDPR |
| Data Retention + Deletion | GDPR, CCPA, HIPAA |
| Encryption | SOC 2, ISO 27001, HIPAA |
| Password / Authentication | SOC 2, ISO 27001 |
| Remote Work / BYOD | ISO 27001 |
| Asset Management | SOC 2, ISO 27001 |
| Change Management | SOC 2 |
| Vulnerability Management | SOC 2, ISO 27001 |
| Incident Response | SOC 2, ISO 27001, HIPAA, GDPR |
| Business Continuity / DR | SOC 2, ISO 27001 |
| Vendor / Third-Party | SOC 2, ISO 27001, GDPR (subprocessor list) |
| Privacy / Data Protection | GDPR, CCPA, state laws |
| Employee Onboarding + Offboarding | SOC 2, ISO 27001 |
| Clean Desk / Screen Lock | ISO 27001 |
| Physical Security (office) | ISO 27001 (remote-first: minimal) |
| Training + Awareness | SOC 2, ISO 27001 |

All stored in `implementation/policies/`. Version-controlled. Reviewed annually or on material change.

---

## 4. Policy Lifecycle

### Creation
1. CISO or Security drafts policy
2. Consulted: Legal (compliance), Engineering leads (feasibility), HR (if affects employees)
3. Reviewed by Security Steering Committee
4. Approved by CISO (signed + dated)
5. Published internally (Notion + implementation/policies/ in repo)
6. Announced to staff; training if significant

### Annual Review
Every policy carries an annual review date. On that date:
- Owner confirms still accurate
- Incorporates changes from the past year
- Re-approves or revises
- Policy expires if not reviewed within 6 months of annual date (triggers urgent review)

### Ad-Hoc Update
Triggers:
- Regulatory change (e.g., new US state privacy law)
- Incident that revealed a gap
- Customer contractual requirement
- Tool or architecture change

Process: same as creation, expedited if critical.

---

## 5. Security Training

### Annual (all employees)
Delivered via platform like KnowBe4 or Hoxhunt. Modules:
- Security awareness basics (phishing, social engineering, password hygiene)
- Data classification + handling
- Incident reporting (how + when)
- Acceptable use policy
- Privacy (GDPR, CCPA basics)
- Customer data handling

Completion tracked. Non-completion → HR escalation; ultimately termination as last resort.

### Role-specific training
| Role | Additional training |
|------|---------------------|
| Engineers | Secure coding (OWASP), framework-specific security (React/Node), threat modeling basics — quarterly |
| Security Champions | AppSec fundamentals, pen test basics, incident response tabletop — annual |
| Customer Support | Social engineering resistance, data access policies, escalation paths — quarterly |
| Sales + CS | Customer data handling, DPA basics, what we can/can't say — semi-annual |
| HR + Finance | Wire fraud, BEC (Business Email Compromise) — quarterly reminders |
| Leadership | Incident response, regulatory responsibilities — annual |

### Phishing simulations
- Monthly (rotating themes: CEO fraud, invoice, credential harvesting, MFA bypass, device enrollment)
- Results tracked per-person (coaching, not punishment)
- Users clicking → assigned 5-minute refresher
- Repeat clickers → one-on-one with manager

### Tabletop exercises
- Monthly for Security team (1 hour)
- Quarterly for broader Engineering (90 min)
- Annual for Leadership (half-day)
- Scenarios: ransomware, data exfiltration by insider, SSO provider outage, customer breach, regulatory inquiry, supply chain attack

Findings + action items tracked; run same scenario 12 months later — did we improve?

### Onboarding
- Day 1: AUP signed, equipment issued, SSO enrolled, MFA set up
- Day 2–5: Complete initial security training (2 hours)
- Day 7: Access granted per role (principle of least privilege)
- Day 30: Manager confirms training completion
- Day 90: Review: are permissions still correct?

### Offboarding
- Last day (or earlier if adversarial): all access revoked atomically (SSO disables → cascades)
- Devices returned / remotely wiped
- Personal email / phone removed from emergency contacts
- Pending MFA devices deauthorized
- Any sensitive files delegated to manager
- Exit interview captures any security feedback
- 30-day audit log monitoring for exfiltration indicators

---

## 6. Risk Management

### Risk Framework
Based on **NIST Risk Management Framework** (simplified) or **ISO 31000** (for ISO 27001 alignment). We use ISO-aligned.

### Risk Register
Lives in `implementation/templates/risk-register.md` (template) + Linear / spreadsheet for actual register. Fields:
- **ID**: RISK-NNNN
- **Description**: What could go wrong
- **Threat source**: external attacker, insider, system failure, 3rd party, regulatory
- **Likelihood**: 1–5 (1 rare; 5 almost certain)
- **Impact**: 1–5 (1 trivial; 5 existential)
- **Inherent risk score**: L × I
- **Existing controls**: what we already have
- **Residual risk score**: L × I after controls
- **Treatment**: Accept / Mitigate / Transfer / Avoid
- **Owner**: who's on the hook
- **Next review**: date
- **Status**: Open / In progress / Accepted / Closed

### Risk Appetite
Approved by CEO + Board. Examples (illustrative):
- Critical residual risk (≥ 20): not acceptable; must reduce
- High (15–19): escalation required; explicit Steering Committee sign-off
- Medium (8–14): accepted with mitigation plan + quarterly review
- Low (≤ 7): accepted; annual review

### Risk Assessment Cadence
- **Continuous**: new risks added when identified (incident post-mortems, threat intel, new deps, customer asks)
- **Quarterly**: full register review by Security team
- **Annually**: top-level review by Steering Committee; aligned with compliance audit

### Common Risk Categories (illustrative — not exhaustive)
- Unauthorized access to customer data (tenant isolation failure)
- Data loss (backup failure + outage)
- Insider threat (malicious or negligent employee)
- Third-party compromise (SaaS vendor breach)
- Ransomware / destructive attack
- Phishing leading to credential theft
- Supply chain (malicious dep, image tampering)
- Regulatory noncompliance (GDPR fine, data residency violation)
- DDoS / availability attack
- Physical (office break-in — minimal for remote-first)
- Reputational (public incident disclosure damage)

### Threat Modeling
See `engineering/SECURITY-TESTING.md §15` and `auth/SECURITY.md` for STRIDE-level technical threat modeling. Program-level threat modeling is broader (includes non-technical, organizational, and regulatory threats) and feeds the risk register.

---

## 7. Security Metrics (KPIs)

Tracked monthly; reported to Steering Committee quarterly; presented to Board annually.

| Metric | Target | Source |
|--------|--------|--------|
| Mean time to triage SAST finding | < 2 business days | CI + ticket system |
| Mean time to remediate Critical CVE | < 48 h | SCA + tickets |
| Mean time to remediate High CVE | < 7 days | SCA + tickets |
| Unpatched High+ CVEs older than SLA | 0 | Compliance dashboard |
| % staff completed annual training | 100% | HR system |
| Phishing simulation click rate | < 5% | Simulation platform |
| Phishing simulation repeat-click rate | 0% | Simulation platform |
| MFA enrollment | 100% | SSO |
| Incidents (P1/P2) per quarter | Trending down | IR tracker |
| Time to detect incident (MTTD) | < 30 min (target; varies) | SIEM + alerts |
| Time to contain incident (MTTC) | < 1 h for P1 | IR records |
| Third-party risk assessments current | 100% of active vendors | Vendor register |
| Audit findings (SOC 2, ISO) | Trending down YoY | Audit reports |
| Bug bounty payouts / critical findings | Tracked | (Phase 3+) |

Dashboards in Grafana or BI tool; exported to board slide deck quarterly.

---

## 8. Budget

Rough allocations (Phase 2, illustrative — adapts):

| Category | % of security budget | Notes |
|----------|---------------------|-------|
| Personnel (salaries + benefits) | 50% | Security team + fractional CISO |
| Tools + SaaS | 20% | Drata/Vanta, Snyk, Semgrep, SSO, Okta, etc. |
| External services | 15% | Pen tests, legal, audit firms |
| Training + awareness | 5% | KnowBe4, conferences, certifications |
| Incident reserve | 5% | Set aside for surprise costs (forensics, legal) |
| Bug bounty (Phase 3+) | 5% | Payouts + platform fee |

Budget grows as compliance scope grows. ISO 27001 certification alone adds ~$100k year 1 (auditor + tooling + staff time); maintenance ~$40k/year.

---

## 9. Operating Cadence

### Daily
- Security team reviews alerts (SIEM, Sentry, GuardDuty, CSPM)
- On-call rotation for security P1/P2

### Weekly
- AppSec sync (champions + security team)
- Vulnerability triage (new CVEs from SCA)
- Incident retrospectives (if any)

### Monthly
- Phishing simulation
- Tabletop exercise (security team)
- Policy exception review
- Vendor risk re-evaluation (subset)
- Security metrics snapshot

### Quarterly
- Full risk register review
- Steering Committee meeting
- Tabletop exercise (broader engineering)
- Vendor inventory + re-assessment (all active)
- Training completion audit
- Red team scenario (Phase 3+)

### Semi-annually
- Pen test (if major release)
- Access review (who has access to what; revoke stale)
- Policy mini-review (significant changes)

### Annually
- Full pen test (external firm)
- Red team exercise
- Policy full review (all policies)
- DR drill (live failover)
- Security training refresh (all staff)
- Audit cycle (SOC 2 / ISO 27001 depending on phase)
- Board-level security briefing
- Budget review

### As Needed
- Incident response
- Customer security review (per sale, high-touch)
- Regulatory inquiry response
- New vendor onboarding

---

## 10. Security in the SDLC

See `engineering/` folder for engineering standards. Program-level integration:

### Design phase
- Threat modeling required for new trust boundaries
- Security champion consulted on architecture ADRs

### Development phase
- SAST / SCA / secrets scan on every PR (see `devops/CI-CD.md`)
- Security training awareness shows in code review
- Reference secure coding patterns (`engineering/CODE-STANDARDS.md`)

### Testing phase
- Security test cases in test plans
- DAST / pen test before major release

### Deployment phase
- Security review of Terraform / infra changes
- Signed artifacts (Cosign) required

### Operations phase
- Continuous monitoring
- Incident response ready
- Runbooks tested

Security is not a gate at the end; it's present throughout.

---

## 11. Communication Channels

### Internal
- `#security` Slack — general security discussion, questions
- `#security-alerts` — automated alerts (SIEM, SCA, etc.)
- `#appsec` — engineering security champions
- `#incident-<id>` — per-incident channel (auto-created)
- Security newsletter (monthly) — trends, reminders, recognition

### External
- `security@aims.io` — vulnerability disclosure, customer questions
- `privacy@aims.io` — privacy requests (GDPR access/delete, etc.)
- `dpo@aims.io` — Data Protection Officer (Phase 2+)
- `security.txt` at `aims.io/.well-known/security.txt`
- Trust center: `trust.aims.io`
- Status page: `status.aims.io`

### With customers
- Security questionnaires (CAIQ, SIG-lite)
- SOC 2 / ISO 27001 reports (under NDA)
- Pen test summary (under NDA)
- Incident notifications (per contract)

---

## 12. Insurance

### Cyber liability policy
- Phase 2+: recommended
- Covers: breach costs (forensics, notification, credit monitoring, legal, regulatory fines where insurable)
- Amount: $5–10M starting; grows with revenue + customer sensitivity
- Annual renewal with actuarial review

### Director + Officer (D+O) coverage
- Protects leadership from personal liability
- Includes cyber-related incidents

### Not insurance for:
- Willful misconduct
- Non-compliance discovered pre-policy
- Fines / penalties in some jurisdictions

Insurance is risk transfer — supplements controls, doesn't replace them.

---

## 13. Scaling Considerations

### Signals to scale the security team / program
- Customer volume > 50 or any Fortune-500-class enterprise
- Regulated customer ask (healthcare BAA, federal government)
- Geographic expansion (EU, APAC)
- Product complexity (mobile app, public API, partner integrations)
- Incident frequency (>1 P1 per year suggests program gap)
- Audit finding volume (multiple repeat findings = systematic issue)
- Engineering team > 30 (champion model stretched)
- Compliance scope (each new framework = staffing need)

### Common mistakes
- Over-investing too early (building FedRAMP program before any federal customer)
- Under-investing too long (deferring SOC 2 until "we really need it")
- Tool sprawl (buy 10 tools, use 3)
- Zero process (security as "vibes") or too much process (can't ship)
- No dedicated owner (security as "everyone's job" = no one's job)

### Right-sized program at each phase
| Phase | Security state | Typical investment |
|-------|----------------|---------------------|
| Pre-GA | Written policies; basic training; SAST/SCA; founder-CISO | ~$50k/year incl. fractional CISO |
| Post-GA to Year 2 | Dedicated hire; SOC 2 Type I + II; monthly tabletops; first pen test | ~$300k/year |
| Year 2–4 | Team of 2–3; ISO 27001; bug bounty; red team; mature IR | ~$600k–$1M/year |
| Year 4+ | Team of 5+; FedRAMP possible; full compliance stack; CISO + reports | ~$1.5M+/year |

---

## 14. Executive + Board Reporting

### Quarterly board update (slides)
- Security posture overall (green/yellow/red)
- Major metrics trend
- Incidents: count, severity, root causes
- Risk register summary (top 5 risks)
- Compliance progress
- Budget + headcount
- Known issues + plan

### Annual deep-dive
- Full risk assessment
- Pen test executive summary
- Compliance achievements + next targets
- Budget ask for next year
- Strategic recommendations

Keeps Board informed — legal + fiduciary duty for public companies; good hygiene for private.

---

## 15. Security Culture

### What we aim for
- "If in doubt, ask" — no fear of reporting suspected issues
- Blameless postmortems
- Celebrate prevention (e.g., someone caught a phish, stopped a vendor with bad practices, proposed a better pattern)
- Security integrated into product / engineering discussions, not siloed
- Customers value our posture; we value their trust

### What we avoid
- Security theater (policies nobody reads)
- Fear-based compliance (scare tactics backfire)
- Blame culture ("you clicked the phish, you're bad")
- Perfection paralysis (nothing shipped because "not secure enough")
- Us-vs-engineering dynamics (Security as distinct from Engineering = failure mode)

### Measuring culture
- Anonymous survey quarterly ("do you feel safe reporting issues?")
- Reported-incident volume (higher reporting volume = better culture, not more problems)
- Voluntary training engagement beyond required
- Security champion retention

---

## 16. Related Documents

- [`POLICIES.md`](POLICIES.md) — policy catalog
- [`DATA-CLASSIFICATION.md`](DATA-CLASSIFICATION.md) — how we handle different data classes
- [`VULNERABILITY-MANAGEMENT.md`](VULNERABILITY-MANAGEMENT.md) — patch + CVE program
- [`INCIDENT-RESPONSE.md`](INCIDENT-RESPONSE.md) — security IR (distinct from ops)
- [`THIRD-PARTY-RISK.md`](THIRD-PARTY-RISK.md) — vendor management
- [`COMPLIANCE-FRAMEWORKS.md`](COMPLIANCE-FRAMEWORKS.md) — SOC 2 / ISO 27001 / FedRAMP landscape
- [`../engineering/SECURITY-TESTING.md`](../engineering/SECURITY-TESTING.md) — code-level security testing
- [`../auth/SECURITY.md`](../auth/SECURITY.md) — auth-specific STRIDE model
