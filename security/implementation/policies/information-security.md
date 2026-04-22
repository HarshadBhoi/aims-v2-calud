# Information Security Policy (Master)

<!--
REFERENCE IMPLEMENTATION — Master InfoSec policy template for AIMS.

This is the top-level policy that governs all others. It's approved by CEO,
signed, and published to all employees. Derivative policies (Access Control,
Data Classification, etc.) hang off this one.

Replace placeholder tokens (<ROLE>, <DATE>, <X>) with real values before use.

Keep this document under 5 pages when rendered. If it sprawls, move detail to
a sub-policy and link.
-->

## Metadata

| Field | Value |
|-------|-------|
| **Policy** | Information Security Policy (Master) |
| **Version** | 1.0 |
| **Effective date** | 2026-04-20 |
| **Approved by** | CEO on 2026-04-20 |
| **Review cadence** | Annual |
| **Next review** | 2027-04-20 |
| **Owner** | CISO |
| **Classification** | Internal (shared with customers under NDA on request) |
| **Applies to** | All employees, contractors, vendors with AIMS system access |

---

## 1. Purpose

AIMS operates a multi-tenant SaaS platform entrusted with customers' audit data — including regulated and confidential information. This policy defines the principles, responsibilities, and high-level requirements that protect the confidentiality, integrity, and availability of that information.

This policy operationalizes the company's commitment to:
- Protect customer data against unauthorized access, alteration, or loss
- Meet regulatory and contractual obligations
- Enable AIMS to sell into regulated and enterprise markets
- Sustain customer, partner, and employee trust

---

## 2. Scope

### In scope
- All information processed, stored, or transmitted by AIMS systems
- All employees, contractors, consultants, and interns with system access
- All AIMS-owned or operated systems (production, staging, development, corporate)
- All vendors and subprocessors handling AIMS-controlled data

### Out of scope
- Information explicitly published for public use
- Customers' own internal systems (they bear responsibility for those)

---

## 3. Principles

### 3.1 Security as shared responsibility
Every employee is accountable for information security in their role. This is not the Security team's job alone.

### 3.2 Least privilege
Access is granted only to the minimum necessary to perform assigned duties. Default deny; explicit allow.

### 3.3 Defense in depth
No single control protects critical assets. Multiple independent layers reduce single-point-of-failure risk.

### 3.4 Privacy by design
Privacy considerations are built into systems and processes from inception, not retrofitted.

### 3.5 Continuous improvement
Security posture is reviewed, measured, and improved continuously — not only at audit time.

### 3.6 Transparency with stakeholders
Customers, regulators, and employees are informed of our practices and of material incidents affecting them.

---

## 4. Governance

### 4.1 Security Steering Committee
Meets quarterly. Composition in `SECURITY-PROGRAM.md §2`. Reviews risk, major incidents, compliance roadmap, budget.

### 4.2 Roles
- **CEO** — ultimate accountability; approves this master policy
- **CISO** — overall security program ownership; approves sub-policies
- **DPO** — privacy specifically; Phase 4+
- **Head of Engineering** — secure development practices
- **SRE / Platform** — infrastructure security
- **HR** — personnel security + AUP
- **Legal** — contracts, regulatory, incident notifications
- **All employees** — compliance with policies; report suspected issues

### 4.3 Policy hierarchy
This policy sits above domain policies (Access Control, Data Classification, etc.), which sit above procedures and standards. See `POLICIES.md §2`.

---

## 5. Key Requirements

### 5.1 Confidentiality
- Customer data treated as Confidential or higher per `DATA-CLASSIFICATION.md`
- Encrypted at rest (AWS KMS) and in transit (TLS 1.3 minimum)
- Accessed only on a need-to-know basis by authenticated + authorized personnel
- Shared externally only under appropriate contractual protections (DPA, BAA, NDA)

### 5.2 Integrity
- Data modifications are authenticated + audited
- Immutable audit trails for critical records (findings, reports, audit log itself)
- Hash-chained tamper-evident logs
- Change management for code + infrastructure

### 5.3 Availability
- Service availability targets per contract (99.9% + per Enterprise 99.95%)
- RPO 15 minutes; RTO 1 hour for production
- Tested disaster recovery
- Continuous monitoring + incident response readiness

