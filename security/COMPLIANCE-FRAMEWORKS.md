# Compliance Frameworks

> The landscape of frameworks AIMS may need to satisfy, the overlap between them (a lot), our phased roadmap, and the meta-principle: **build security well, then map it** — not the other way round.

---

## 1. Why Frameworks

Compliance frameworks:
- Codify best practices into auditable checklists
- Give customers a common language for asking "are you secure?"
- Reduce vendor-specific questionnaire fatigue (SOC 2 report covers many questions)
- Are sometimes contractually required (enterprise, healthcare, gov)
- Provide external validation of security posture

Compliance frameworks do NOT:
- Mean we're "secure" (certified != breach-proof)
- Replace doing security well
- Automatically apply to every customer relationship
- Justify their own cost at every stage of growth

We pursue frameworks as warranted by customer + regulatory demand — not speculatively.

---

## 2. Framework Catalog

### Security + Trust Certifications

| Framework | What it is | Who asks for it | Phase |
|-----------|-----------|-----------------|-------|
| **SOC 2 Type I** | Design of controls at a point in time (AICPA) | US customers, mid-market enterprise | Phase 2 |
| **SOC 2 Type II** | Controls operating effectively over 6–12 months | US enterprise, public co customers | Phase 3 |
| **SOC 1** | Controls over financial reporting | Customers whose auditors need SOC 1 for their own audit | As requested |
| **ISO 27001:2022** | ISMS certification; international | EU, global enterprise | Phase 4 |
| **ISO 27701** | Privacy extension to 27001 | EU especially | Phase 5 |
| **ISO 27017** | Cloud security extension | Cloud-native customers | Optional |
| **ISO 27018** | Cloud + personal data | Same | Optional |
| **CSA STAR Level 1** | Cloud Security Alliance self-assessment | Cloud-conscious customers | Phase 2 (cheap) |
| **CSA STAR Level 2** | Third-party audited | Harder customers | Phase 4+ |

### Regulatory (Privacy)

| Framework | Applies when | Phase |
|-----------|--------------|-------|
| **GDPR** | EU personal data | Always — Phase 1 |
| **UK GDPR / DPA 2018** | UK personal data | Always — Phase 1 |
| **CCPA + CPRA** | CA residents' data | Always — Phase 1 |
| **VA CDPA** | VA residents | Always (if in scope) |
| **CO CPA** | CO residents | Always |
| **CT CTDPA** | CT residents | Always |
| **UT CPA** | UT residents | Always |
| **TX DPSA** (2024) | TX residents | Always |
| **OR CPA** (2024) | OR residents | Always |
| **MT CDPA** (2024) | MT residents | Always |
| Other emerging US state laws | Monitored | Continuous |
| **LGPD** (Brazil) | Brazilian residents | If/when |
| **PIPEDA** (Canada) | Canadian residents | Always (light-touch) |
| **APPI** (Japan) | Japanese residents | If APAC expansion |
| **Australia Privacy Act** | Australian residents | If APAC |

### Regulatory (Sector-Specific)

| Framework | Applies when | Phase |
|-----------|--------------|-------|
| **HIPAA** | Healthcare audit customers (PHI) | Phase 5 |
| **HITECH** | Extends HIPAA | Phase 5 |
| **FERPA** | Education sector | If/when |
| **GLBA** | Financial services | If/when |
| **SOX** | Customer is SEC-registered; retention obligations | Addressed via retention policy always |
| **FINRA 17a-4** | Customer is broker-dealer; record retention | Addressed via retention policy always |
| **PCI DSS** | Payment card data | Not applicable (processor handles cards) |
| **NIST 800-53** | US federal systems | Phase 6 (FedRAMP) |
| **NIST 800-171** | US federal contractors | Phase 6 (CMMC) |
| **FedRAMP Moderate** | US federal customers | Phase 6 |
| **FedRAMP High** | Higher-sensitivity federal | Only if specific demand |
| **CMMC 2.0** | DoD supply chain | Phase 6 |
| **CJIS** | Law enforcement customers | If/when |
| **IRS Pub. 1075** | State + federal tax agencies | If/when |
| **StateRAMP** | US state customers | If demand |
| **TX-RAMP** | Texas state customers | If demand |
| **IL HB 3719 (CIRCIA)** | Critical infrastructure reporting | Watch |
| **NIS2** (EU) | EU critical infrastructure | Watch — may apply to some customers |
| **DORA** (EU Financial) | EU financial institutions | If EU financial customers |

### Meta-Standards We Reference

