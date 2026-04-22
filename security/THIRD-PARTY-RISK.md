# Third-Party Risk Management

> Every vendor extends our trust surface. We vet them before onboarding, track them continuously, and terminate them with discipline. The subprocessor list is public; the due-diligence binder is under NDA.

---

## 1. Why This Matters

An AIMS customer's data flows through:
- AIMS itself
- AWS (hosting)
- Stripe (billing)
- SendGrid / Amazon SES (email)
- Okta / Better Auth (identity)
- Sentry (errors)
- Datadog / Grafana Cloud (observability)
- ...and more

Each is a sub-processor of customer data. A breach at any of them can become our customers' problem — and therefore our problem. GDPR, HIPAA, SOC 2, and most customer contracts require us to:
- Vet sub-processors before use
- Maintain a current list (often publicly disclosed)
- Flow down contractual protections
- Notify customers of material changes
- Terminate relationships that no longer meet standards

This program operationalizes those obligations.

---

## 2. Vendor Taxonomy

| Tier | Definition | Examples |
|------|-----------|----------|
| **Tier 1 — Critical** | Processes customer data OR is critical to availability | AWS, PostgreSQL hosting, Okta, Stripe, SendGrid |
| **Tier 2 — Significant** | Processes internal/confidential data OR is important but not critical | Sentry, Datadog, GitHub, Slack |
| **Tier 3 — Standard** | Business tools with no customer data | Google Workspace, Notion, Zoom, Calendly |
| **Tier 4 — Minimal** | Marketing, research, free tools | Analytics trackers (if any), design tools |

Tier drives depth of review + ongoing oversight.

---

## 3. Vendor Categories (Regulatory)

| Category | Regulatory implication |
|----------|------------------------|
| **Subprocessor** | Processes customer personal data on our behalf — must be disclosed per GDPR Art. 28, customer opt-out rights, BAA if PHI |
| **Service provider** | Processes data for us (e.g., payroll) — data-minimization + own obligations |
| **Data recipient** | Receives data from us (e.g., analytics) — need legal basis; often prohibited for confidential |
| **Infrastructure** | Our platform depends on them — availability matters; often also subprocessor |

Legal + DPO classify each vendor; drives documentation requirements.

---

## 4. Onboarding Process

A new vendor can't be used until fully onboarded. Steps:

### 1. Business case
Sponsor (engineer / manager) opens onboarding ticket:
- What problem does this solve?
- Alternatives considered
- Data that would flow to/from vendor
- Estimated cost
- Tier estimate

### 2. Vendor questionnaire
Vendor completes our security questionnaire (similar to what customers ask us):
- SOC 2 / ISO 27001 / other attestations (provide reports)
- Security program overview
- Data handling + encryption
- Access controls
- Incident response track record
- Sub-processors (their vendors)
- Data location + residency options
- Deletion + retention policies
- Breach notification terms
- Business continuity

For **Tier 3/4**, a shorter questionnaire suffices.
For **Tier 1**, full review + sometimes follow-up interviews.

### 3. Legal review
- DPA (Data Processing Agreement) signed — required if any customer personal data involved
- SCCs (Standard Contractual Clauses) for EU data flows to non-adequate jurisdictions
- BAA (Business Associate Agreement) if PHI — HIPAA required
- Service agreement reviewed for liability caps, indemnification, termination rights
- Export controls check (US: no vendors sanctioned by OFAC)

### 4. Security review
CISO or Security team evaluates:
- Is their security posture commensurate with our classification?
- Are their SOC 2 / ISO certs current + scope appropriate?
- Any recent breaches or red flags?
- Any sub-processors we have concerns about?
- Can we enforce our requirements contractually?

### 5. Risk acceptance
- Tier 1: CISO + VP Eng + Legal sign-off
- Tier 2: CISO + sponsor's director
- Tier 3: Security Team + sponsor's manager
- Tier 4: Security Team or sponsor (with checklist)

### 6. Configuration + integration
- Least-privilege credentials
- SSO integration if human access
- MFA enforced
- IP allowlisting if supported
- Audit logs connected to our SIEM (Phase 3+)
- Data minimization (share least necessary)
- Data Processing Agreement executed + filed

### 7. Subprocessor list update
If customer data flows to vendor:
- Added to public list: `trust.aims.io/subprocessors`
- Email notice to customers with opt-in notification
- 30-day objection window honored per GDPR Art. 28

### 8. Onboarding complete
Added to vendor register with all docs attached.

---

## 5. The Vendor Register

Living document (Drata / Vanta / Linear). Fields per vendor:

- **Name**, category, tier
- **Primary contact** on our side
- **Vendor contact**
- **Data shared** (classification + types)
- **Data location** (regions)
- **Attestations on file** (SOC 2, ISO 27001, dates)
- **Contract** (start, renewal, termination terms, DPA, BAA if applicable)
- **Annual spend**
- **Last review date**
- **Next review date**
- **Risk score** (L/M/H based on tier + data sensitivity + their posture)
- **Status** (active, deprecating, terminated)

