# AIMS v2 — Security & Compliance

> The governance, policies, compliance frameworks, and evidence program that make AIMS v2 a trust-worthy SaaS for enterprise, government, and regulated customers. Program-level — not code-level.

---

## Why This Folder Exists

Previous folders cover *how we build and run* the system:
- `auth/` — identity & access (technical)
- `devops/SECRETS.md` — secret lifecycle (technical)
- `engineering/SECURITY-TESTING.md` — SAST/DAST/pentest (testing)
- `database/` — RLS, encryption, audit log (technical)

This folder covers *how we're trustworthy* as an organization:
- Who is responsible for security? (CISO, champions, engineers)
- What policies do we publish?
- How do we classify + handle data?
- How do we manage vulnerabilities — beyond scanning?
- How do we respond to security incidents?
- How do we vet third parties?
- How do we prepare for SOC 2, ISO 27001, HIPAA, GDPR?
- How do customers verify our claims (trust center)?

Security is a technical discipline *plus* an organizational discipline. This folder is the organizational half.

---

## Audiences

| Reader | Why this folder matters |
|--------|-------------------------|
| **Customers** (evaluating AIMS) | Evidence + questionnaires + trust center — "can we trust them with our audit data?" |
| **Auditors** (SOC 2, ISO 27001) | Policies, procedures, evidence trail, controls mapping |
| **Regulators** (GDPR DPAs, sector-specific) | Privacy notices, DPIAs, breach notifications |
| **Internal engineers** | What policies apply to me? What's the process for X? |
| **CISO / Security team** | Program definition, governance structure |
| **Legal / DPO** | Contractual obligations to customers |
| **Partners + investors** | Due diligence artifacts |

---

## Core Principles

### 1. Security is a Property of the Organization, Not a Tool
Tools (Semgrep, Vault, KMS) are necessary but not sufficient. Without policies, training, and accountability, tools produce reports nobody reads.

### 2. Compliance Follows From Security, Not The Other Way Round
We build security that works, then map it to whichever framework the customer asks about. Chasing checkboxes produces fragile programs.

### 3. Evidence Is Continuous, Not Annual
Audit preparation means "pull reports from our continuous monitoring." We don't scramble for evidence in month 12.

### 4. Least Privilege by Default, Everywhere
No standing access to production. No wildcards in IAM. No "temporary" admin roles that live forever. Friction is part of the design.

### 5. Transparent Incident Handling
Customers find out about material incidents from us, quickly, with specifics. The cost of over-communicating is low; the cost of cover-up is existential.

### 6. Privacy Is Not An Afterthought
We apply GDPR-grade data handling to all customer data, including non-EU. One standard for everyone is cheaper than two.

### 7. Third Parties Extend Our Trust Surface
Every vendor we use is part of our security posture. We vet them like we vet ourselves.

### 8. Training + Awareness Over Checkbox Compliance
Engineers + staff understand *why*, not just *what*. Phishing simulations, red team findings, and real incidents become training material.

### 9. Right-Sized For Where We Are
Phase 1 program ≠ Phase 5 program. Stage-appropriate. We don't cargo-cult Fortune-100 controls into a 10-person team; we also don't skip foundations that preclude later scaling.

### 10. Defense In Depth, End To End
No single control protects anything critical. Loss of one control doesn't equal breach. Every boundary is defended.

---

## Compliance Roadmap (Phased)

| Phase | Target | When | Effort |
|-------|--------|------|--------|
| **Phase 1** (GA launch) | Security program baseline, policies, evidence collection starts | Pre-GA | 1 FTE security + consult |
| **Phase 2** (post-GA) | SOC 2 **Type I** attestation | ~6 months post-GA | 1 FTE + auditor |
| **Phase 3** (first enterprise customers) | **SOC 2 Type II** (12-month observation) | ~18 months post-GA | 1 FTE ongoing + auditor |
| **Phase 4** (EU + global) | **ISO 27001** certification, **GDPR DPIA** | ~24 months post-GA | 1 FTE + certification body |
| **Phase 5** (healthcare customers) | **HIPAA-ready**, BAA template, PHI isolation | As customer demand | +1 FTE if significant |
| **Phase 6** (US federal) | **FedRAMP Moderate** ATO, GovCloud | 3+ years post-GA, if pursued | 3+ FTE + 3PAO, multi-year |
| **Phase 7** (payment processing — unlikely for audit SaaS) | PCI DSS | Only if warranted | Heavy |