| Standard | Use |
|----------|-----|
| **NIST CSF** | Our program structure maps to NIST Cybersecurity Framework functions |
| **NIST RMF** / **ISO 31000** | Risk management approach |
| **CIS Controls v8** | Technical control benchmark |
| **CIS Benchmarks** | AWS, EKS, OS hardening guides |
| **OWASP Top 10** + **ASVS** | App sec baseline |
| **MITRE ATT&CK** | Threat intel + red team framework |
| **CSA CCM** | Cloud Controls Matrix (for questionnaires) |

---

## 3. Framework Overlap — The 80/20

Most controls repeat across frameworks. We implement the control once; map it to N frameworks.

### Example: "Access to production systems requires MFA"
- SOC 2: CC6.1 (logical access controls)
- ISO 27001: A.5.17 (authentication information)
- HIPAA: §164.308(a)(5)(ii)(D) (password management, extended to MFA in current guidance)
- GDPR: Art. 32 (security of processing)
- FedRAMP: IA-2(1), IA-2(2)
- NIST CSF: PR.AC-1
- CIS Control: 6.5
- PCI DSS: 8.3

One technical implementation (Okta MFA), one policy, one piece of evidence (Okta audit log), **eight frameworks** satisfied.

### High-overlap control areas
- Access control + MFA
- Encryption in transit + at rest
- Logging + monitoring
- Incident response
- Change management
- Vulnerability management
- Backup + recovery
- Vendor risk management
- Training + awareness
- Physical security

### Low-overlap areas (framework-specific)
- **GDPR**: DPIA, right to be forgotten workflow, SCCs, ROPA, DPO
- **HIPAA**: BAA-specific clauses, PHI handling, minimum necessary standard
- **FedRAMP**: control parameterization, continuous monitoring deliverables, POA&M
- **SOX**: financial-reporting-specific IT controls
- **PCI DSS**: CHD environment segmentation (not applicable to us)

---

## 4. Our Phased Roadmap

Reiterating + expanding the roadmap from `README.md`:

### Phase 1 — Pre-GA + GA (baseline)
**Goal**: Foundations in place; defensible security program; evidence-collection enabled.

Deliverables:
- All policies in `POLICIES.md` authored + approved
- Data classification taxonomy applied
- Vulnerability management program operational
- Incident response process + runbooks
- Third-party risk process + vendor register
- Privacy baseline (GDPR + CCPA-ready)
- Drata or Vanta onboarded (continuous compliance)
- First external pen test
- Trust center live (basic)
- Staff training program
- Cyber insurance in place

Timeline: completed by GA. No external cert yet.

### Phase 2 — SOC 2 Type I + SOC 2 Readiness
**Goal**: Formal attestation that controls are designed correctly. ~6 months post-GA.

Deliverables:
- SOC 2 Type I auditor engaged + report issued
- Trust center updated with SOC 2 status
- Customer-reported gaps addressed
- Readiness for SOC 2 Type II (continuous monitoring operating)

Time: 3–4 months engagement; ~$30–60k for auditor first time.

### Phase 3 — SOC 2 Type II
**Goal**: Formal attestation that controls are operating effectively over time. ~12 months observation.

Deliverables:
- SOC 2 Type II report (initial; renewed annually)
- Significant enterprise customer unlock
- Bug bounty program launched
- Red team exercise

Time: 12-month observation period; ~$50–80k for auditor annually.

### Phase 4 — ISO 27001 + Advanced Privacy
**Goal**: Global market readiness (EU + beyond).

Deliverables:
- ISO 27001 certification (Stage 1 + Stage 2 audits)
- ISO 27701 (privacy extension)
- DPO appointed (if not already)
- GDPR DPIA (Data Protection Impact Assessment) published for key processing activities
- EU subprocessor review

Time: 12–18 months; ~$40–60k initial; ~$20k/year maintenance.

### Phase 5 — HIPAA + Privacy Deepening
**Goal**: Healthcare market.

Deliverables:
- HIPAA-ready mode: BAAs with all subprocessors
- PHI-specific encryption + isolation
- HIPAA-specific incident response
- Customer-signable BAA
- HITRUST (optional — some healthcare customers prefer)

Time: 6 months if on top of existing foundation.

### Phase 6 — FedRAMP Moderate
**Goal**: US federal market.

Deliverables:
- GovCloud deployment (separate infrastructure)
- 3PAO assessment
- Authorization to Operate (ATO)
- Continuous monitoring deliverables
- FedRAMP Marketplace listing

Time: 18–36 months; $500k–$2M+ first time. Only pursue with concrete federal pipeline.