Reviewed quarterly for Tier 1; annually for Tier 2/3; every 2 years for Tier 4.

---

## 6. Continuous Monitoring

Beyond annual reviews:

### News monitoring
- Breach news feeds, newsletters (Risky Biz, Security Week), watch for our vendors
- Google Alerts on vendor names
- Vendor's own security advisories subscribed

### Automated
- Attack-surface monitoring for vendor domains (if relevant)
- CVE monitoring for vendor-provided agents we run (uncommon)
- SOC 2 / ISO cert expiry tracked — reminders 60 days prior

### Incidents involving vendors
- Vendor notifies us → our incident tracked
- Or: we discover breach affecting our data → vendor confronted + managed per IR
- Vendor's response quality informs future assessment

### Annual re-attestation
- Vendor confirms still in compliance with our requirements
- New SOC 2 / ISO report reviewed (they should renew annually)
- Any changes to their subprocessors reviewed

---

## 7. Offboarding

### When we offboard a vendor
- Replacing with another vendor
- Vendor's posture deteriorated
- Cost no longer justified
- Breached + we lost confidence
- Sub-processor they added we don't accept

### Process
1. **Plan**: data to extract / migrate
2. **Migrate**: new vendor or internal
3. **Extract**: all our data out of vendor's systems
4. **Revoke**: all access (our → theirs, theirs → ours)
5. **Rotate**: credentials, keys they may have had
6. **Delete**: vendor deletes our data + certifies
7. **Update**: vendor register, subprocessor list, customer notifications
8. **Audit**: evidence of deletion retained

Data deletion certificate required from vendor; kept in compliance evidence.

### Customer notification (for subprocessor termination)
- Updated subprocessor list published
- Opt-in customers notified
- If replaced by another vendor, note that too

---

## 8. Sub-Processor List (Public)

Published at `trust.aims.io/subprocessors`. Required by GDPR Art. 28 (and customer contracts).

### Content
For each sub-processor:
- Legal name
- Service (what they do for us)
- Data type (what customer data they process — in general categories)
- Location (country / region)
- Added date

### Governance
- Updated BEFORE new vendor processes customer data (not retroactively)
- Customers receive notice via email + in-app banner
- 30-day objection window (per GDPR Art. 28(2))
- If customer objects, we work with them; may require contract amendment or termination if essential

### Example (illustrative)

| Vendor | Purpose | Data | Location |
|--------|---------|------|----------|
| Amazon Web Services | Cloud infrastructure hosting | All customer data | US (primary), EU (EU tenants) |
| Stripe | Payment processing | Billing contact, payment method | US, EU |
| Okta | Identity + MFA | User identity, authentication events | US, EU (EU tenants) |
| SendGrid | Transactional email | Email address, email content for notifications | US |
| Sentry | Error monitoring | Error details (redacted; no PII) | US |

Full list maintained on Trust Center.

---

## 9. Data Processing Agreement (DPA)

Signed with every vendor processing customer personal data.

### Minimum DPA clauses (per GDPR Art. 28)
- Subject matter + duration of processing
- Nature + purpose of processing
- Type of personal data
- Categories of data subjects
- Vendor's obligations + rights
- Processing only on our instructions
- Confidentiality of personnel
- Security measures (Art. 32)
- Engagement of sub-sub-processors only with our authorization
- Assistance with data subject requests
- Assistance with security + breach notifications
- Return or deletion of data at end
- Audit rights for us

Template in `implementation/templates/dpa-template.md`.

### SCCs for international transfers
EU → non-adequate jurisdiction (e.g., US): Standard Contractual Clauses attached to DPA. 2021 new SCCs (Decision 2021/914) used.

### Amendments + updates
- Annual review of DPAs
- Regulatory changes trigger updates (e.g., Schrems II, DPF, new SCCs)

---

## 10. BAA — Business Associate Agreement (HIPAA)

For vendors with access to PHI — only relevant once we have HIPAA customers (Phase 5).

### Required by HIPAA §164.504(e)
- Permitted uses + disclosures
- Safeguards (administrative, physical, technical)
- Reporting of unauthorized uses
- Ensuring sub-sub-processors sign BAAs
- Return/destroy PHI at termination
- Subject to audit

Most major vendors offer BAA-ready versions (AWS, Stripe, SendGrid on specific plans). Enabling HIPAA-eligibility on our AWS account is part of Phase 5 prep.

---

## 11. SaaS Sprawl Control

New tools proliferate without governance. Risks:
- Unvetted vendors handling confidential data
- Shadow IT (individuals signing up without approval)
- Orphaned accounts (people leaving with active SaaS access)

### Controls
- **Approved SaaS list** — published internally; anything not on it requires onboarding process
- **SSO-required** — all approved SaaS must integrate with SSO (Okta)
- **Expense policy** — no credit card for unapproved SaaS; expense rejected
- **Annual SaaS audit** — compare what's approved vs what's billed; prune
- **Slack/email scanning** (Phase 3+) — surface "new tool" mentions for proactive onboarding