We do not pursue certifications speculatively. Each is triggered by a specific customer ask or demonstrated market demand.

---

## Framework Coverage (Summary)

Full detail in [`COMPLIANCE-FRAMEWORKS.md`](COMPLIANCE-FRAMEWORKS.md).

| Framework | Scope | Phase |
|-----------|-------|-------|
| **SOC 2 Type II** | Trust principles (Security, Availability, Confidentiality, Processing Integrity, Privacy) | 3 |
| **ISO 27001:2022** | ISMS + Annex A controls (93 controls, 4 themes) | 4 |
| **ISO 27701** | Privacy extension to 27001 | 5 |
| **GDPR** | EU customer data | Continuous — Phase 1 |
| **UK GDPR / DPA 2018** | UK customers | Continuous — Phase 1 |
| **CCPA / CPRA** | CA residents | Continuous — Phase 1 |
| **Other US state privacy** (VA, CO, CT, UT, ...) | State residents | Continuous as applicable |
| **HIPAA** | PHI (healthcare audits) | 5 |
| **FedRAMP Moderate** | US federal customers | 6 (if pursued) |
| **FINRA / SEC** | Financial audit customers (retention rules) | Addressed via retention policy |
| **NIS2** | EU critical infrastructure (may apply to some customers) | Monitored |
| **CMMC** | DoD supply chain | 6 (if pursued) |

---

## Folder Structure

```
security/
├── README.md                          ← You are here
├── SECURITY-PROGRAM.md                ← governance, team, training, risk mgmt
├── POLICIES.md                        ← catalog of required policies
├── DATA-CLASSIFICATION.md             ← public/internal/confidential/restricted/regulated
├── VULNERABILITY-MANAGEMENT.md        ← patch mgmt, SLAs, exception process
├── INCIDENT-RESPONSE.md               ← security incidents (distinct from ops)
├── THIRD-PARTY-RISK.md                ← vendor / subprocessor management
├── COMPLIANCE-FRAMEWORKS.md           ← map across frameworks
├── SOC2.md                            ← Trust Service Criteria prep
├── ISO27001.md                        ← ISMS + Annex A mapping
├── PRIVACY.md                         ← GDPR, CCPA, CPRA, state privacy laws
├── HIPAA.md                           ← PHI handling, BAA, safeguards
├── TRUST-CENTER.md                    ← customer-facing transparency
├── EVIDENCE-COLLECTION.md             ← Drata/Vanta + continuous compliance
└── implementation/
    ├── policies/
    │   ├── acceptable-use.md          ← AUP template
    │   ├── access-control.md          ← Access control policy
    │   ├── information-security.md    ← InfoSec policy (master)
    │   ├── data-retention.md
    │   ├── data-classification.md
    │   ├── encryption.md
    │   ├── incident-response.md
    │   └── business-continuity.md
    ├── templates/
    │   ├── dpa-template.md            ← Data Processing Agreement
    │   ├── subprocessor-agreement.md
    │   ├── risk-register.md
    │   └── security-questionnaire.md  ← CAIQ / SIG-lite response template
    └── runbooks/
        ├── security-incident.md
        ├── breach-notification.md
        └── subpoena-lawful-request.md
```

---

## Relationship To Other Folders

