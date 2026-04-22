# HIPAA Compliance

> Protected Health Information (PHI) handling for healthcare audit customers. BAA with customers + subprocessors, Administrative / Physical / Technical safeguards per 45 CFR §164, breach notification under HITECH. Phase 5 target, but foundations built earlier.

---

## 1. Scope

HIPAA applies when customers use AIMS to store or process **Protected Health Information (PHI)** — e.g., hospital internal audits, healthcare insurance audits, state health agency audits.

### When triggered
- Customer is a **Covered Entity** (healthcare provider, health plan, clearinghouse) OR **Business Associate** of one
- They store PHI in AIMS (findings referencing patient data, uploaded work papers with PHI, etc.)
- They sign a **Business Associate Agreement (BAA)** with us

### When NOT triggered
- Non-healthcare customer
- Healthcare customer using AIMS only for non-PHI work (e.g., financial audits with no PHI in scope)

Many healthcare customers choose to default-treat all data in AIMS as PHI-eligible (safer). We accommodate.

---

## 2. Our Role — Business Associate

Under HIPAA, AIMS would be a **Business Associate (BA)** of the customer Covered Entity.

### BA obligations (from HIPAA + HITECH)
- Comply with Security Rule (§164.302-318) — Administrative, Physical, Technical safeguards
- Comply with Privacy Rule's BA provisions (§164.502(e), §164.504(e))
- Notify CE of PHI breaches per Breach Notification Rule (§164.410)
- Ensure sub-BAs (our subprocessors touching PHI) sign BAAs
- Be subject to HHS enforcement

### What we don't do
- Use PHI for our own purposes beyond providing the service
- Disclose PHI except as the BAA permits
- Sell PHI
- Use PHI for marketing

---

## 3. Phase 5 Deliverables

Before accepting a HIPAA customer, we need:
- **BAA template** customer can sign
- **Subprocessor BAAs** with every vendor touching PHI
- **Safeguards documentation** (this doc + policies)
- **HIPAA-specific technical controls** (see §5-7)
- **Breach notification procedures** (HIPAA-specific)
- **Employee training** (HIPAA-specific module)
- **Risk analysis** (HIPAA-required — annual minimum)
- **Audit log requirements** met

Not pursued speculatively — we wait for a qualified customer + contract.

---

## 4. Administrative Safeguards (§164.308)

Required HIPAA admin controls, mapped to what we already have:

| HIPAA | Requirement | Our implementation |
|-------|-------------|--------------------|
| §164.308(a)(1)(ii)(A) | Risk analysis | Per `SECURITY-PROGRAM.md §6`; annual review + PHI-specific risk assessment |
| §164.308(a)(1)(ii)(B) | Risk management | Risk register; mitigation + treatment plans |
| §164.308(a)(1)(ii)(C) | Sanction policy | AUP + HR disciplinary process |
| §164.308(a)(1)(ii)(D) | Information system activity review | Log review + monitoring |
| §164.308(a)(2) | Assigned security responsibility | CISO |
| §164.308(a)(3) | Workforce security | Onboarding / offboarding / access mgmt |
| §164.308(a)(4) | Information access management | RLS + RBAC + ABAC |
| §164.308(a)(5) | Security awareness + training | HIPAA-specific training annual |
| §164.308(a)(6) | Security incident procedures | `INCIDENT-RESPONSE.md` + HIPAA-specific additions |
| §164.308(a)(7) | Contingency plan | BCP / DR (`devops/DISASTER-RECOVERY.md`) |
| §164.308(a)(8) | Evaluation | Annual internal + external audit |
| §164.308(b) | Business associate contracts | Subprocessor BAAs |

---

## 5. Physical Safeguards (§164.310)

Mostly inherited from AWS (which provides BAA-covered hosting). Our contribution:

| HIPAA | Requirement | Our implementation |
|-------|-------------|--------------------|
| §164.310(a)(1) | Facility access controls | AWS + office access controls |
| §164.310(a)(2)(i) | Contingency operations | DR plan |
| §164.310(a)(2)(ii) | Facility security plan | AWS-managed |
| §164.310(a)(2)(iii) | Access control + validation | AWS data center + our office |
| §164.310(a)(2)(iv) | Maintenance records | AWS |
| §164.310(b) | Workstation use | Endpoint policy (MDM, disk encryption) |
| §164.310(c) | Workstation security | Encryption + auto-lock |
| §164.310(d)(1) | Device + media controls | Asset lifecycle + secure disposal |
| §164.310(d)(2)(i) | Disposal | Certified wipe or destruction |
| §164.310(d)(2)(ii) | Media re-use | Reimaged + sanitized |
| §164.310(d)(2)(iii) | Accountability | Asset tracking |
| §164.310(d)(2)(iv) | Data backup + storage | AWS Backup + cross-region |

---

## 6. Technical Safeguards (§164.312)

Most mapping direct:

| HIPAA | Requirement | Our implementation |
|-------|-------------|--------------------|
| §164.312(a)(1) | Access control | RLS + RBAC + ABAC + MFA |
| §164.312(a)(2)(i) | Unique user ID | SSO; no shared accounts |
| §164.312(a)(2)(ii) | Emergency access | Break-glass with dual approval |
| §164.312(a)(2)(iii) | Automatic logoff | Session timeout policy |
| §164.312(a)(2)(iv) | Encryption + decryption | TLS + KMS at rest |
| §164.312(b) | Audit controls | AuditEvent + CloudTrail + immutable log |
| §164.312(c)(1) | Integrity | Hash chain + digital signatures |
| §164.312(c)(2) | Mechanism to authenticate PHI | Checksums + hash chain |
| §164.312(d) | Person / entity authentication | MFA + SSO |
| §164.312(e)(1) | Transmission security | TLS 1.3 |
| §164.312(e)(2)(i) | Integrity controls | TLS + signed payloads |
| §164.312(e)(2)(ii) | Encryption | TLS 1.3 |

---

## 7. PHI-Specific Technical Additions

Beyond our normal controls, HIPAA-enabled tenants get:

### Stronger encryption
- **Field-level encryption** for PHI fields (via per-tenant envelope encryption)
- **BYOK option** for enterprise HIPAA customers (bring-your-own-key)

### Isolation
- Option for **dedicated instance** (single-tenant) at higher price for CEs needing it
- Shared default: tenant boundaries enforced by RLS + per-tenant keys

### Audit logging (stronger)
- Every PHI access logged:
  - User
  - Action
  - Affected record
  - Reason (system-inferred or user-provided)
- Logs retained **6 years minimum** (HIPAA)
- Customer can request audit log export

### Minimum necessary
- UI nudges users to scope access (not "show all" by default)
- API parameters require specific IDs (no "list all engagements" without filter)
- Logs capture minimum-necessary compliance flag