### 5.4 Access Control
- Strong authentication (SSO + MFA) required for all systems
- Role-based access; least privilege
- Just-in-time elevation for production; no standing admin
- Quarterly access reviews

### 5.5 Secure Development
- Security integrated into SDLC
- Static + composition + dynamic security testing
- Peer review for all code changes
- Threat modeling for significant changes
- Pre-release pen testing

### 5.6 Data Protection
- Data classification applied + enforced
- Retention periods defined per class
- Secure disposal / cryptographic erasure
- Privacy obligations honored (DSRs, breach notifications)

### 5.7 Incident Response
- Dedicated IR process (`INCIDENT-RESPONSE.md`)
- 24x7 on-call coverage
- Customer + regulatory notification per contract + law
- Annual drills

### 5.8 Third-Party Risk
- Vendor onboarding includes security assessment
- DPAs / BAAs in place where required
- Subprocessor list maintained + published
- Annual re-assessment

### 5.9 Business Continuity
- BCP / DR documented + tested
- Backup + recovery verified
- Redundant infrastructure across availability zones and regions

### 5.10 Compliance
- Regulatory obligations tracked + met (GDPR, CCPA, state privacy, HIPAA as applicable, SOC 2, ISO 27001)
- Continuous evidence collection (Drata / Vanta)
- Annual audit cycle

---

## 6. Responsibilities

### 6.1 All employees
- Complete assigned security training (annual minimum)
- Follow policies and procedures
- Protect credentials (no sharing; MFA enabled)
- Use only approved systems + software
- Report suspected security events immediately
- Return all assets upon departure

### 6.2 Managers
- Ensure direct reports complete training
- Approve access for their team on a least-privilege basis
- Promptly notify IT / HR of departures and role changes
- Role-model security behaviors

### 6.3 Engineers + technical staff
- Follow secure development practices (`engineering/CODE-STANDARDS.md`)
- Pass security reviews + gates (`engineering/QUALITY-GATES.md`)
- Respond to security findings within SLA (`VULNERABILITY-MANAGEMENT.md`)
- Participate in incident response when needed

### 6.4 Security Team
- Maintain this and related policies
- Operate security controls
- Respond to incidents
- Coordinate with auditors
- Provide training + guidance

---

## 7. Compliance + Enforcement

### 7.1 Monitoring
Adherence is monitored via:
- Automated controls (CI / CD gates, SSO logs, cloud audit)
- Periodic internal audits
- External audits (SOC 2, ISO 27001)
- Observation + report from colleagues

### 7.2 Violations
- **Unintentional**: coaching + documentation
- **Repeated or significant**: HR disciplinary process
- **Willful or malicious**: termination and, if applicable, law enforcement referral

### 7.3 Non-retaliation
Reporting security concerns, suspected violations, or incidents in good faith will never result in adverse action. Fear of reporting is the greatest threat to a security culture.

---

## 8. Exceptions

Exceptions to this or derivative policies may be granted by the CISO (or CEO for master-policy exceptions) when:
- Business justification outweighs risk
- Compensating controls mitigate residual risk
- Duration is bounded (maximum 90 days; renewable)
- Exception is documented, reviewed, and expires on schedule

---

## 9. Related Policies + Documents

- `POLICIES.md` — full policy catalog
- `DATA-CLASSIFICATION.md` — data handling
- `VULNERABILITY-MANAGEMENT.md` — vulnerabilities
- `INCIDENT-RESPONSE.md` — incidents
- `THIRD-PARTY-RISK.md` — vendors
- `PRIVACY.md` — privacy
- `SECURITY-PROGRAM.md` — program governance
- Access Control, Acceptable Use, Encryption, other sub-policies

---

## 10. Revision History

| Version | Date | Changes | Approver |
|---------|------|---------|----------|
| 1.0 | 2026-04-20 | Initial publication | CEO |

---

## Acknowledgment

All employees and contractors acknowledge this policy as part of onboarding and annually thereafter. Acknowledgment tracked via compliance platform.

---

<!-- Signature block when issued -->

**Approved by**: `<CEO Name>`, Chief Executive Officer
**Signature**: `______________________________`
**Date**: 2026-04-20
