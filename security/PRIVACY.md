# Privacy Program

> GDPR, UK GDPR, CCPA/CPRA, and the growing US state privacy patchwork. Our program applies GDPR-grade protections as the baseline for all customers, adapts where specific laws require more, and handles data subject requests (DSRs) within statutory windows.

---

## 1. Privacy Posture: GDPR-Grade For Everyone

### Decision
We apply **GDPR-grade handling to all personal data** — not just EU data.

### Why
- One standard is cheaper than maintaining N per-region regimes
- US privacy law is trending toward GDPR norms
- Enterprise customers increasingly demand it
- Easier to say "yes" to regulated customers
- Less risk of accidental noncompliance

### Implications
- All DSRs honored (access, deletion, portability) regardless of jurisdiction
- Privacy-by-default + by-design in product decisions
- Data minimization everywhere
- Legal basis logged + reviewable
- International transfer mechanisms in place for all flows

---

## 2. Legal Basis (GDPR Art. 6 — Lawfulness)

Each data-processing activity has a documented legal basis:

| Basis | When | Examples |
|-------|------|----------|
| **Contract** (Art. 6(1)(b)) | Needed to perform our service contract | Processing audit data for engagements |
| **Legitimate interest** (Art. 6(1)(f)) | Our interest balanced against data subject | Security monitoring, fraud detection |
| **Legal obligation** (Art. 6(1)(c)) | Required by law | Retention per SEC / FINRA rules |
| **Consent** (Art. 6(1)(a)) | Freely-given specific opt-in | Marketing emails (non-customer contacts) |
| **Vital interest** (Art. 6(1)(d)) | Life-threatening | Rare for us |
| **Public task** (Art. 6(1)(e)) | Public authority | Government audits (customer-specific) |

### Mapping in our ROPA
Record of Processing Activities (Art. 30) lists each activity + legal basis. Maintained by DPO; sample table in §7.

---

## 3. Roles: Controller vs Processor

### For customer data (their audit findings, files, user records)
- **Customer = Controller**
- **AIMS = Processor**
- We act on customer's documented instructions (DPA)
- Customer responsible for legal basis with their data subjects
- Our obligations: security, assistance with DSRs, breach notification, sub-processor terms

### For our own staff, sales contacts, billing
- **AIMS = Controller**
- We choose purposes + means
- We publish privacy notice explaining processing

This bifurcation matters. DPA reflects "processor" role; our public privacy notice reflects "controller" role for our direct processing.

---

## 4. Data Inventory (ROPA — Art. 30)

Mandatory for GDPR. Lists all processing activities.

### Each entry
- Name of activity (e.g., "Customer engagement data storage")
- Categories of data subjects (customer users, their auditors, etc.)
- Categories of data (name, email, finding content, etc.)
- Purpose
- Legal basis
- Recipients (subprocessors)
- International transfers (yes/no + mechanism)
- Retention period
- Security measures
- Controller / processor role

Maintained in Drata / Vanta or dedicated privacy tool (OneTrust, TrustArc).

### Sample activities (illustrative)

| Activity | Role | Data subjects | Purpose | Legal basis |
|----------|------|---------------|---------|-------------|
| Customer engagement data | Processor | Customer staff, auditees | Service delivery | Contract (with customer) |
| User account management | Processor | Customer staff | Authentication | Contract |
| Log data + monitoring | Processor | Customer staff | Security, debugging | Legitimate interest |
| Billing + invoicing | Controller | Customer billing contacts | Payment processing | Contract |
| Marketing emails | Controller | Marketing leads (opt-in) | Outreach | Consent |
| Employee data | Controller | Our staff | HR | Contract + legal obligation |
| Vendor data | Controller | Vendor contacts | Procurement | Legitimate interest |

---

## 5. Data Subject Rights

Under GDPR + many US state laws, data subjects can:

