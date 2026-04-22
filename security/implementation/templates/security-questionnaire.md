# Security Questionnaire Response Library

<!--
REFERENCE IMPLEMENTATION — Pre-written responses to common security questions
from customers. Used to respond to CAIQ, SIG-lite, custom questionnaires, or
enterprise RFP questions.

Maintained by Security + CS + Sales Enablement. Answers reviewed quarterly
for accuracy. Legal reviews contractual commitments.

Entries below cover the 80% most frequently asked. For the rest, create a new
entry each time a new question is answered (grows the library).
-->

## Structure

Each entry:
- **Q**: the question (paraphrased across common variations)
- **A**: our standard answer
- **Source**: policy / doc backing the answer
- **Sensitivity**: Public / NDA (whether answer can be shared freely)
- **Last reviewed**: date

---

## 1. General Security Program

### Q: Does AIMS have a dedicated security program?
**A**: Yes. AIMS operates a formal security program led by the CISO. The program includes documented policies, continuous vulnerability management, annual third-party penetration testing, incident response procedures, and ongoing compliance with SOC 2 Type II. Phase-appropriate structure as the organization scales. See `SECURITY-PROGRAM.md`.
**Source**: `SECURITY-PROGRAM.md` · **Sensitivity**: Public · **Reviewed**: 2026-04-20

### Q: Who is your CISO?
**A**: [Title / name of current CISO role-holder]. The CISO reports to the CEO and chairs the Security Steering Committee. [Share direct contact under NDA if asked.]
**Source**: `SECURITY-PROGRAM.md §2` · **Sensitivity**: NDA

### Q: Do you conduct security awareness training?
**A**: Yes. All employees complete annual security awareness training covering data classification, phishing awareness, incident reporting, and acceptable use. Monthly phishing simulations are run. Role-specific training (secure coding for engineers, privacy for CS) is conducted quarterly.
**Source**: `SECURITY-PROGRAM.md §5` · **Sensitivity**: Public

---

## 2. Certifications + Attestations

### Q: Are you SOC 2 compliant?
**A**: AIMS is SOC 2 Type II attested for Security, Availability, and Confidentiality Trust Service Criteria. [Phase 1: "SOC 2 Type I audit scheduled for <date>; Type II report expected <date>."] Report available under NDA upon request via trust center.
**Source**: `SOC2.md` · **Sensitivity**: Public (status); NDA (report)

### Q: Are you ISO 27001 certified?
**A**: [Phase 1: "ISO 27001 certification is planned for Phase 4 of our compliance roadmap, targeted for <date>."] [Phase 4+: "Yes, AIMS holds ISO 27001:2022 certification. Certificate number [X] valid through [date]."]
**Source**: `ISO27001.md` · **Sensitivity**: Public

### Q: What about HIPAA, FedRAMP, PCI DSS?
**A**:
- **HIPAA**: AIMS is HIPAA-capable [Phase 5+]; we offer a Business Associate Agreement for Covered Entity customers. [Phase 1–4: "HIPAA readiness is planned for Phase 5."]
- **FedRAMP**: Not currently pursued; would be considered for qualifying federal opportunities.
- **PCI DSS**: Not applicable — AIMS does not process or store cardholder data. Payment processing handled by Stripe (PCI DSS Level 1 compliant).
**Source**: `COMPLIANCE-FRAMEWORKS.md` · **Sensitivity**: Public

### Q: Can you share your SOC 2 / ISO / pen test reports?
**A**: Yes, under a mutual NDA. Request via trust.aims.io/documents. Most requests fulfilled within 1 business day after NDA execution.
**Source**: `TRUST-CENTER.md §8` · **Sensitivity**: Public

---

## 3. Data Protection

### Q: How is customer data encrypted?
**A**: Customer data is encrypted at rest using AES-256 with AWS KMS-managed keys, and in transit using TLS 1.3. Per-tenant envelope encryption applies to selected high-sensitivity fields [Phase 2+]. Customer-managed encryption keys (BYOK) available for Enterprise tier.
**Source**: `DATA-CLASSIFICATION.md §12` · **Sensitivity**: Public

### Q: Where is customer data stored?
**A**: In AWS regions aligned to customer home-region selection. Primary regions: us-east-1 (US customers), eu-west-1 (EU customers). Data never leaves the selected region boundary without explicit opt-in for cross-region features. Subprocessor list at trust.aims.io/subprocessors details each vendor and region.
**Source**: `../database/DATA-RESIDENCY.md` · **Sensitivity**: Public

### Q: Do you offer data residency choices?
**A**: Yes. Customer selects home region at onboarding. EU tenants' data stays within EU region; US tenants within US region. APAC region available Phase 3+. Tenant-level residency is enforced via routing and RLS; cross-region transfers require explicit customer authorization.
**Source**: `../database/DATA-RESIDENCY.md` · **Sensitivity**: Public