### Phase 7 — Additional (as-needed)
- FedRAMP High (very specific federal)
- IRS Pub. 1075 (tax agencies)
- CJIS (law enforcement)
- Country-specific (Australia IRAP, APAC variants)
- PCI DSS (if we ever hold cardholder data — not planned)

Each triggered by specific customer opportunity.

---

## 5. Control Framework Mapping

Drata / Vanta maintain this live. Example excerpt (illustrative):

```
Control: "MFA enforced on all production access"
  Policy: Access Control §4
  Evidence: Okta report (daily)
  Owner: CISO + IT
  Last checked: 2026-04-20 (automated)
  Next check: 2026-04-21

  Maps to:
    SOC 2:       CC6.1, CC6.2
    ISO 27001:   A.5.17, A.8.5
    HIPAA:       §164.308(a)(5)(ii)(D)
    GDPR:        Art. 32(1)(b)
    FedRAMP:     IA-2(1), IA-2(2)
    NIST CSF:    PR.AC-1, PR.AC-7
    CIS v8:      6.5
```

Every control card ties technical implementation → policy → evidence → frameworks. Changes propagate.

---

## 6. Compliance Platform Choice

**Drata vs Vanta vs Secureframe vs Tugboat Logic vs Sprinto**

All are viable. Criteria:
- Integrations (AWS, Okta, GitHub, Slack, Jira, etc.)
- Framework coverage (both major SOC 2; varying ISO / HIPAA / FedRAMP depth)
- Evidence automation (how much auto-collected vs manual)
- Policy library + customization
- Customer questionnaire automation
- Risk management module
- Price

Selection: **Drata** or **Vanta** — either works. Choose at Phase 2 launch, lock in for 2+ years (migration is painful).

Detail in `EVIDENCE-COLLECTION.md`.

---

## 7. Statement of Applicability (ISO 27001)

For ISO 27001: documents which Annex A controls apply, why, and how.

Stored + maintained as `security/ISO27001.md` (our specific SoA) + live doc in Drata / Vanta.

### Structure
For each of 93 Annex A controls (2022):
- Applicable? (Yes / No / Partial)
- Justification (why applicable or why excluded)
- Implementation reference (policy + technical control)
- Evidence source

Typical: ~85 applicable, ~8 excluded with justification (e.g., physical-security controls for a fully-remote company are minimal).

---

## 8. Scope Decisions

For every framework certification, scope is a deliberate decision:

### System scope
- Which application? (AIMS v2 specifically)
- Which components? (web, api, worker, infrastructure) — typically all
- Which environments? (prod only; staging included for SOC 2 Type II usually; dev excluded except for change mgmt)

### Data scope
- Customer data (Confidential + Regulated)
- Is production-only in scope, or does it include customer-controlled data in staging (should be none)?

### Geographic scope
- SOC 2: all regions where we operate (US + EU for us)
- ISO 27001: can be certification per region or global
- GDPR: applies wherever EU data processed
- FedRAMP: US GovCloud only

### Organizational scope
- Full company (usual for a small SaaS)
- Or specific business unit (for larger orgs with distinct product lines)

Narrower scope = cheaper audit + easier controls. Broader = more customer-satisfying. We keep it all-up to avoid "what's outside scope?" questions.

---

## 9. Budget + Cost

### First-time costs (rough)

| Framework | Audit firm | Internal time | Tooling | Total Y1 |
|-----------|-----------|----------------|---------|----------|
| SOC 2 Type I | $30–60k | 0.5 FTE × 6mo | Drata ~$10k/y | $75–120k |
| SOC 2 Type II | $50–80k | 0.5–1 FTE × 12mo | (included) | $110–180k |
| ISO 27001 | $40–60k | 1 FTE × 12mo | (included) | $140–220k |
| HIPAA readiness | $20–40k (consulting) | 0.5 FTE × 6mo | +BAA legal | $60–100k |
| FedRAMP Moderate | $300–800k (3PAO + agency) | 3+ FTE × 18mo | GovCloud infra | $1.5–3M |

### Annual maintenance
- SOC 2 Type II renewal: $50–80k/year
- ISO 27001 surveillance audit: $15–25k/year
- FedRAMP continuous monitoring: $200–500k/year

Compliance has real ongoing cost. Plan accordingly.

---

## 10. Audit Management

### Pre-audit
- Kickoff with auditor; align on scope, timing, cadence
- Drata / Vanta access provided
- Sample selection strategy
- Prepared statement of internal controls

### During
- Weekly working sessions with auditor
- Evidence requests (usually tool-generated)
- Management interviews (sample staff)
- Control testing (auditor samples; we provide evidence)