| Touch point | Where the technical/operational detail lives |
|-------------|----------------------------------------------|
| Auth, MFA, SSO | `auth/` |
| Session revocation policy (which tokens are instantly revocable) | [`auth/REVOCATION-POLICY.md`](../auth/REVOCATION-POLICY.md) (ADR-0005) |
| Secrets, KMS, DEK rotation | [`ROTATION.md`](ROTATION.md) (per-tenant DEK lifecycle, ADR-0001) + `devops/SECRETS.md` |
| Tenant isolation (two-layer: app-layer primary + RLS defence-in-depth) | `database/` + [`database/POOLING.md`](../database/POOLING.md) (ADR-0002) |
| Application-layer encryption (ALE via KMS-wrapped DEKs) | `packages/encryption/` + [`ROTATION.md`](ROTATION.md) (ADR-0001) |
| CI security gates (SAST/SCA) | `engineering/SECURITY-TESTING.md` |
| Backups, DR, BCP | `devops/DISASTER-RECOVERY.md` |
| Audit log (hash chain) | `database/functions/audit-log-triggers.sql` |
| Observability, alerts | `devops/OBSERVABILITY.md` |
| Data residency — DB-level detail | `database/DATA-RESIDENCY.md` |
| Data residency — silo architecture | [`DATA-RESIDENCY.md`](DATA-RESIDENCY.md) (regional deployment silos, ADR-0006) |

This folder references those — doesn't duplicate them. The cross-references above reflect the current architecture after the April 2026 ADR cycle; several of the referenced files were created as part of that reconciliation.

---

## Ownership

| Area | Accountable |
|------|-------------|
| Overall security program | **CISO** (initially: VP Eng wearing dual hat; dedicated hire by Phase 3) |
| AppSec (code + CI) | Head of Engineering + AppSec champion rotation |
| Infrastructure security | Platform / SRE |
| Compliance audits | Compliance Officer (Phase 3+: dedicated) |
| Privacy / DPO | Legal — Data Protection Officer (contractual, Phase 2+) |
| Incident response (security) | CISO → on-call rotation |
| Training + awareness | HR + Security Team |
| Vendor risk | Security + Legal + Procurement |
| Trust center + customer questionnaires | Security + CS + Sales enablement |
| Evidence automation (Drata/Vanta) | Security + IT |

### RACI summary (detailed in `SECURITY-PROGRAM.md §2`)

---

## What This Folder Will Not Do

- Provide a magic SOC 2 certificate (it's earned, not declared)
- Replace legal counsel (this folder describes — Legal advises)
- Cover deep technical details already in sibling folders
- Act as the marketing trust page (that's `TRUST-CENTER.md`'s scope, but under CISO + CS — not Marketing writing alone)

---

## How To Use This Folder

**New engineer**:
1. Read this README
2. Read `SECURITY-PROGRAM.md` + `DATA-CLASSIFICATION.md`
3. Read `POLICIES.md` catalog; skim the AUP
4. Complete security training within 30 days

**Customer security review**:
1. Point to `TRUST-CENTER.md` → public trust page
2. Share completed security questionnaire (CAIQ / SIG-lite)
3. SOC 2 / ISO 27001 report under NDA
4. DPA via `implementation/templates/dpa-template.md`

**New vendor adoption**:
1. Follow `THIRD-PARTY-RISK.md` process
2. Vendor fills security questionnaire
3. DPA signed if they process customer data
4. Added to subprocessor list

**Security incident**:
1. Follow `INCIDENT-RESPONSE.md`
2. Reference `implementation/runbooks/security-incident.md`
3. Coordinate regulatory notifications per `PRIVACY.md`

---

## Status

- [x] Security principles articulated
- [x] Folder scope defined
- [ ] CISO role filled (Phase 1: dual-hatted; dedicated hire Phase 3)
- [ ] Core policies authored (Phase 1; templates in implementation/)
- [ ] Risk register populated (Phase 1)
- [ ] Drata/Vanta onboarded (Phase 2)
- [ ] SOC 2 Type I kicked off (Phase 2)
- [ ] Trust center live (Phase 1)
- [ ] First external pen test scheduled (Phase 1 end)