### Q: How long do you retain customer data?
**A**: Customer data is retained per contract, with a default of 7 years after termination. Customers can configure retention within the product. Upon termination, customers can request immediate deletion (30-day soft delete followed by cryptographic erasure). Customer can request a certificate of destruction.
**Source**: `DATA-CLASSIFICATION.md §12`, DPA Section 4.12 · **Sensitivity**: Public

### Q: How do you dispose of customer data?
**A**: Secure disposal via cryptographic erasure (destruction of per-tenant encryption keys) and database deletion. Backups containing the data expire per retention schedule. Destruction certificate available on request.
**Source**: `DATA-CLASSIFICATION.md §12` · **Sensitivity**: Public

### Q: Do you sell, share, or use customer data for advertising / AI training?
**A**: No. AIMS does not sell customer data, share it for advertising, or use it for training AI / ML models. Customer data is processed only as needed to provide the Services, as specified in the DPA.
**Source**: DPA · **Sensitivity**: Public

---

## 4. Access Control

### Q: How is AIMS staff access to customer data controlled?
**A**: No standing access to production customer data. AIMS staff may access production only via Just-in-Time role elevation, time-bounded (max 1 hour), with dual approval. All access is logged with purpose. Access reviewed quarterly.
**Source**: `../devops/INFRASTRUCTURE.md §9`, `../auth/PERMISSIONS.md` · **Sensitivity**: Public

### Q: What SSO / authentication options are available for customers?
**A**: Customers can configure:
- SAML 2.0 SSO (Okta, Azure AD, Google Workspace, Ping, generic SAML)
- OIDC
- SCIM 2.0 provisioning
- MFA enforcement (TOTP, WebAuthn/Passkeys)
- Password-based login with configurable complexity (disabled by default when SSO enabled)

See `../auth/SSO.md` for setup guides.
**Source**: `../auth/SSO.md`, `../auth/MFA.md` · **Sensitivity**: Public

### Q: Do you enforce MFA for staff?
**A**: Yes. MFA is mandatory for all AIMS staff. WebAuthn / FIDO2 hardware keys are preferred and widely deployed. MFA bypass is not possible. Privileged roles require stronger factors.
**Source**: `DATA-CLASSIFICATION.md §6`, `../auth/MFA.md` · **Sensitivity**: Public

---

## 5. Network + Application Security

### Q: What network security measures are in place?
**A**: AIMS operates in AWS with:
- VPC isolation per environment per region
- Public / private subnets; databases in isolated subnets
- Security groups following least privilege
- AWS WAFv2 with OWASP-based rules
- Cloudflare for DDoS protection + bot mitigation
- TLS 1.3 termination at ALB
- VPC Flow Logs + CloudTrail
- No public-facing databases or internal services
**Source**: `../devops/INFRASTRUCTURE.md §3` · **Sensitivity**: Public

### Q: How is application security ensured in development?
**A**: Secure SDLC including:
- Required code review with CODEOWNERS
- Static application security testing (Semgrep, CodeQL) on every PR
- Software composition analysis (Snyk, Dependabot) on every PR + daily
- Container scanning (Trivy, ECR)
- IaC scanning (tfsec, Checkov)
- Secrets scanning (gitleaks)
- Weekly DAST (OWASP ZAP) on staging
- Annual third-party penetration test
- Threat modeling for significant changes
**Source**: `../engineering/SECURITY-TESTING.md` · **Sensitivity**: Public

### Q: Do you perform penetration testing?
**A**: Yes. Annual comprehensive third-party penetration test by an independent firm. Additional targeted tests per major release. Executive summary of findings available to customers under NDA.
**Source**: `../engineering/SECURITY-TESTING.md §8` · **Sensitivity**: Public

### Q: Do you have a vulnerability disclosure program?
**A**: Yes. Researchers can report via security@aims.io or trust.aims.io/vulnerability-disclosure. Safe harbor provided for good-faith research. Acknowledgment within 24 hours. Remediation per severity SLA. Responsible disclosure coordinated. See security.txt.
**Source**: `VULNERABILITY-MANAGEMENT.md §14` · **Sensitivity**: Public

---

## 6. Vulnerability + Patch Management

### Q: What's your vulnerability response SLA?
**A**:
- Critical: remediate within 24 hours
- High: within 7 days
- Medium: within 30 days
- Low: within 90 days

SLA breach escalates to CISO; exception process requires compensating controls + sign-off.
**Source**: `VULNERABILITY-MANAGEMENT.md §5` · **Sensitivity**: Public

### Q: How do you patch operating systems + infrastructure?
**A**: Bottlerocket container OS on EKS nodes; auto-updates minor versions via AWS. Container images rebuilt weekly with latest bases. Critical patches applied out-of-band. RDS auto-applies minor patches during maintenance windows; majors are planned.
**Source**: `VULNERABILITY-MANAGEMENT.md §6` · **Sensitivity**: Public