| Right | GDPR Art. | CCPA/CPRA | Our response |
|-------|-----------|-----------|--------------|
| Access / know | 15 | Access | Export provided within SLA |
| Rectification | 16 | Correction | Update in product or manual |
| Erasure / deletion | 17 | Delete | Hard-delete or crypto-erase |
| Restriction of processing | 18 | — | Stop processing; retain |
| Portability | 20 | — | Structured export (JSON, CSV) |
| Object | 21 | Opt-out | Cease specific processing |
| Automated decision-making | 22 | — | Not applicable (we don't) |
| Opt-out of sale / share | — | Opt-out sale | N/A — we don't sell |
| Limit use of sensitive PI | — | Limit | Via data classification |

### Response SLA
- **GDPR**: 30 days (extendable 2 months with justification)
- **CCPA**: 45 days (extendable 45 more with justification)
- **We target 20 business days** for all (stricter than both)

### DSR intake
- `privacy@aims.io` (monitored by DPO)
- In-product self-service (coming Phase 2)
- Customer admin can submit on behalf of their users

### Identity verification
Cannot comply blindly — must verify the requester is the data subject:
- For customer's users: verify via customer admin
- For our own contacts: verify via email + additional factor if needed
- Rejection if verification fails; logged

### Workflow
1. Intake received
2. Identity verified
3. Scope determined (what data + where)
4. Data gathered (export job or deletion prep)
5. Response sent (with data or confirmation of deletion)
6. Logged in DSR register (audit trail)

---

## 6. Privacy by Design + Default (Art. 25)

Baked into the SDLC:

### Design
- Every new feature goes through privacy review checklist
- Data-minimization question: what's the minimum we need?
- Legal basis confirmed before data collection
- Retention defined up front
- DPIA triggered if high-risk (§9 below)

### Defaults
- Settings protecting privacy are the default (e.g., anonymized analytics opt-in not opt-out)
- No "silent" collection
- Legitimate interest balanced + documented

### Privacy review checklist (for PRs affecting data)
- [ ] What PII is collected / processed?
- [ ] Legal basis identified?
- [ ] Data minimization applied?
- [ ] Retention defined?
- [ ] Subject rights handleable?
- [ ] International transfer mechanisms OK?
- [ ] Added to ROPA if new activity?
- [ ] DPIA needed?

Security reviewer checks; DPO spot-audits.

---

## 7. International Transfers

EU personal data flowing to non-adequate jurisdictions (most outside EU+EEA+UK+adequacy-decided countries) requires a transfer mechanism:

### Mechanisms we use
- **Standard Contractual Clauses** (SCCs) — 2021 "new SCCs" (Decision 2021/914)
- **EU–US Data Privacy Framework** (DPF) — 2023, current adequacy for certified US organizations
- **Binding Corporate Rules** (BCRs) — for intra-group transfers if large multinational (not us yet)
- **Derogations** (Art. 49) — narrow exceptions (consent, contract); rare

### Our flows
- AIMS EU → AIMS US (if tenant resides in EU but uses cross-region feature): handled within our own infrastructure under SCCs + TIA (Transfer Impact Assessment) + technical measures
- AIMS EU → US subprocessors (Stripe, Datadog): SCCs + DPF (where subprocessor is DPF-certified)
- AIMS US → EU: no issue (EU considered adequate)
- AIMS anywhere → non-adequate (China, Russia): **blocked by policy**

### Schrems II + TIA
Schrems II (CJEU, 2020) requires case-by-case transfer impact assessment considering:
- Whether data may be accessed by public authorities
- Legal regime of destination country
- Supplementary measures (encryption, pseudonymization)

We document TIA per flow as part of DPA with subprocessor.

### DPF certification
Subprocessors certified under DPF simplify compliance. We prefer DPF-certified US vendors where possible.

---

## 8. Subprocessor Management (Art. 28)

See `THIRD-PARTY-RISK.md §3-9`. Privacy-specific highlights:
- **Public list** at trust.aims.io/subprocessors (Art. 28(2))
- **Prior notification** for new subprocessors (30-day objection window)
- **DPA flow-down** — they sign equivalent DPA with us
- **Audit rights** preserved
- **Sub-sub-processors** approved by customer (via our list) or we manage

---

## 9. DPIA — Data Protection Impact Assessment (Art. 35)

Required when processing is high-risk. Triggers:
- Systematic + extensive profiling
- Large-scale processing of special categories (PHI, biometrics, genetic)
- Large-scale monitoring of public areas
- Automated decision-making with legal effect

### Our DPIAs
- Standard engagement data processing: typically **not** high-risk (customer's data, our processor role)
- Analytics / product telemetry: low-risk with pseudonymization
- Future AI features: likely high-risk → DPIA
- HIPAA / healthcare data: high-risk (PHI) → DPIA

### DPIA content
1. Systematic description of processing
2. Assessment of necessity + proportionality
3. Risks to data subjects
4. Measures to address risks

Published (sanitized) as part of trust center for major activities.

### Consultation
Regulators consulted if residual high risk after mitigation — rare.

---

## 10. Privacy Notices (Transparency — Art. 13, 14)

We publish:

### `aims.io/privacy` (customer-facing)
- For our direct data subjects (prospects, leads, staff applications)
- What we collect, why, how long, rights
- Subprocessors
- Contact (DPO, privacy email)
- Regulatory info (authority to complain)

### In-product notice
- First-time login: brief notice + link to privacy policy
- Cookie / tracking consent: cookie banner with granular choice
- When collecting specific data (e.g., file uploads): contextual notice

### For customer data
- DPA is the notice (customer is controller)
- Our role + obligations transparent

### Review + update
- Annual review
- Updates communicated (if material, email customers 30 days in advance)
- Version history kept

---

## 11. Cookie / Tracker Management

### On marketing site + app login
- Essential cookies (session, CSRF): no consent needed (strictly necessary)
- Analytics: consent required (opt-in; we use privacy-friendly analytics — Plausible or self-hosted Matomo)
- Marketing trackers: **none** (we do not track users across sites)
- Do Not Track header respected

### Consent management
- Cookie banner via consent management platform (OneTrust or similar)
- Preferences stored; respected across sessions
- Easy withdrawal

### Consent records
- Kept per user + preference
- Audit trail (when consented, to what, source)

---

## 12. Minor's Data

- We do not knowingly collect data from children under 16 (GDPR) / 13 (COPPA US)
- If notified, we delete
- Not targeted toward minors (B2B audit platform)

---

## 13. Marketing + Opt-In

- Marketing emails only to contacts who opted in
- Double opt-in preferred (click confirmation)
- Opt-out in every email
- Unsubscribe honored within hours
- B2B exception (Art. 6(1)(f) legitimate interest) used cautiously
- CAN-SPAM (US) compliance baseline

---

## 14. US State Privacy Landscape

Growing patchwork of state laws. Compliance strategy: **highest common denominator**.

### CCPA + CPRA (California)
- Applies at revenue / consumer / data thresholds
- Most comprehensive US law
- Right to know, delete, correct, opt-out of sale, limit use of sensitive
- "Do Not Sell or Share My Personal Information" link (we don't sell; still provide link)
- Annual metrics disclosure (requests received + handled)

### VCDPA (Virginia), CPA (Colorado), CTDPA (Connecticut), UCPA (Utah)
- Similar shape to CCPA but varying thresholds + nuances
- Rights: access, delete, correct, portability, opt-out (sale / targeted ads / profiling)
- Universal opt-out signals (Global Privacy Control) — we honor

### Newer states (2024+)
- Texas DPSA, Oregon CPA, Montana CDPA, Delaware PDPA, Iowa ICDPA, New Jersey, New Hampshire, Kentucky, Maryland, Rhode Island, Indiana, Tennessee...

Most follow CCPA-style patterns. Our GDPR-grade baseline + CCPA compliance satisfies most.

### Strategy
- Annual legal review of state laws + applicability to us
- Update privacy notices as laws evolve
- Universal handling process (doesn't matter which state; same process)

---

## 15. Data Retention + Deletion

### Default retention (overridable by contract)
- Customer data: 7 years after termination (or shorter per contract)
- Logs: 1 year hot, 7 years cold (compliance)
- Marketing contacts: until opt-out + 12 months
- Employee data: per employment law (typically 7 years post-employment)
- Vendor data: duration of relationship + 7 years

### Deletion at request
- DSR deletion: honored within SLA; retention exception only if legally required
- Customer offboarding: 30-day grace then crypto-erase
- Employee offboarding: retention per policy; access revoked immediately

### Legal holds
- Litigation hold overrides retention + deletion
- Tracked by Legal; specific records preserved
- Released when hold lifted

---

## 16. Privacy Breach vs Security Breach

Overlap but not identical:
- **Security breach**: unauthorized access / modification to systems or data
- **Privacy breach**: personal data affected; may be subset of security breach

### Privacy-specific obligations
- GDPR: supervisory authority within 72h if risk to data subjects
- GDPR: notify data subjects "without undue delay" if high risk
- State laws: varies (some 30 days, some "without unreasonable delay")

DPO + Legal involved early in any incident touching personal data. See `INCIDENT-RESPONSE.md §11`.

---

## 17. Data Protection Officer (DPO)

### When required
- GDPR: required if core activities involve large-scale systematic monitoring OR large-scale special category data
- We likely need DPO by Phase 4 (EU scale)

### Role
- Independent oversight of privacy compliance
- Point of contact for authorities
- Consulted on DPIAs
- Reports to top management
- Cannot be penalized for doing their job

### Options
- In-house (typical when team size justifies)
- External DPO (outside counsel with DPO service) — good for small / early

### Registration
- Most EU member states: DPO contact registered with supervisory authority
- Published to data subjects (e.g., in privacy notice)

Email: `dpo@aims.io` — monitored by DPO.

---

## 18. Transparency Reports (Phase 3+)

Annual report on:
- Number of DSRs received (by type)
- Percentage fulfilled within SLA
- Legal requests (subpoenas, warrants) — number + jurisdictions
- Data sharing with law enforcement (statistics, not details)

Publication signals commitment + builds trust. Precedent: Twitter, Google, Apple reports.

---

## 19. Privacy Engineering Practices

### Minimization
- Only collect what's necessary
- Periodically audit fields (do we still need X?)

### Pseudonymization
- Use IDs not names in logs
- Separate identifying data (name, email) from activity (finding content)

### Encryption
- See `DATA-CLASSIFICATION.md` + `devops/SECRETS.md`

### Access controls
- RLS + RBAC + ABAC: least privilege for personal data
- Audit log every access to personal data

### Retention tooling
- Expiry dates enforced technically (scheduled deletion)
- Not just policy

### Privacy testing
- DSR flow tested end-to-end
- Data inventory reconciliation quarterly (what's in ROPA vs what's actually in systems)

---

## 20. Common Privacy Pitfalls We Avoid

- **Collecting more than we need** — "maybe we'll use it later"
- **Storing longer than necessary** — silent accumulation
- **Pseudonymization ≠ anonymization** — different legal treatment
- **"Legitimate interest" for everything** — documented balancing test required
- **Silent changes to privacy notices** — notify material changes
- **Skipping DPIAs** to save time — regulatory penalty later
- **Over-reliance on consent** — consent can be withdrawn; other bases more durable
- **Confusing privacy + security** — separate but related
- **Treating HIPAA / sectoral as non-overlapping with GDPR** — they overlap; plan holistically

---

## 21. Privacy in Employee Lifecycle

- Pre-hire: minimum info for application; retained only short-term unless hired
- During employment: HR data handled per policy; access audited
- Departure: access removed; certain data retained per law (payroll, tax, employment verification)

Employees are also data subjects → have rights.

---

## 22. Customer's Privacy Obligations

We're processor for customer data; they're controller. Their obligations include:
- Legal basis to use AIMS with their data subjects' info
- Privacy notice to their users
- Handling their users' DSRs (we assist)

Our DPA clarifies. CUECs in SOC 2 + ISO reports reiterate.

---

## 23. Privacy Tooling (Phase 2+)

### Drata / Vanta
- Policy + evidence for compliance
- DSR tracking (basic)

### Dedicated privacy platforms (consider)
- **OneTrust** — market leader; expensive
- **TrustArc** — similar
- **DataGrail** — automated DSR handling

Decision at Phase 3 based on DSR volume.

---

## 24. What We Don't Do

- **Sell personal data** — not our business model
- **Use personal data for ML training** without consent
- **Share personal data with advertisers**
- **Keep marketing data after opt-out**
- **Respond to government requests without legal review**
- **Transfer data to non-adequate without mechanism**
- **Skip privacy in product reviews**

---

## 25. Related Documents

- [`DATA-CLASSIFICATION.md`](DATA-CLASSIFICATION.md) — technical handling
- [`THIRD-PARTY-RISK.md`](THIRD-PARTY-RISK.md) — subprocessor program
- [`INCIDENT-RESPONSE.md`](INCIDENT-RESPONSE.md) — breach notification
- [`HIPAA.md`](HIPAA.md) — PHI specifically
- [`COMPLIANCE-FRAMEWORKS.md`](COMPLIANCE-FRAMEWORKS.md) — regulatory landscape
- [`TRUST-CENTER.md`](TRUST-CENTER.md) — customer-facing
- `implementation/templates/dpa-template.md` — our DPA
- `aims.io/privacy` — public privacy notice
- `trust.aims.io/subprocessors` — subprocessor list
