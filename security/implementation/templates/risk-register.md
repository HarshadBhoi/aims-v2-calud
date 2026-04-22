# Risk Register — Template + Starter Entries

<!--
REFERENCE IMPLEMENTATION — Risk register template for AIMS v2.

Maintained in Linear / Jira / compliance platform in real operation. This
markdown serves as the template + illustrative starter. Each row becomes a
ticket with the same fields.

Scoring: Likelihood (1–5) × Impact (1–5) = Inherent/Residual Risk (1–25).
  1–7   = Low         (green)
  8–14  = Medium      (yellow)
  15–19 = High        (orange)
  20+   = Critical    (red)

Risk appetite (per SECURITY-PROGRAM.md §6):
  Low residual        = accept, annual review
  Medium residual     = accept with mitigation plan, quarterly review
  High residual       = escalation + Steering Committee sign-off, reduce promptly
  Critical residual   = not acceptable; must reduce
-->

## Scoring Guides

### Likelihood
| Score | Label | Guidance |
|-------|-------|----------|
| 1 | Rare | Would require exceptional circumstances |
| 2 | Unlikely | May happen in a multi-year window |
| 3 | Possible | Plausible within a year |
| 4 | Likely | Expected within a year unless controls work |
| 5 | Almost certain | Will happen within months |

### Impact
| Score | Label | Financial | Reputational | Regulatory | Operational |
|-------|-------|-----------|--------------|------------|-------------|
| 1 | Negligible | < $10k | None | None | < 1h disruption |
| 2 | Minor | $10k–100k | Local | Minor finding | Few hours |
| 3 | Moderate | $100k–1M | Industry talk | Documented finding | 1 day |
| 4 | Major | $1M–10M | National press | Regulatory action + fine | Multi-day |
| 5 | Catastrophic | > $10M | Existential | Large fine, license risk | Business-threatening |

---

## Starter Risks (Illustrative)

### RISK-0001 — Multi-tenant isolation failure

| Field | Value |
|-------|-------|
| **Threat source** | External attacker; insider; bug |
| **Description** | An RLS policy gap, authorization flaw, or ORM bug could allow one tenant's user to access another tenant's data. |
| **Affected data class** | Confidential, Regulated |
| **Controls (current)** | Postgres RLS enforced; RBAC + ABAC; automated integration tests; pen tests include multi-tenancy; per-tenant envelope encryption (Phase 2) |
| **Inherent L × I** | 4 × 5 = **20 (Critical)** |
| **Residual L × I** | 2 × 5 = **10 (Medium)** |
| **Treatment** | Mitigate — ongoing investment in isolation controls |
| **Owner** | CTO + Backend Tech Lead |
| **Next review** | 2026-07-20 (quarterly) |
| **Status** | Open — monitoring |

---

### RISK-0002 — Production credential compromise

| Field | Value |
|-------|-------|
| **Threat source** | Phishing; stolen device; accidental exposure |
| **Description** | Engineer credentials or service-account keys could be compromised and abused to access production. |
| **Affected data class** | Restricted, Confidential, Regulated |
| **Controls (current)** | SSO + MFA mandatory (WebAuthn preferred); JIT production access; no standing admin; break-glass two-person; CloudTrail audit; anomaly detection (GuardDuty); automated credential rotation; gitleaks at multiple layers |
| **Inherent L × I** | 4 × 5 = **20** |
| **Residual L × I** | 2 × 4 = **8 (Medium)** |
| **Treatment** | Mitigate |
| **Owner** | CISO |
| **Next review** | 2026-07-20 |
| **Status** | Open — monitoring |

---

### RISK-0003 — Ransomware attack on production infrastructure

| Field | Value |
|-------|-------|
| **Threat source** | External attacker (ransomware group) |
| **Description** | Ransomware could encrypt production systems, demanding payment + disrupting service. |
| **Affected data class** | All customer data |
| **Controls (current)** | Immutable backups (S3 Object Lock); cross-region replication; EDR on endpoints; signed images; restricted admin access; Kyverno policy enforcement; regular backup restore testing |
| **Inherent L × I** | 3 × 5 = **15** |
| **Residual L × I** | 2 × 3 = **6 (Low)** |
| **Treatment** | Mitigate; policy: do not pay ransom |
| **Owner** | CISO + SRE Lead |
| **Next review** | 2026-07-20 |
| **Status** | Open — monitoring |

---

### RISK-0004 — Subprocessor breach exposing AIMS customer data

| Field | Value |
|-------|-------|
| **Threat source** | Attack on vendor; vendor negligence |
| **Description** | A vendor we use (Stripe, SendGrid, Okta, Datadog, etc.) experiences a breach, exposing data we've shared with them. |
| **Affected data class** | Confidential, Regulated (subset shared with vendor) |
| **Controls (current)** | Vendor security assessment at onboarding; DPAs + BAAs; subprocessor list minimization; data minimization (share least necessary); SOC 2 / ISO certs required; breach notification clauses in DPA |
| **Inherent L × I** | 3 × 4 = **12** |
| **Residual L × I** | 2 × 3 = **6 (Low)** |
| **Treatment** | Mitigate + Transfer (cyber insurance) |
| **Owner** | CISO + Legal |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

