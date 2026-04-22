# Security Policy Catalog

> The policies that govern how AIMS operates. Each policy has an owner, a review cadence, and a compliance mapping. Policies are short and readable — long policies nobody reads are worse than none.

---

## 1. Why Policies Matter

Policies are:
- **Promises** to customers, auditors, regulators, employees
- **Authoritative sources** for what's allowed + required
- **Evidence** for compliance audits (a control must have a documented policy behind it)
- **Training material** for new staff
- **Guardrails** when people have to decide "can I do this?"

Bad policies:
- Nobody reads them
- They contradict how the company actually operates
- They use legalese that obscures intent
- They cover everything so people apply none

Our policies are:
- **Short** (most 1–3 pages)
- **Plain-language**
- **Actionable** (what must I do? what must I not do?)
- **Reviewed regularly**

---

## 2. Policy Hierarchy

```
  Level 1 — Information Security Policy (master)
           (approved by CEO; sets direction)
           │
           ▼
  Level 2 — Domain Policies
           (approved by CISO; each covers one area)
           │
           ▼
  Level 3 — Standards + Procedures
           (approved by domain owner; detailed "how")
           │
           ▼
  Level 4 — Runbooks + Checklists
           (in operational folders; live with the work)
```

- **Policy**: what + why (intent)
- **Standard**: specific requirements ("TLS 1.3 minimum")
- **Procedure**: how to do something
- **Runbook**: step-by-step for ops

This folder holds Level 1 + 2. Standards/procedures/runbooks typically live in the functional folder (e.g., `devops/RUNBOOKS.md`).

---

## 3. Policy Catalog

### Master

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Information Security Policy | CISO | Annual | CC1.1 | A.5.1 | §164.308(a)(1) | — | `implementation/policies/information-security.md` |

### Domain — Access + Identity

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Access Control | CISO | Annual | CC6.1, CC6.2, CC6.3 | A.5.15-5.18 | §164.308(a)(4) | Art. 32 | `implementation/policies/access-control.md` |
| Password + Authentication | CISO | Annual | CC6.1 | A.5.17 | §164.308(a)(5) | — | `implementation/policies/authentication.md` |
| Remote Access | CISO | Annual | CC6.6 | A.6.7 | §164.308(b) | — | `implementation/policies/remote-access.md` |

### Domain — Data Protection

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Data Classification | CISO | Annual | CC3.1, C1.1 | A.5.12 | — | Art. 32 | `implementation/policies/data-classification.md` |
| Data Handling + Retention | DPO + CISO | Annual | CC6.5, C1.2 | A.5.11, A.8.10 | §164.316(b)(2) | Art. 5(e), Art. 17 | `implementation/policies/data-retention.md` |
| Encryption | CISO | Annual | CC6.1, C1.1 | A.8.24 | §164.312(a)(2) | Art. 32 | `implementation/policies/encryption.md` |
| Privacy (Data Protection) | DPO | Annual | P1.1-P8.1 (Privacy TSC) | A.5.34, A.8.3 | §164.502-.530 | Art. 5-11 | `implementation/policies/privacy.md` |

### Domain — Operations

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Acceptable Use (AUP) | HR + CISO | Annual | CC1.4 | A.5.10 | §164.308(a)(5) | — | `implementation/policies/acceptable-use.md` |
| Change Management | Head of Eng | Annual | CC8.1 | A.8.32 | §164.308(a)(7) | — | `implementation/policies/change-management.md` |
| Asset Management | SRE | Annual | CC6.1 | A.5.9-5.10 | §164.310(d) | — | `implementation/policies/asset-management.md` |
| Vulnerability Management | CISO | Annual | CC7.1 | A.8.8 | §164.308(a)(1)(ii)(A) | — | `VULNERABILITY-MANAGEMENT.md` (this folder) |
| Incident Response | CISO | Annual + drill | CC7.3-7.5 | A.5.24-5.27 | §164.308(a)(6) | Art. 33, 34 | `INCIDENT-RESPONSE.md` (this folder) |
| Business Continuity + DR | SRE + CISO | Annual + drill | A1.2-A1.3 | A.5.29-5.30 | §164.308(a)(7) | — | `../devops/DISASTER-RECOVERY.md` |