### Post-audit
- Draft report review
- Management response for any findings
- Final report issued
- Published (under NDA) to customers

### Handling findings
- Qualified opinion (rare): material deficiency — must fix before cert
- Deficiencies (significant / non-significant): remediate, document
- Observations: improvements noted

### Annual recertification
- Continuous monitoring reduces surprise
- Annual audit is verification, not discovery
- Drata / Vanta pre-audit = mostly green entering real audit

---

## 11. Customer Questions

Customers map controls to their own frameworks. Common questions we receive:
- "Are you ISO 27001 certified?"
- "Can we see your SOC 2 Type II report?"
- "Will you sign our DPA?"
- "Do you support BAA for HIPAA?"
- "Which regions is our data stored in?"
- "Do you have a pen test summary?"
- "What's your Trust Center URL?"

Answer-ready templates in `implementation/templates/security-questionnaire.md`.

---

## 12. Framework-Specific Gotchas

### SOC 2
- Type I is weaker than Type II (design vs operation)
- "AICPA" is the standards body; auditors are CPA firms
- Scope creep: auditors may want to include everything; push back on what's genuinely scoped
- Privacy TSC (beyond Security) adds cost; usually include only when a customer asks

### ISO 27001
- Statement of Applicability is central; exclusions must be justified
- Annex A revised 2022 (was 114 controls; now 93 organized differently)
- 2022 revision transition deadline October 2025 (past)
- Surveillance audit years 1+2; recertification year 3

### HIPAA
- No formal "HIPAA certified" (HITRUST fills gap)
- BAA required with every subprocessor touching PHI
- Breach notification threshold: different for <500 affected
- Risk Analysis required annually

### GDPR
- Fines up to 4% of global revenue (biggest number)
- ROPA (Art. 30) required
- DPIA for high-risk processing
- DPO required if large-scale systematic monitoring
- SCCs for non-adequate transfers
- Schrems II requirements (2020+) complicated US transfers — DPF (Data Privacy Framework, 2023+) restored adequacy decision

### FedRAMP
- Most complex + expensive
- 3PAO (Third-Party Assessment Organization) mandatory
- Agency ATO (sponsor agency) usually required unless JAB
- Continuous monitoring is demanding
- Don't start until a real federal opportunity exists

### CCPA / CPRA / other US state
- Patchwork — each state similar but distinct
- Most small orgs not caught (revenue + consumer thresholds)
- If we cross thresholds, we comply with highest common denominator (CPRA is most stringent currently)

---

## 13. Continuous Compliance ≠ Audit Cram

We build continuous. Come audit time:
- Drata / Vanta has collected evidence all year
- Policies up-to-date
- Training completed on schedule
- Access reviewed quarterly
- No mad scramble

Teams that compliance-cram fail more audits + exhaust staff. Our model: normal work = compliance work, instrumented.

---

## 14. Multi-Framework Tradeoffs

Trying to satisfy too many simultaneously = diluted focus. Our approach:
- Phase 2: SOC 2 Type I — one framework, done well
- Phase 3: SOC 2 Type II (iterate on what works)
- Phase 4: ISO 27001 (adds, doesn't replace SOC 2)
- Phase 5: HIPAA (adds, scope-specific)
- Phase 6: FedRAMP (highest rigor; only if warranted)

Don't pursue FedRAMP and HIPAA and ISO simultaneously unless dedicated compliance team is 5+ strong.

---

## 15. When We Say "No" to a Framework

Sometimes the answer is "we don't / won't pursue." Examples:
- **PCI DSS**: we don't handle cardholder data; Stripe does. No scope.
- **FedRAMP High**: only if specific high-sensitivity federal demand.
- **CJIS**: law enforcement customer vertical not a target.
- **PIF** or obscure industry certs: evaluate per opportunity.

Saying no is fine. Customer usually accepts "we're SOC 2 + ISO + HIPAA — we don't do [X] because [reason]".

---

## 16. Related Documents

- [`SOC2.md`](SOC2.md) — SOC 2 specific prep
- [`ISO27001.md`](ISO27001.md) — ISO 27001 specific prep
- [`PRIVACY.md`](PRIVACY.md) — GDPR + CCPA + state
- [`HIPAA.md`](HIPAA.md) — HIPAA specific
- [`EVIDENCE-COLLECTION.md`](EVIDENCE-COLLECTION.md) — continuous compliance tooling
- [`TRUST-CENTER.md`](TRUST-CENTER.md) — customer-facing
- [`POLICIES.md`](POLICIES.md) — policies by control
- [`DATA-CLASSIFICATION.md`](DATA-CLASSIFICATION.md) — data-driven compliance