### Requesting a new tool
Short-circuit process for low-risk (Tier 3/4):
- Sponsor files a 1-page request
- Security reviews within 5 business days
- Approval or rejection with rationale

For Tier 1/2: full process as above.

---

## 12. AI / LLM Vendors (Special Consideration)

LLM/AI vendors pose specific risks:
- Training on customer data (data leakage)
- Retention beyond operational need
- Sub-processor complexity (model providers + hosting)
- Novel regulatory landscape

### Controls
- **No customer data to untrusted LLMs** — period
- **Approved LLM vendors only**: those with clear "not trained on your data" contracts
- **Data residency** confirmed (EU LLM for EU customers, etc.)
- **Prompt engineering reviewed** — strip PII before sending where feasible
- **Audit trail** — every LLM call logged (tenant, user, prompt summary, response; not content-for-content unless consented)
- **Opt-in at tenant level** — some tenants may prohibit LLM use entirely

### Evaluation criteria
- Does the vendor train on submitted data? (required: no, for our use)
- Data retention beyond request cycle? (required: no, or short window)
- Sub-processors disclosed?
- Data location?
- Token budget + rate limit in their contract?
- Fallback if their API is down (criticality)?

Phase 2+: Add LLM vendors per customer demand / internal productivity.

---

## 13. Vendor Incidents

### When vendor has an incident
1. They (should) notify us per contract (commonly 72h; tighter for breaches)
2. We assess our exposure
3. If customer data potentially affected: our IR process triggers
4. Customer notification per our policies (regardless of vendor's stance)

### Evaluating vendor incidents
Not every vendor incident affects us. Questions:
- Did the incident touch data categories we send them?
- Was the vulnerability in a service we use?
- Is our data in a tenant/account affected?

Quick analysis reduces false-alarm customer notifications.

### Post-incident vendor review
- Did their response match their contract?
- Did they over/under communicate?
- Did their security posture prove adequate?
- Consequences: continue, contractual remediation, replace

---

## 14. Open Source Dependencies

Handled at `engineering/CODE-STANDARDS.md §13-14` (vetting new deps). Program-level oversight:

- Inventory: SBOM generated per build (see `devops/CI-CD.md §10`)
- License compliance
- CVE monitoring
- Abandoned packages flagged (no commit in 12 months + critical use)
- Fork if we must maintain a dropped package

Deps are not exactly "vendors" but carry similar risk. Treat critical deps with vendor-like governance.

---

## 15. Contractor + Consultant Access

Not "vendors" in the SaaS sense, but similar risk:

### Onboarding
- Same AUP signed as employees
- Limited-time access
- Scoped credentials (not full employee access)
- SSO if possible
- Managed device OR limited scope
- Background check if access to prod / Confidential+

### Off-boarding
- Access revoked on contract end date (automated via HR)
- Final audit
- Feedback on security posture / issues noticed

Specific contracts for large contractors (e.g., managed service providers) include DPA-equivalent terms.

---

## 16. Metrics

- Total vendors in register
- % vendors with current attestations (target 100%)
- % DPAs current (target 100%)
- Vendor onboarding lead time (target < 10 business days for Tier 2/3)
- Vendor reviews completed on schedule
- Vendor incidents involving our data (target 0)
- Shadow IT discovered + onboarded / terminated

Reported monthly; steering committee quarterly.

---

## 17. Customer Questions About Our Subprocessors

During a sale or renewal, enterprise customers frequently ask:
- Can we review your subprocessor list?
- Can we opt out of specific subprocessors?
- Can we be notified before new subprocessor added?
- Where is our data physically stored?
- What are the data transfer mechanisms (SCCs, DPF, etc.)?
- What happens if a subprocessor has a breach?

Prepared responses in `implementation/templates/security-questionnaire.md`. CS team empowered to answer from templates; Legal for contract-specific nuance.

---

## 18. What We Don't Do

- **Skip vetting because "everyone uses them"** — everyone using AWS doesn't mean we skip configuring it securely
- **Tolerate vendors with stale SOC 2** — lapsed certs = renegotiate or terminate
- **Take verbal promises as compliance evidence** — contracts + reports or it didn't happen
- **Let sales close without Legal review** of DPAs
- **Allow shadow IT** — expensed = caught
- **Ignore sub-sub-processors** — our customers care about full chain

---

## 19. Related Documents

- [`SECURITY-PROGRAM.md`](SECURITY-PROGRAM.md) — vendor oversight in program
- [`PRIVACY.md`](PRIVACY.md) — GDPR Art. 28 specifics
- [`HIPAA.md`](HIPAA.md) — BAA requirements
- [`DATA-CLASSIFICATION.md`](DATA-CLASSIFICATION.md) — what data vendors can touch
- [`TRUST-CENTER.md`](TRUST-CENTER.md) — public subprocessor list
- `implementation/templates/dpa-template.md` — DPA template
- `implementation/templates/security-questionnaire.md` — our responses
- `implementation/templates/subprocessor-agreement.md` — internal vendor agreement