### Domain — People + Physical

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Onboarding + Offboarding | HR + CISO | Annual | CC1.4, CC6.2 | A.6.1-6.3, A.6.5 | §164.308(a)(3) | — | `implementation/policies/personnel.md` |
| Security Training + Awareness | CISO + HR | Annual | CC2.2 | A.6.3 | §164.308(a)(5) | — | `implementation/policies/training.md` |
| Clean Desk + Screen Lock | CISO | Annual | — | A.7.7 | — | — | `implementation/policies/clean-desk.md` |
| Physical Security | SRE | Annual | CC6.4 | A.7.1-7.14 | §164.310(a)(1) | — | `implementation/policies/physical-security.md` |

### Domain — External

| Policy | Owner | Review | SOC 2 | ISO 27001 | HIPAA | GDPR | Location |
|--------|-------|--------|-------|-----------|-------|------|----------|
| Third-Party / Vendor Risk | CISO + Procurement | Annual | CC9.1 | A.5.19-5.23 | §164.308(b), §164.314 | Art. 28, 46 | `THIRD-PARTY-RISK.md` (this folder) |
| Customer Data Handling | Legal + CISO | Annual | C1.1, P1.1 | — | §164.502 | Art. 28 | `implementation/templates/dpa-template.md` |
| Subprocessor List | DPO | Quarterly | C1.1 | A.5.22 | — | Art. 28(2) | `trust.aims.io/subprocessors` |

---

## 4. Policy Structure

Every policy follows the same template:

```markdown
# <Policy Name>

## Metadata
- Version: 1.x
- Effective date: YYYY-MM-DD
- Approved by: <role> on YYYY-MM-DD
- Review cadence: <annual / semi-annual / on change>
- Next review: YYYY-MM-DD
- Owner: <role>
- Classification: Internal

## Purpose
Why this policy exists. What's the outcome we want?

## Scope
Who / what this applies to:
- Persons: all employees + contractors OR a subset
- Systems: all production OR a subset
- Data: all customer data OR a class

## Policy
The actual rules. Short, imperative. "Engineers must …" "Production data may only be accessed …"

## Responsibilities
Who is responsible for what.

## Exceptions
How to request an exception (most policies allow requests through CISO).

## Related documents
Links to procedures, standards, supporting runbooks.

## Compliance mapping
Which controls this policy satisfies.

## Revision history
v1.x — YYYY-MM-DD — description
v1.x — YYYY-MM-DD — description
```

Templates in `implementation/policies/` each follow this.

---

## 5. Policy Lifecycle

See `SECURITY-PROGRAM.md §4`. Summary:

### Creation
1. Drafter: Security team or domain owner
2. Review: CISO + Legal + relevant stakeholders
3. Approval: CISO (most) or CEO (master InfoSec, AUP)
4. Publication: internal portal + repo
5. Notification: staff-wide announcement; training if substantial

### Annual review
On each policy's anniversary:
- Confirm still accurate
- Update per past year's lessons (incidents, audit findings, regulatory changes)
- Re-approve

### Exception process
See §6.

### Deprecation
Replaced policies marked `superseded-by: <policy>`. Kept in archive for 7 years (audit evidence).

### Violations
- Minor first offense: coaching + documented
- Significant or repeat: HR action up to + including termination
- Criminal: law enforcement referral

All policy violations logged. Patterns trigger training / policy refinement.

---

## 6. Policy Exceptions

### When exceptions are granted
- Legitimate business need
- Compensating controls cover the risk
- Time-bounded (not "forever")
- Written approval from risk owner

### Process
1. Exception request via ticket: describe need, duration, alternatives considered
2. Risk assessment by Security team
3. Approval:
   - Low residual risk: domain owner (e.g., SRE lead)
   - Medium: CISO
   - High: CISO + VP Eng / CEO
4. Documented with expiry date
5. Compensating controls implemented + verified
6. Re-evaluated at expiry (renew or rectify)