---

## 7. Incident Response

### Q: Do you have an incident response plan?
**A**: Yes. Documented plan, tested via monthly tabletops + annual live drill. Roles defined (Incident Commander, Technical, Legal, Comms). Security on-call 24x7 via PagerDuty. For incidents affecting customer data, notification per contract (generally within 72 hours of confirmation).
**Source**: `INCIDENT-RESPONSE.md` · **Sensitivity**: Public

### Q: When would AIMS notify us of a security incident?
**A**: Customer notification within 72 hours of confirmation of a Security Incident affecting Customer's data, per DPA. Earlier for confirmed material breaches. We commit to factual, timely communication — no speculation.
**Source**: DPA Section 4.9 · **Sensitivity**: Public

### Q: Have you had any security breaches?
**A**: [Current state: "No material security breaches affecting customer data" — adjust truthfully per incident history. Any past incidents disclosed in applicable SOC 2 report.]
**Source**: Trust Center + SOC 2 report · **Sensitivity**: Public

---

## 8. Business Continuity / Disaster Recovery

### Q: What's your uptime SLA?
**A**: 99.9% monthly availability (Standard tier), 99.95% (Enterprise tier). Internal SLOs are tighter (99.95%) to maintain SLA buffer. Current real availability trending above SLA. See status.aims.io for live + historical.
**Source**: `../devops/OBSERVABILITY.md §8` · **Sensitivity**: Public

### Q: What's your RPO and RTO?
**A**: RPO 15 minutes (Recovery Point Objective — max acceptable data loss). RTO 1 hour (Recovery Time Objective — max service restoration time). Achieved via cross-region warm standby, continuous PITR on the database, and cross-region replicated object storage.
**Source**: `../devops/DISASTER-RECOVERY.md §1` · **Sensitivity**: Public

### Q: Do you test your disaster recovery?
**A**: Yes. Monthly automated backup restoration validation. Quarterly scenario drills. Annual live regional-failover exercise with measured RTO.
**Source**: `../devops/DISASTER-RECOVERY.md §4` · **Sensitivity**: Public

---

## 9. Logging + Monitoring

### Q: What do you log?
**A**: Structured logs for all services; authentication events; admin actions; data access (for regulated tenants); API activity; infrastructure events (CloudTrail). Logs retained 30 days hot, 1 year warm, 7 years cold for compliance-relevant events. Customer data access auditable.
**Source**: `../devops/OBSERVABILITY.md §4`, `DATA-CLASSIFICATION.md §12` · **Sensitivity**: Public

### Q: Can customers access audit logs of their tenant?
**A**: Yes. Self-service audit log viewer in admin UI (recent activity); extended exports available via support request. [Phase 5: "HIPAA customers receive extended audit access per BAA."]
**Source**: `../auth/PERMISSIONS.md`, product feature · **Sensitivity**: Public

### Q: Can you integrate with our SIEM?
**A**: [Phase 2+: "Yes — via webhook-delivered events or periodic export. Customer-configured."] [Phase 1: "Planned Phase 2."]
**Source**: Roadmap · **Sensitivity**: Public

---

## 10. Vendor / Subprocessor Management

### Q: Do you use subprocessors?
**A**: Yes. A current list with each vendor, purpose, data types, and location is maintained publicly at trust.aims.io/subprocessors. Customers are notified 30 days in advance of additions; 30-day objection window per GDPR Art. 28.
**Source**: `THIRD-PARTY-RISK.md §8` · **Sensitivity**: Public

### Q: Do you perform due diligence on subprocessors?
**A**: Yes. Formal onboarding process includes:
- Security questionnaire
- Review of their SOC 2 / ISO attestations
- Data flow + classification review
- DPA signed (BAA if PHI)
- Legal + security approval per tier
- Annual re-assessment

Full process in `THIRD-PARTY-RISK.md`.
**Source**: `THIRD-PARTY-RISK.md §4` · **Sensitivity**: Public

---

## 11. Employee Security

### Q: Do you background-check employees?
**A**: Yes, for roles with access to production systems or customer data. Checks include criminal history + verification of employment/education. Conducted post-offer / pre-start, in compliance with local law.
**Source**: `SECURITY-PROGRAM.md §5` · **Sensitivity**: Public

### Q: Are employees bound by confidentiality obligations?
**A**: Yes. All employees + contractors sign confidentiality agreements at engagement. Acceptable Use Policy signed at onboarding and annually reaffirmed.
**Source**: `implementation/policies/acceptable-use.md` · **Sensitivity**: Public