### Data localization
- HIPAA customers can pin data to US regions only (HIPAA doesn't require this, but many CEs prefer)

---

## 8. Business Associate Agreement (BAA)

### Template
Our BAA template at `implementation/templates/baa-template.md` (authored Phase 5).

### Required clauses (§164.504(e))
1. Permitted uses + disclosures
2. Safeguards
3. Reporting of unauthorized use / breach
4. Ensuring subcontractors comply (flow-down)
5. Access to PHI for individuals (DSRs)
6. Amendment rights for CE
7. Return / destruction of PHI at termination
8. HHS audit rights
9. Termination for material breach

### Negotiation
- We offer a balanced template
- Enterprise CEs often have their own template; we negotiate
- Legal (outside counsel with healthcare experience) reviews per customer
- BAA executed before any PHI flows

### Sub-BA relationships
Every subprocessor touching PHI signs a BAA with us. AWS, Stripe (BAA-eligible plans only), SendGrid BAA-eligible services, etc. Some vendors don't offer BAA — **those cannot be used for PHI customers**.

---

## 9. Breach Notification Rule (§164.404-410)

Broader than GDPR but similar spirit.

### Definition of breach
"Acquisition, access, use, or disclosure of PHI in a manner not permitted" that poses probable-risk to PHI.

Exceptions:
- Unintentional access by workforce acting in good faith, within scope
- Inadvertent disclosure to another authorized person at same entity
- Disclosure where unauthorized person couldn't retain PHI (e.g., closed-glance, not retained)

### Risk assessment
Evaluate:
- Nature + extent of PHI involved (sensitivity, identifiers)
- Unauthorized person who received
- Whether PHI was actually acquired or viewed
- Mitigation extent

Low probability → not a breach; document decision. Otherwise → breach.

### Notification timelines
Different for CE vs BA:

**CE → affected individuals**: without unreasonable delay, **60 days max** from discovery.
**CE → HHS**:
- ≥500 affected: at time of individual notification + news media
- <500: annual log submitted

**BA (AIMS) → CE**: without unreasonable delay, **60 days max** (BAA typically tightens to 30 or less).

### Our obligations
- Notify affected CE promptly (per BAA)
- Provide details: what PHI, affected individuals, nature of breach, mitigation
- Cooperate with CE's investigation + notifications
- Update subprocessor list if applicable

### Records
- All breach determinations + notifications kept 6 years
- HHS audits may request

---

## 10. HIPAA-Specific Incident Response

Parallel track within `INCIDENT-RESPONSE.md`. Extra steps for PHI incidents:

1. **Isolate + contain** — normal
2. **Assess PHI impact** — which CE(s), how many individuals, what types
3. **Notify affected CEs** promptly per BAA (within 30 days unless contract specifies faster)
4. **Assist CE** in their notification to individuals + HHS
5. **Enhanced forensic preservation** — HHS audits often follow large breaches
6. **Compliance review** — was incident enabled by gap in HIPAA-specific control? File corrective action

### Ransomware note
HHS guidance (2016+): ransomware is presumed breach of PHI unless evidence shows low probability of compromise. Plan accordingly.

---

## 11. Training

HIPAA-specific annual training for:
- Engineers working on HIPAA-scoped features
- Support + CS engaging with HIPAA customers
- Anyone potentially accessing PHI

Content:
- What's PHI
- Minimum necessary standard
- Breach recognition + reporting
- BAA obligations
- Sanctions for violation (HIPAA civil + criminal penalties up to $50k/violation, $1.5M/year; criminal jailtime for willful neglect)

---

## 12. Risk Analysis

Required HIPAA deliverable — annual, documented.

### Content
- List of PHI-processing activities
- Threats (external attack, insider, accident, natural)
- Vulnerabilities (technical + procedural)
- Current safeguards
- Likelihood × impact assessment
- Remediation plan
- Sign-off by CISO

Mirrors `SECURITY-PROGRAM.md §6` but PHI-focused. OCR (HHS Office for Civil Rights) has specific expectations. Use NIST SP 800-66 as guide.

---

## 13. Audit Controls + Retention

### What we log for HIPAA customers (beyond normal)
- PHI access events (who, what, when)
- PHI modifications
- Failed access attempts to PHI
- Admin actions on PHI-scoped resources
- System events on HIPAA systems (change mgmt)

### Retention
- Audit logs: **6 years minimum** (HIPAA §164.530(j))
- Our normal 1-year hot + 7-year cold exceeds this

### Access to audit logs
- CE can request audit log export for their own data
- Self-service (in product) for recent activity; export for longer windows
- We never aggregate across CEs

---

## 14. Patient Right of Access

HIPAA gives individuals right to their PHI. CE handles; we assist.

- CE uses our tools to gather individual's PHI
- We provide export format aligning with HIPAA ("readable electronic form")
- Timeline (30 days usually; extensions allowed)
- Free for patient's first request within a timeframe; reasonable fees for additional

Technical: normal data export + filtering + audit trail of access.

---

## 15. De-Identification

### Safe Harbor method (§164.514(b)(2))
Remove 18 specific identifiers; then data is no longer PHI.

### Expert determination method
Statistical expert attests risk of identification is very low.

### Our tools
- De-identification endpoint (Phase 5+): programmatic stripping of identifiers for customer use cases
- Customers can build de-identified datasets for research / analytics
- Logged as compliance-relevant activity

### Re-identification restrictions
- We never attempt re-identification
- Customers contractually commit similarly in BAA

---

## 16. Substance Use Disorder (SAMHSA 42 CFR Part 2)

Even stricter than HIPAA. Applies if customer handles SUD treatment records.

- Separate opt-in for Part 2–covered data (if we support)
- Stricter consent requirements
- Tighter disclosure rules

Phase 5+ evaluation based on customer demand.

---

## 17. Texas HB 300 + State Variants

Some states layer on HIPAA:
- **Texas HB 300**: broader than HIPAA; stricter training, some state-specific notifications
- **California CMIA**: similar
- **New York SHIELD Act**: consumer-focused

HIPAA-ready program + state-specific addendum (annual review).

---

## 18. Phase 5 Milestones

1. Outside counsel retained (healthcare specialist)
2. BAA template authored + reviewed
3. Technical controls enhanced (PHI field-level encryption, audit log expansion)
4. Subprocessor BAAs negotiated + executed
5. HIPAA-specific training content developed
6. Risk analysis conducted
7. First CE customer onboarded under BAA
8. First HIPAA incident drill

Timeline: ~6 months from trigger (customer commitment).

---

## 19. Common HIPAA Pitfalls We Avoid

- **Accepting a BAA without controls in place** — sets up for violation
- **Using vendors without BAAs for PHI flows** — violation at first use
- **Weak risk analysis** — insufficient before violation; critical after
- **Ignoring minimum necessary** — "show all" UX is a HIPAA issue
- **Treating HIPAA as optional** — it's federal law
- **Over-promising to CEs** — under-promise, over-deliver
- **Skipping training** — OCR penalties cite training gaps
- **Missing breach notification deadline** — penalties escalate with delay
- **"We're GDPR; HIPAA is similar"** — it's similar but has specific extras

---

## 20. HIPAA + SOC 2 + GDPR — Stack

Many healthcare customers ask for all three:
- SOC 2 Type II report
- ISO 27001 certificate
- BAA-ready
- GDPR DPA

With common controls, we satisfy most with one program. BAA specifics + breach notification specifics are HIPAA-unique layers.

---

## 21. Resources

Useful references:
- HIPAA regulations: 45 CFR Parts 160, 162, 164
- HITECH Act (HIPAA updates 2009)
- HHS Office for Civil Rights (OCR) — enforcement
- NIST SP 800-66 — HIPAA Security Rule implementation guide
- HHS HIPAA FAQs
- HHS Breach Portal ("Wall of Shame") — breaches ≥ 500 published

---

## 22. What We Don't Do

- **Claim "HIPAA certified"** — there's no such thing (vs HITRUST which is real)
- **Market to healthcare customers until Phase 5 ready**
- **Accept PHI without BAA** — period
- **Use non-BAA subprocessors for PHI flows**
- **Rush breach notification without Legal**

---

## 23. Related Documents

- [`SOC2.md`](SOC2.md) — shared technical controls
- [`PRIVACY.md`](PRIVACY.md) — general privacy + overlap
- [`THIRD-PARTY-RISK.md`](THIRD-PARTY-RISK.md) — sub-BA management
- [`INCIDENT-RESPONSE.md`](INCIDENT-RESPONSE.md) — breach response
- [`DATA-CLASSIFICATION.md`](DATA-CLASSIFICATION.md) — PHI sub-class
- [`../database/`](../database/) — per-tenant encryption
- `implementation/templates/baa-template.md` — BAA template (Phase 5)
- `implementation/policies/hipaa-safeguards.md` — internal safeguards doc