### RISK-0005 — Regulatory fine for GDPR non-compliance

| Field | Value |
|-------|-------|
| **Threat source** | Regulator; affected data subject complaint |
| **Description** | Non-compliance with GDPR (e.g., DSR timeline missed, breach not notified, transfer mechanism inadequate) could result in fine up to 4% of global revenue. |
| **Affected data class** | Regulated (EU personal data) |
| **Controls (current)** | GDPR-grade baseline for all; DPO (Phase 4+); DSR process with SLAs; breach notification procedures; SCCs + DPF for transfers; privacy notices; ROPA maintained |
| **Inherent L × I** | 3 × 4 = **12** |
| **Residual L × I** | 2 × 3 = **6 (Low)** |
| **Treatment** | Mitigate + Transfer (insurance partial) |
| **Owner** | DPO (Phase 4+) / Legal |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

### RISK-0006 — Catastrophic data loss (backup failure + disaster)

| Field | Value |
|-------|-------|
| **Threat source** | Regional disaster; backup infrastructure failure |
| **Description** | Primary region outage combined with backup failure or corruption could result in data loss beyond RPO. |
| **Affected data class** | All |
| **Controls (current)** | Multi-AZ primary; cross-region replication (RDS, S3); AWS Backup + logical dumps separately; monthly restore verification; annual DR drill; immutable backups |
| **Inherent L × I** | 2 × 5 = **10** |
| **Residual L × I** | 1 × 5 = **5 (Low)** |
| **Treatment** | Mitigate + Transfer (insurance) |
| **Owner** | SRE Lead |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

### RISK-0007 — Malicious insider exfiltrates customer data

| Field | Value |
|-------|-------|
| **Threat source** | Disgruntled employee; compromised insider |
| **Description** | A privileged insider could abuse access to exfiltrate Confidential / Regulated data. |
| **Affected data class** | Confidential, Regulated |
| **Controls (current)** | Least privilege; JIT access; dual approval for prod; audit logging; DLP (Phase 3+); background checks for sensitive roles; employment agreements; EDR on endpoints; anomaly detection (Phase 3+: user behavior analytics) |
| **Inherent L × I** | 2 × 5 = **10** |
| **Residual L × I** | 2 × 4 = **8 (Medium)** |
| **Treatment** | Mitigate; note: detection-focused more than prevention |
| **Owner** | CISO |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

### RISK-0008 — Supply chain attack via compromised dependency

| Field | Value |
|-------|-------|
| **Threat source** | External (upstream compromise of npm / container dep) |
| **Description** | A compromised npm package or container base image could inject malicious code. |
| **Affected data class** | Depends on scope of compromised component |
| **Controls (current)** | SCA scanning (Snyk + pnpm audit); Dependabot; pinning versions; signed images (Cosign); Kyverno admission control; SBOM; distroless base images; restricted network egress |
| **Inherent L × I** | 3 × 5 = **15** |
| **Residual L × I** | 2 × 4 = **8 (Medium)** |
| **Treatment** | Mitigate |
| **Owner** | Head of Engineering + CISO |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

### RISK-0009 — DDoS / availability attack

| Field | Value |
|-------|-------|
| **Threat source** | External attacker; hacktivist |
| **Description** | Volumetric attack could impact availability SLA. |
| **Affected data class** | Availability (not confidentiality or integrity) |
| **Controls (current)** | Cloudflare DDoS protection; AWS Shield; WAF with rate limits; auto-scaling; incident response |
| **Inherent L × I** | 3 × 3 = **9** |
| **Residual L × I** | 2 × 2 = **4 (Low)** |
| **Treatment** | Mitigate |
| **Owner** | SRE Lead |
| **Next review** | 2026-10-20 (annual — low residual) |
| **Status** | Open |

---

### RISK-0010 — Compromised CI/CD pipeline

| Field | Value |
|-------|-------|
| **Threat source** | Attacker gaining access to GitHub Actions or deploy credentials |
| **Description** | Attacker could inject code or deploy malicious builds via CI/CD. |
| **Affected data class** | All |
| **Controls (current)** | OIDC to AWS (no long-lived keys); GitHub branch protection; CODEOWNERS; PR review; signed images; two-person approval for prod deploy; CI audit logs; scoped IAM roles; environment-specific secrets |
| **Inherent L × I** | 3 × 5 = **15** |
| **Residual L × I** | 2 × 4 = **8 (Medium)** |
| **Treatment** | Mitigate |
| **Owner** | Platform Lead + CISO |
| **Next review** | 2026-07-20 |
| **Status** | Open |

---

## Review + Maintenance

### Quarterly
Security Team + affected owners review each open risk:
- Has likelihood / impact changed?
- Are current controls still effective?
- New controls to consider?
- Close risks whose treatment completed?

### Annual
Steering Committee reviews top-10 risks; compares year-over-year trend; sets treatment priorities for next year.

### Post-incident
Incidents feed the register:
- New risks identified
- Existing risks re-assessed (often likelihood increases)
- Control effectiveness reconsidered

### Acceptance log
All accepted risks signed by appropriate authority with review date. Expired acceptance triggers re-assessment.