### Q: How is employee offboarding handled?
**A**: Automated de-provisioning on departure date via HR system → SSO. Access revoked, devices returned and wiped. Exit procedures include final audit. 30-day post-departure monitoring for anomaly indicators.
**Source**: `SECURITY-PROGRAM.md §5` · **Sensitivity**: Public

---

## 12. Privacy

### Q: Are you GDPR compliant?
**A**: Yes. AIMS applies GDPR-grade handling to all customer data. DPA includes Standard Contractual Clauses where applicable. EU-US Data Privacy Framework used where subprocessors are certified. DSR process with response SLA within 20 business days. Subprocessor list public; DPO contact at dpo@aims.io.
**Source**: `PRIVACY.md` · **Sensitivity**: Public

### Q: How do you handle data subject requests?
**A**: Privacy requests via privacy@aims.io (or customer self-service). Identity verified. Fulfilled within GDPR (30 days) / CCPA (45 days) timelines; our internal target is 20 business days. Tracked in DSR register.
**Source**: `PRIVACY.md §5` · **Sensitivity**: Public

### Q: Do you use cookies / trackers?
**A**: Minimal essential cookies for session management. Analytics are privacy-respecting (Plausible or self-hosted Matomo). No cross-site tracking. Cookie banner with granular opt-in. Do Not Track respected.
**Source**: `PRIVACY.md §11` · **Sensitivity**: Public

---

## 13. Contract + Legal

### Q: Will you sign our DPA?
**A**: We offer our DPA template (GDPR Art. 28 compliant) — most customers find it sufficient. We also review and negotiate customer-provided DPAs. Legal-to-legal review typical turnaround 5–10 business days.
**Source**: `THIRD-PARTY-RISK.md §9`, DPA template · **Sensitivity**: Public

### Q: Will you sign a BAA?
**A**: [Phase 5+: Yes — HIPAA-capable mode with BAA available for Covered Entity customers.] [Phase 1–4: BAA available Phase 5 of our compliance roadmap.]
**Source**: `HIPAA.md` · **Sensitivity**: Public

### Q: What's your insurance coverage?
**A**: Cyber liability insurance with coverage appropriate for our scale and customer base. Certificate available under NDA. [Details are NDA — typically $5-10M cyber liability for mid-market SaaS.]
**Source**: `SECURITY-PROGRAM.md §12` · **Sensitivity**: NDA

### Q: Where are you incorporated?
**A**: AIMS Technologies, Inc., a Delaware corporation.
**Source**: Corporate · **Sensitivity**: Public

---

## 14. Operational Specifics (Often in Questionnaires)

### Q: Do you support IP allowlisting for customer logins?
**A**: Yes, for Enterprise tier — IP / CIDR allowlist configurable per tenant. Per-user IP restrictions via SSO provider.
**Source**: `../auth/` · **Sensitivity**: Public

### Q: Do you support custom password policies?
**A**: SSO is strongly encouraged; if password-based, customers can configure minimum length, complexity, rotation, and lockout. Defaults align with NIST SP 800-63B.
**Source**: `../auth/PERMISSIONS.md` · **Sensitivity**: Public

### Q: Do you have a single-tenant option?
**A**: Standard is multi-tenant with strong isolation (per-tenant encryption, RLS, logical segregation). Single-tenant dedicated deployment available for qualifying Enterprise customers (typically HIPAA or compliance-driven) at additional cost.
**Source**: Sales + product · **Sensitivity**: Public

### Q: How do customers export their data?
**A**: Built-in data export via admin UI. Formats: JSON, CSV, PDF. API-based bulk export for large tenants. Upon termination, 30-day export window.
**Source**: Product · **Sensitivity**: Public

---

## 15. Approach For Questionnaires We Haven't Seen Before

### CAIQ (Cloud Security Alliance Consensus Assessment)
- Use CSA CAIQ Lite (simplified) when possible
- ~200+ questions; most answers in this library
- Fill in Drata / Vanta questionnaire module OR Excel

### SIG (Shared Assessments Standardized Information Gathering)
- SIG Lite ~500 questions; SIG Core ~1000+
- Reserved for larger enterprise / financial
- Leverage this library; escalate to Security for unique items

### Custom customer questionnaires
- Match 80% from library
- 20% require fresh answer — Security writes; goes into library afterward
- Legal reviews contractual commitments

---

## Maintenance

- **Review cadence**: quarterly (accuracy + currency)
- **Owner**: Security + CS + Sales Enablement
- **Add new answers**: after every customer questionnaire
- **Retire outdated**: when policy / product changes invalidate
- **Audit**: annual review by CISO + Legal

---

## Sensitivity Guidance

- **Public** — share freely with anyone
- **NDA** — share under signed mutual NDA
- **Internal** — share only with AIMS staff
- **Restricted** — CISO approval to share

Default: when in doubt, NDA. Err on side of "controlled sharing."