### Exception register
Tracked in compliance tool (Drata / Vanta). Auditor reviews during engagements. Pattern of exceptions in one area → review underlying policy (maybe it's wrong).

---

## 7. Published vs Internal Policies

### Internal only
Most policies. Share during due diligence under NDA.

### Published
- AUP (we sign on behalf of staff)
- Subprocessor list (must be published per GDPR Art. 28)
- Privacy policy (public; customer-facing)
- Vulnerability disclosure policy (public; security.txt)
- Responsible disclosure timeline (public)

### On request with NDA
- SOC 2 report
- ISO 27001 certificate + SoA (Statement of Applicability)
- Pen test executive summary
- Security questionnaires (CAIQ, SIG-lite)
- BAA template (HIPAA customers)
- Insurance certificate

### Never share
- Pen test detailed findings (fixed ones OK; open ones private)
- Security architecture details beyond trust center
- Incident specifics that identify other customers
- Employee names beyond executive team

---

## 8. Policy Ownership

Every policy has **one** owner — a specific role, not "the team":

| Role | Owns |
|------|------|
| CISO | Information Security, Access Control, Encryption, Training, Data Classification, Asset Mgmt |
| DPO | Privacy, Data Retention, Customer Data Handling |
| Head of Eng | Change Management, Secure Development |
| SRE Lead | BCP/DR, Physical Security, Asset Mgmt (ops) |
| HR Head | Acceptable Use, Onboarding/Offboarding (with CISO), Personnel |
| Legal | Third-Party contracts, DPA, Sub-processor additions |
| Procurement | Vendor lifecycle (shared with CISO) |

Owner is accountable for:
- Accuracy
- Annual review
- Updates when material change
- Training content alignment
- Responding to auditor questions about their policies

---

## 9. Policies + Compliance Frameworks

A single policy often satisfies multiple frameworks:

```
Access Control Policy
├── SOC 2 — CC6.1, CC6.2, CC6.3
├── ISO 27001 — A.5.15, A.5.16, A.5.17, A.5.18
├── HIPAA — §164.308(a)(4) Information Access Management
├── GDPR — Art. 32 (Security of Processing)
├── FedRAMP — AC-1, AC-2, AC-3, AC-6 (Phase 6)
└── NIST CSF — PR.AC-1, PR.AC-4, PR.AC-6
```

Mapping stored in Drata / Vanta — each framework's controls hyperlink to our supporting policies + evidence.

See `COMPLIANCE-FRAMEWORKS.md` for the full mapping.

---

## 10. Policy Red Flags (What We Avoid)

- **Copied from template, unedited**: "the Company" instead of "AIMS" — reviewer catches
- **Contradicts reality**: policy says "laptops encrypted" but we have none enforced — policy updated OR reality updated
- **Too vague**: "employees will handle data appropriately" — specify what appropriate means
- **Too prescriptive**: listing every specific tool name (breaks on vendor change)
- **Legalese**: use plain language; if a lawyer must write it, translate to plain afterward
- **Undated**: version, effective date, review date — always present
- **Unowned**: ownerless policies rot

---

## 11. AUP — The Policy Everyone Signs

Acceptable Use Policy is the one every employee/contractor signs before access. Highlights:

### What's required
- Use company systems for authorized work
- Protect credentials (no sharing, MFA required)
- Report suspected security issues immediately
- Comply with data classification + handling
- Return assets upon departure

### What's prohibited
- Unauthorized access (even of readable data you don't need)
- Installing unvetted software on company devices
- Forwarding customer data to personal accounts
- Bypassing security controls
- Using company resources for personal commercial ventures
- Harassment, illegal activity

### Acknowledgment
- Signed at onboarding
- Re-signed annually (e-signature via HR platform)
- Material changes require re-sign

Sample template in `implementation/policies/acceptable-use.md`.

---

## 12. Related Documents

- `SECURITY-PROGRAM.md` — governance that enables policies
- `DATA-CLASSIFICATION.md` — the most-used operational policy
- `COMPLIANCE-FRAMEWORKS.md` — how policies map
- `implementation/policies/` — policy templates
- Drata / Vanta (runtime) — evidence + mapping
